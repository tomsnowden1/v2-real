import { db, type WorkoutHistory, type PRRecord } from './database';
import { generateId } from '../lib/id';

export async function checkAndSavePRs(workout: WorkoutHistory): Promise<void> {
    const workoutDate = workout.endTime || Date.now();
    const newPRs: PRRecord[] = [];

    for (const workoutExercise of workout.exercises) {
        const exerciseId = workoutExercise.exerciseId;

        // Only consider normal or failure sets for PRs (exclude warmup/drops if desired, or include them)
        // Usually, PRs are from normal/failure sets.
        const validSets = workoutExercise.sets.filter(s => s.isDone && (s.type === 'normal' || s.type === 'failure'));

        if (validSets.length === 0) continue;

        let maxWeight = 0;
        let maxReps = 0;
        let maxVolume = 0;
        let max1RM = 0;

        for (const set of validSets) {
            const weight = set.weight || 0;
            const reps = set.reps || 0;
            const volume = weight * reps;
            const epley1RM = weight * (1 + reps / 30);

            if (weight > maxWeight) maxWeight = weight;
            if (reps > maxReps) maxReps = reps;
            if (volume > maxVolume) maxVolume = volume;
            if (epley1RM > max1RM) max1RM = epley1RM;
        }

        // Fetch existing PRs for this exercise
        const existingPRs = await db.prs.where('exerciseId').equals(exerciseId).toArray();
        const prMap = new Map<string, PRRecord>();
        existingPRs.forEach(pr => prMap.set(pr.metric, pr));

        const checkMetric = (metricName: PRRecord['metric'], newValue: number) => {
            if (newValue <= 0) return; // Don't save 0 as PR

            const existing = prMap.get(metricName);
            if (!existing || newValue > existing.value) {
                newPRs.push({
                    id: `pr-${generateId()}`,
                    exerciseId: exerciseId,
                    workoutId: workout.id,
                    metric: metricName,
                    value: newValue,
                    date: workoutDate
                });
            }
        };

        checkMetric('Max Weight', maxWeight);
        checkMetric('Max Reps', maxReps);
        checkMetric('Max Volume', maxVolume);
        // Round 1RM to 1 decimal place
        checkMetric('1RM', Math.round(max1RM * 10) / 10);
    }

    if (newPRs.length > 0) {
        await db.prs.bulkAdd(newPRs);
        console.log(`Saved ${newPRs.length} new personal records!`);
    }
}

export async function getPRsGroupedByExercise() {
    const allPRs = await db.prs.toArray();
    const grouped = allPRs.reduce((acc, pr) => {
        if (!acc[pr.exerciseId]) {
            acc[pr.exerciseId] = [];
        }
        acc[pr.exerciseId].push(pr);
        return acc;
    }, {} as Record<string, PRRecord[]>);
    return grouped;
}
