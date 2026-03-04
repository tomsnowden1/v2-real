import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutExercise } from '../db/database';
import { generateId } from '../lib/id';
import { updateTemplateValues, updateTemplateExercisesAndValues } from '../db/templateService';
import type { AIProvider } from '../lib/ai/types';
import type { AIConfig } from './useAIProvider';
import type { TemplateUpdateMode } from '../components/FinishWorkoutSheet';
import { runReviewForWorkout } from '../lib/reviewOrchestrator';

interface UsePostWorkoutReviewOptions {
    exercises: WorkoutExercise[];
    sourceTemplateId: string | null;
    config: AIConfig;
    provider: AIProvider;
    finishWorkout: () => Promise<void>;
}

interface UsePostWorkoutReviewReturn {
    hasChangesFromTemplate: boolean;
    templateName: string | undefined;
    /**
     * Saves the workout, optionally enqueues a Coach review, returns whether
     * the caller should navigate to /coach (true) or / (false).
     */
    handleFinish: (templateUpdateMode: TemplateUpdateMode, sendToCoach: boolean) => Promise<boolean>;
}

export function usePostWorkoutReview({
    exercises,
    sourceTemplateId,
    config,
    provider,
    finishWorkout,
}: UsePostWorkoutReviewOptions): UsePostWorkoutReviewReturn {

    // Live-query the source template (for change detection)
    const sourceTemplate = useLiveQuery(
        () => sourceTemplateId ? db.templates.get(sourceTemplateId) : undefined,
        [sourceTemplateId]
    );

    // Detect whether the user changed exercises/values from the template
    const hasChangesFromTemplate = useMemo(() => {
        if (!sourceTemplate) return false;
        const tplExIds = sourceTemplate.exercises.map(e => e.exerciseId).sort().join(',');
        const wkExIds = exercises.map(e => e.exerciseId).sort().join(',');
        if (tplExIds !== wkExIds) return true;
        for (const ex of exercises) {
            const tplEx = sourceTemplate.exercises.find(e => e.exerciseId === ex.exerciseId);
            if (!tplEx) return true;
            if (ex.sets.length !== tplEx.sets.length) return true;
            for (let i = 0; i < ex.sets.length; i++) {
                if (ex.sets[i].weight !== tplEx.sets[i].weight || ex.sets[i].reps !== tplEx.sets[i].reps) return true;
            }
        }
        return false;
    }, [sourceTemplate, exercises]);

    const handleFinish = async (
        templateUpdateMode: TemplateUpdateMode,
        sendToCoach: boolean
    ): Promise<boolean> => {
        // 1. Handle template update before finishing
        if (sourceTemplateId && templateUpdateMode !== 'none') {
            try {
                if (templateUpdateMode === 'values') {
                    await updateTemplateValues(sourceTemplateId, exercises);
                } else if (templateUpdateMode === 'values_and_exercises') {
                    await updateTemplateExercisesAndValues(sourceTemplateId, exercises);
                }
            } catch (e) {
                console.error('Failed to update template:', e);
            }
        }

        // 2. Save the workout (also triggers PR detection and weekly plan update)
        await finishWorkout();

        // 3. Enqueue Coach review if requested
        if (sendToCoach && config.apiKey) {
            // Budget guard
            if (config.monthlyBudgetCap !== null && config.currentUsageUsd >= config.monthlyBudgetCap) {
                await db.chatMessages.add({
                    id: generateId(),
                    role: 'assistant',
                    content: '⚠️ Monthly API Budget Cap reached. Post-workout review skipped.',
                    timestamp: Date.now(),
                    type: 'text',
                });
                return true; // still navigate to coach
            }

            try {
                // Idempotency: fetch the most recently saved workout
                const allHistory = await db.workoutHistory.orderBy('startTime').reverse().toArray();
                const lastWorkout = allHistory[0];
                if (!lastWorkout) return false;

                // Check if a review for this workout already exists
                const existing = await db.chatMessages
                    .where('reviewWorkoutId')
                    .equals(lastWorkout.id)
                    .first();
                if (existing) return true; // already reviewed — just navigate to coach

                // Create pending placeholder message
                const messageId = generateId();
                await db.chatMessages.add({
                    id: messageId,
                    role: 'assistant',
                    content: `Post-Workout Review — ${lastWorkout.name}`,
                    timestamp: Date.now(),
                    type: 'review',
                    reviewStatus: 'pending',
                    reviewWorkoutId: lastWorkout.id,
                });

                // Fire-and-forget — the orchestrator updates the message when done
                runReviewForWorkout(lastWorkout.id, messageId, provider, config);

                return true; // navigate to /coach
            } catch (e) {
                console.error('Failed to enqueue review:', e);
                return false;
            }
        }

        return false; // navigate to /
    };

    return {
        hasChangesFromTemplate,
        templateName: sourceTemplate?.name,
        handleFinish,
    };
}
