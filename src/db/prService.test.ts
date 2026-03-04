import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database';
import { checkAndSavePRs } from './prService';
import type { WorkoutHistory } from './database';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkout(
    exercises: WorkoutHistory['exercises'],
    id = 'wh-test',
): WorkoutHistory {
    return {
        id,
        name: 'Test Workout',
        startTime: Date.now() - 3_600_000,
        endTime: Date.now(),
        durationMs: 3_600_000,
        exercises,
    };
}

beforeEach(async () => {
    await db.prs.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkAndSavePRs', () => {
    it('saves a new PR when none existed before', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-squat',
            sets: [{ id: 's1', type: 'normal', weight: 100, reps: 5, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const prs = await db.prs.where('exerciseId').equals('ex-squat').toArray();
        expect(prs.length).toBeGreaterThan(0);
        expect(prs.some(p => p.metric === 'Max Weight')).toBe(true);
    });

    it('tracks all four metrics: Max Weight, Max Reps, Max Volume, 1RM', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-dl',
            sets: [{ id: 's1', type: 'normal', weight: 140, reps: 5, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const metrics = (await db.prs.where('exerciseId').equals('ex-dl').toArray())
            .map(p => p.metric);

        expect(metrics).toContain('Max Weight');
        expect(metrics).toContain('Max Reps');
        expect(metrics).toContain('Max Volume');
        expect(metrics).toContain('1RM');
    });

    it('does NOT save a new PR when existing record is higher', async () => {
        await db.prs.add({
            id: 'pr-existing',
            exerciseId: 'ex-bp',
            workoutId: 'wh-old',
            metric: 'Max Weight',
            value: 150,
            date: Date.now() - 86_400_000,
        });

        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-bp',
            sets: [{ id: 's1', type: 'normal', weight: 120, reps: 5, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const maxWeightPRs = await db.prs
            .where('exerciseId').equals('ex-bp')
            .filter(p => p.metric === 'Max Weight')
            .toArray();

        // Only the seeded 150 remains — no new record for 120
        expect(maxWeightPRs.length).toBe(1);
        expect(maxWeightPRs[0].value).toBe(150);
    });

    it('saves a new PR when the new value strictly beats the existing record', async () => {
        await db.prs.add({
            id: 'pr-old',
            exerciseId: 'ex-rdl',
            workoutId: 'wh-old',
            metric: 'Max Weight',
            value: 100,
            date: Date.now() - 86_400_000,
        });

        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-rdl',
            sets: [{ id: 's1', type: 'normal', weight: 110, reps: 5, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const maxWeightPRs = await db.prs
            .where('exerciseId').equals('ex-rdl')
            .filter(p => p.metric === 'Max Weight')
            .toArray();

        // Now 2 records: the old 100 and the new 110
        expect(maxWeightPRs.length).toBe(2);
        expect(maxWeightPRs.some(p => p.value === 110)).toBe(true);
    });

    it('does NOT save a PR for a tied value', async () => {
        await db.prs.add({
            id: 'pr-tied',
            exerciseId: 'ex-ohp',
            workoutId: 'wh-old',
            metric: 'Max Weight',
            value: 80,
            date: Date.now() - 86_400_000,
        });

        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-ohp',
            sets: [{ id: 's1', type: 'normal', weight: 80, reps: 5, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const maxWeightPRs = await db.prs
            .where('exerciseId').equals('ex-ohp')
            .filter(p => p.metric === 'Max Weight')
            .toArray();

        // Tie is not saved — strict improvement required
        expect(maxWeightPRs.length).toBe(1);
        expect(maxWeightPRs[0].value).toBe(80);
    });

    it('skips sets where isDone is false', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-curl',
            sets: [
                { id: 's1', type: 'normal', weight: 50, reps: 10, isDone: false }, // heavy but not done
                { id: 's2', type: 'normal', weight: 30, reps: 8, isDone: true },
            ],
        }]);

        await checkAndSavePRs(workout);

        const maxWeightPR = await db.prs
            .where('exerciseId').equals('ex-curl')
            .filter(p => p.metric === 'Max Weight')
            .first();

        expect(maxWeightPR?.value).toBe(30); // not 50
    });

    it('excludes warmup and drop sets from PR consideration', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-row',
            sets: [
                { id: 's1', type: 'warmup', weight: 60,  reps: 10, isDone: true },
                { id: 's2', type: 'drop',   weight: 80,  reps: 12, isDone: true }, // heaviest, but excluded
                { id: 's3', type: 'normal', weight: 70,  reps:  6, isDone: true },
                { id: 's4', type: 'failure', weight: 70, reps:  4, isDone: true }, // failure sets ARE included
            ],
        }]);

        await checkAndSavePRs(workout);

        const maxWeightPR = await db.prs
            .where('exerciseId').equals('ex-row')
            .filter(p => p.metric === 'Max Weight')
            .first();

        // warmup (60) and drop (80) are excluded; normal (70) and failure (70) are included → max = 70
        expect(maxWeightPR?.value).toBe(70);
    });

    it('does not save a PR when all metric values are 0', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-plank',
            sets: [{ id: 's1', type: 'normal', weight: 0, reps: 0, isDone: true }],
        }]);

        await checkAndSavePRs(workout);

        const prs = await db.prs.where('exerciseId').equals('ex-plank').toArray();
        expect(prs.length).toBe(0);
    });

    it('handles exercises with no valid sets gracefully', async () => {
        const workout = makeWorkout([{
            id: 'we-1', exerciseId: 'ex-skipped',
            sets: [],
        }]);

        await expect(checkAndSavePRs(workout)).resolves.not.toThrow();
        const prs = await db.prs.where('exerciseId').equals('ex-skipped').toArray();
        expect(prs.length).toBe(0);
    });
});
