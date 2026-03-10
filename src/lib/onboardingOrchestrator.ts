/**
 * onboardingOrchestrator.ts
 *
 * Plain async function (no React) that runs the post-onboarding pipeline:
 *  1. Write a pending coach welcome message to Dexie
 *  2. Build context from the new user profile
 *  3. Call AI to generate initial week templates
 *  4. Resolve exercise names (auto-only — no user prompt during onboarding)
 *  5. Save templates and assign them to the current weekly plan
 *  6. Build and update the coach welcome message with a real summary
 *  7. Mark profile.onboardingComplete = true
 *
 * Follows the same pattern as reviewOrchestrator.ts.
 * Called from ArchitectIntakeWizard after profile is saved.
 */

import { db } from '../db/database';
import type { UserProfile } from '../db/database';
import type { AIProvider, CheckInAnswers } from './ai/types';
import type { AIConfig } from '../hooks/useAIProvider';
import { generateId } from './id';
import { saveAsTemplate } from '../db/templateService';
import { getCurrentWeeklyPlan, setTargetTemplates } from '../db/weeklyPlanService';
import { resolveExerciseName } from './exerciseResolver';

export async function runOnboardingCompletion(
    profile: UserProfile,
    provider: AIProvider,
    config: AIConfig
): Promise<void> {
    const messageId = `msg-onboarding-welcome-${generateId()}`;

    // ── 1. Write pending placeholder so chat shows something immediately ─────────
    await db.chatMessages.add({
        id: messageId,
        role: 'assistant',
        content: JSON.stringify({ message: '⏳ Building your personalised program...' }),
        timestamp: Date.now(),
        type: 'text',
    });

    try {
        // ── 2. Build equipment context ────────────────────────────────────────────
        let equipmentContext = 'Standard commercial gym equipment.';
        try {
            const gyms = await db.gymProfiles.toArray();
            if (gyms.length > 0) {
                const gym = gyms[0];
                equipmentContext = `User trains at: ${gym.name}. Available equipment IDs: ${gym.availableEquipmentIds.join(', ')}. Only suggest exercises that require equipment in this list.`;
            }
        } catch { /* non-critical — fallback to default */ }

        // ── 3. Check if AI is available ───────────────────────────────────────────
        const hasApiKey = !!(config.apiKey);
        let templateIds: string[] = [];
        let weekSummary = '';

        if (hasApiKey) {
            // ── 4. Build CheckInAnswers from the new profile ──────────────────────
            const bodyStatusParts: string[] = [];
            if (profile.preferences?.trim()) {
                bodyStatusParts.push(`Movement restrictions / injuries: ${profile.preferences}`);
            }
            if (profile.personalContext?.trim()) {
                bodyStatusParts.push(`SAFETY CONSTRAINTS — USER-REPORTED (treat as hard constraints, avoid exercises stressing these areas): ${profile.personalContext.trim()}`);
            }
            const answers: CheckInAnswers = {
                daysAvailable: profile.targetWorkoutDays ?? 3,
                bodyStatus: bodyStatusParts.length > 0
                    ? bodyStatusParts.join(' | ')
                    : 'No known injuries or movement restrictions.',
                variety: 'Mix it up',
                satisfaction: `First week — brand new user. Goal: ${profile.goal}. Experience: ${profile.experienceLevel ?? 'unspecified'}.`,
            };

            // ── 5. Call AI to generate initial templates ──────────────────────────
            const response = await provider.generateWeeklyPlanUpdate(
                config.apiKey!,
                config.selectedModel,
                profile,
                [], // no history for a new user
                answers,
                equipmentContext
            );

            if (response.data && response.data.length > 0) {
                const allExercises = await db.exercises.toArray();

                // ── 6. Auto-resolve exercise names (skip unresolvable ones) ───────
                for (const workout of response.data) {
                    const resolvedExercises = [];

                    for (const ex of workout.exercises) {
                        const result = resolveExerciseName(ex.name, allExercises);
                        if (result.status === 'resolved' && result.exerciseId && result.dbExercise) {
                            const sets = [];
                            for (let i = 0; i < ex.sets; i++) {
                                sets.push({
                                    id: `s-${generateId()}`,
                                    type: 'normal' as const,
                                    weight: 0,
                                    reps: parseInt(ex.reps) || 8,
                                    isDone: false,
                                });
                            }
                            resolvedExercises.push({
                                id: `we-${generateId()}`,
                                exerciseId: result.exerciseId,
                                exerciseName: result.dbExercise.name,
                                sets,
                            });
                        }
                        // Silently skip exercises that can't be auto-resolved
                    }

                    if (resolvedExercises.length > 0) {
                        const template = await saveAsTemplate(workout.name, resolvedExercises);
                        templateIds.push(template.id);
                    }
                }

                // ── 7. Assign templates to this week ──────────────────────────────
                if (templateIds.length > 0) {
                    await setTargetTemplates(templateIds);
                    // Also populate dayAssignments evenly across the week
                    const plan = await getCurrentWeeklyPlan();
                    const newAssignments = [...plan.dayAssignments];
                    // Spread workouts across Mon-Fri, skipping rest days
                    const workDayIndexes = [0, 1, 2, 3, 4, 5, 6]; // Mon=0...Sun=6
                    let assignmentSlot = 0;
                    for (let i = 0; i < workDayIndexes.length && assignmentSlot < templateIds.length; i++) {
                        newAssignments[workDayIndexes[i]] = { templateId: templateIds[assignmentSlot] };
                        assignmentSlot++;
                    }
                    await db.weeklyPlans.update(plan.id, { dayAssignments: newAssignments, hasCheckedIn: true });
                }

                weekSummary = `\n\n**Your Week 1 is ready.** I've scheduled ${templateIds.length} training day${templateIds.length !== 1 ? 's' : ''} on your Home tab. Head there to see what's planned.`;
            }
        }

        // ── 8. Build the welcome message ──────────────────────────────────────────
        const goalLabel = getGoalLabel(profile.goal);
        const experienceLabel = profile.experienceLevel ?? 'unspecified experience';
        const days = profile.targetWorkoutDays ?? 3;
        const sessionLength = profile.sessionDuration ?? 'flexible';
        const activityLabel = profile.currentActivityLevel ? `, currently ${profile.currentActivityLevel.toLowerCase()} outside the gym` : '';
        const blockers = profile.consistencyBlockers?.length
            ? `\n- **Your usual blockers:** ${profile.consistencyBlockers.join(', ')} — I'll keep the plan realistic around these.`
            : '';
        const preferences = profile.exercisePreferences
            ? `\n- **Training preferences:** ${profile.exercisePreferences}`
            : '';
        const sleepStress = (profile.sleepHours || profile.stressLevel)
            ? `\n- **Recovery context:** ${[profile.sleepHours ? `${profile.sleepHours} hrs sleep` : null, profile.stressLevel ? `${profile.stressLevel.toLowerCase()} stress` : null].filter(Boolean).join(', ')} — I'll factor this into volume decisions.`
            : '';
        const personalContextNote = profile.personalContext?.trim()
            ? `\n- **Coach notes:** ${profile.personalContext.trim()}`
            : '';
        const noKeyNote = !hasApiKey
            ? '\n\n⚠️ **No AI key configured yet.** Go to Settings → AI to add your API key, then I can generate your first week and analyse your sessions.'
            : '';

        const welcomeText = [
            `Here's what I know about you so far, ${profile.motivation ? `and what you're working toward — *"${profile.motivation}"*` : ''}:`,
            '',
            `- **Goal:** ${goalLabel}`,
            `- **Experience:** ${experienceLabel}${activityLabel}`,
            `- **Schedule:** ${days} day${days !== 1 ? 's' : ''}/week, ${sessionLength} sessions`,
            preferences,
            blockers,
            sleepStress,
            personalContextNote,
            profile.preferences ? `- **Constraints:** ${profile.preferences}` : '',
            '',
            `Your program uses a **6-week block** — Week 1 starts at reduced volume so your body adapts, builds through weeks 2–5, then week 6 is a planned lighter recovery week. This cycle then repeats.`,
            weekSummary,
            noKeyNote,
            '',
            `Ask me anything — to adjust the plan, build a specific workout, or explain any exercise. I'm here every step of the way.`,
        ].filter(line => line !== undefined && line !== '').join('\n');

        // ── 9. Update message with final content ──────────────────────────────────
        await db.chatMessages.update(messageId, {
            content: JSON.stringify({ message: welcomeText }),
        });

    } catch (err) {
        console.error('[OnboardingOrchestrator] Failed:', err);

        // Graceful fallback — still show a useful welcome message
        const fallbackText = `Welcome to IronAI! 🎯\n\nYour profile has been saved. Here's what I have on you:\n\n- **Goal:** ${getGoalLabel(profile.goal)}\n- **Schedule:** ${profile.targetWorkoutDays ?? 3} days/week\n${profile.motivation ? `- **Your why:** "${profile.motivation}"` : ''}\n\nI hit a snag generating your first week automatically (${String(err).slice(0, 80)}...). You can ask me directly to build your first week: *"Build me a ${profile.targetWorkoutDays ?? 3}-day ${profile.goal} program"*`;

        await db.chatMessages.update(messageId, {
            content: JSON.stringify({ message: fallbackText }),
        }).catch(() => { /* best effort */ });
    }
}

function getGoalLabel(goal: UserProfile['goal']): string {
    switch (goal) {
        case 'Strength': return 'Max Strength';
        case 'Hypertrophy': return 'Hypertrophy (Muscle Building)';
        case 'Fat loss/Conditioning': return 'Fat Loss & Conditioning';
        case 'Consistency/Newborn': return 'Building Consistency';
        default: return goal;
    }
}
