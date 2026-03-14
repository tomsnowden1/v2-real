/**
 * reviewOrchestrator.ts
 *
 * Plain async function (no React) that runs the full post-workout analysis pipeline:
 *  1. Fetch context (workout, template, history, PRs, week plan)
 *  2. Call AI provider
 *  3. Write result (or error) back to the pending ChatMessage in Dexie
 *  4. Auto-save TTL takeaways; surface durable candidates via reviewData
 *
 * Called by usePostWorkoutReview (initial run) and Coach.tsx (retry).
 */

import { db, type Takeaway } from '../db/database';
import type { AIProvider, PostWorkoutReview, TakeawayTTL } from './ai/types';
import type { AIConfig } from '../hooks/useAIProvider';
import { generateId } from './id';
import { getUserProfile } from '../db/userProfileService';
import { getCurrentWeeklyPlan } from '../db/weeklyPlanService';

export async function runReviewForWorkout(
    workoutId: string,
    messageId: string,
    provider: AIProvider,
    config: AIConfig
): Promise<void> {
    try {
        // ── 1. Fetch the completed workout ────────────────────────────────────────
        const workout = await db.workoutHistory.get(workoutId);
        if (!workout) throw new Error(`Workout ${workoutId} not found`);

        // ── 2. Fetch supporting context in parallel ───────────────────────────────
        const [profile, allHistory, weekPlan, freshPRRecords] = await Promise.all([
            getUserProfile(),
            db.workoutHistory.orderBy('startTime').reverse().toArray(),
            getCurrentWeeklyPlan(),
            db.prs.where('workoutId').equals(workoutId).toArray(),
        ]);

        if (!profile) throw new Error('User profile not found');

        // Previous sessions for trend comparison (skip the workout we just finished)
        const prevWorkouts = allHistory.filter(w => w.id !== workoutId).slice(0, 6);

        // Source template (for plan adherence) — stored directly on the workout record
        const workoutRecord = await db.workoutHistory.get(workoutId);
        const sourceTemplateId = workoutRecord?.sourceTemplateId ?? null;

        const sourceTemplate = sourceTemplateId
            ? await db.templates.get(sourceTemplateId) ?? null
            : null;

        // Week progress context
        const completedThisWeek = weekPlan.completedWorkouts.length;
        const plannedThisWeek = weekPlan.dayAssignments.filter(d => d.templateId !== null).length;

        // Score trend: collect scores from recent workouts for avg comparison
        const recentScores = allHistory
            .filter(w => w.id !== workoutId && w.score)
            .slice(0, 5)
            .map(w => w.score!.overall);

        // Resolve PR records to exercise names
        const detectedPRs = await Promise.all(
            freshPRRecords.map(async pr => {
                const ex = await db.exercises.get(pr.exerciseId);
                return {
                    exerciseName: ex?.name ?? pr.exerciseId,
                    metric: pr.metric,
                    value: pr.value,
                };
            })
        );

        // ── 3. Call AI ────────────────────────────────────────────────────────────
        const reviewType = profile.postWorkoutReview === 'Extended' ? 'Extended' : 'Brief';

        const response = await provider.generatePostWorkoutReview(
            config.apiKey ?? '',
            config.selectedModel,
            workout,
            profile,
            reviewType,
            prevWorkouts,
            detectedPRs,
            sourceTemplate,
            { completed: completedThisWeek, planned: plannedThisWeek, scores: recentScores }
        );

        if (!response.data) throw new Error('AI returned no data');

        const review: PostWorkoutReview = response.data;

        // ── 4. Auto-save TTL takeaways ────────────────────────────────────────────
        await saveTTLTakeaways(review.takeawaysTTL ?? [], workoutId);

        // ── 4b. Architect accountability follow-up ────────────────────────────────
        // Only fires when the user has completed the Architect intake (motivation set).
        if (profile.motivation) {
            const fatiguePhrases = ['fatigue', 'overreaching', 'overtraining', 'accumulated'];
            const fatigueIssues = (review.issues ?? []).filter(issue =>
                fatiguePhrases.some(kw => issue.probableCause.toLowerCase().includes(kw))
            );

            const TWENTY_MINS_MS = 20 * 60 * 1000;
            const skippedSets = workout.exercises.reduce(
                (total, ex) => total + ex.sets.filter(s => !s.isDone).length, 0
            );
            const looksLazy = workout.durationMs < TWENTY_MINS_MS && skippedSets >= 2;

            if (fatigueIssues.length >= 2) {
                await db.chatMessages.add({
                    id: `msg-architect-fatigue-${generateId()}`,
                    role: 'assistant',
                    content: JSON.stringify({
                        message: `I'm seeing ${fatigueIssues.length} signs of accumulated fatigue in today's session.\n\nYou committed to training for: *"${profile.motivation}"* — that goal is still there. But your body is sending a clear signal.\n\nShould I dial back next week's volume by ~15% as a recovery measure, or would you prefer to push through? Either way, I'll adapt your program accordingly. Just let me know.`,
                        suggestedWorkouts: []
                    }),
                    timestamp: Date.now() + 1500,
                    type: 'text',
                });
            } else if (looksLazy) {
                await db.chatMessages.add({
                    id: `msg-architect-nudge-${generateId()}`,
                    role: 'assistant',
                    content: JSON.stringify({
                        message: `That was a short one. Not every session is our best — I get it.\n\nBut remember why you started: *"${profile.motivation}"*.\n\nNext session, let's make sure you get the full work in. Your plan is ready and waiting.`,
                        suggestedWorkouts: []
                    }),
                    timestamp: Date.now() + 1500,
                    type: 'text',
                });
            }
        }

        // ── 5. Update chatMessage to 'complete' ───────────────────────────────────
        await db.chatMessages.update(messageId, {
            reviewStatus: 'complete',
            reviewData: JSON.stringify(review),
        });

    } catch (err) {
        console.error('[ReviewOrchestrator] Failed:', err);
        // Mark the message as errored so Coach.tsx can show a retry button
        await db.chatMessages.update(messageId, {
            reviewStatus: 'error',
            reviewData: JSON.stringify({ errorMessage: String(err) }),
        }).catch(() => { /* best effort */ });
    }
}

async function saveTTLTakeaways(ttl: TakeawayTTL[], workoutId: string): Promise<void> {
    if (!ttl || ttl.length === 0) return;

    const now = Date.now();
    const records: Takeaway[] = ttl.map(t => ({
        id: generateId(),
        workoutId,
        exerciseIds: t.appliesToExerciseIds,
        category: t.category,
        statement: t.statement,
        confidence: t.confidence,
        isDurable: false,
        expiresAt: t.expiresAt ? new Date(t.expiresAt).getTime() : now + 7 * 24 * 60 * 60 * 1000,
        createdAt: now,
    }));

    await db.takeaways.bulkAdd(records).catch(() => { /* non-critical */ });
}
