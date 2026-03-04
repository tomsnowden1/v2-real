import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVolumeLoad, getEstimated1RM, calculateWorkoutScore } from './scoringEngine';
import { db } from '../db/database';
import type { WorkoutExercise, WorkoutHistory, UserProfile } from '../db/database';

// ─── Module mocks ────────────────────────────────────────────────────────────

// vi.hoisted lets us reference the mock fn inside the vi.mock factory
const { mockGetCurrentWeeklyPlan } = vi.hoisted(() => ({
    mockGetCurrentWeeklyPlan: vi.fn().mockResolvedValue({
        id: 'week-test',
        weekStartDate: 0,
        targetTemplateIds: [],
        dayAssignments: [],
        completedWorkouts: [],
        hasCheckedIn: false,
    }),
}));

vi.mock('../db/weeklyPlanService', () => ({
    getCurrentWeeklyPlan: mockGetCurrentWeeklyPlan,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSet(
    weight: number,
    reps: number,
    isDone = true,
    type: 'normal' | 'warmup' | 'failure' | 'drop' = 'normal',
) {
    return { id: 's1', type, weight, reps, isDone };
}

function makeExercise(
    sets: ReturnType<typeof makeSet>[],
    exerciseId = 'ex-squat',
): WorkoutExercise {
    return { id: 'we-1', exerciseId, sets };
}

const baseProfile: UserProfile = { id: 'default', goal: 'Consistency/Newborn' };

function makeWorkout(exercises: WorkoutExercise[]): Omit<WorkoutHistory, 'id'> {
    return {
        name: 'Test Workout',
        startTime: Date.now() - 3_600_000,
        endTime: Date.now(),
        durationMs: 3_600_000,
        exercises,
    };
}

beforeEach(async () => {
    await db.workoutHistory.clear();
    mockGetCurrentWeeklyPlan.mockResolvedValue({
        id: 'week-test',
        weekStartDate: 0,
        targetTemplateIds: [],
        dayAssignments: [],
        completedWorkouts: [],
        hasCheckedIn: false,
    });
});

// ─── getVolumeLoad ────────────────────────────────────────────────────────────

describe('getVolumeLoad', () => {
    it('sums weight × reps for done weighted sets', () => {
        const ex = makeExercise([makeSet(100, 5), makeSet(100, 5)]);
        expect(getVolumeLoad(ex)).toBe(1000);
    });

    it('counts reps as proxy load when weight is 0 (bodyweight)', () => {
        const ex = makeExercise([makeSet(0, 10), makeSet(0, 8)]);
        expect(getVolumeLoad(ex)).toBe(18);
    });

    it('skips undone sets', () => {
        const ex = makeExercise([makeSet(100, 5, true), makeSet(100, 5, false)]);
        expect(getVolumeLoad(ex)).toBe(500);
    });

    it('returns 0 for an exercise with no sets', () => {
        expect(getVolumeLoad(makeExercise([]))).toBe(0);
    });
});

// ─── getEstimated1RM ─────────────────────────────────────────────────────────

describe('getEstimated1RM', () => {
    it('applies Epley formula: W × (1 + R/30)', () => {
        const ex = makeExercise([makeSet(100, 10)]);
        // 100 × (1 + 10/30) ≈ 133.33
        expect(getEstimated1RM(ex)).toBeCloseTo(133.33, 1);
    });

    it('returns the max 1RM across all sets', () => {
        const ex = makeExercise([makeSet(60, 10), makeSet(100, 5)]);
        // Set 1: 60 × (1 + 10/30) ≈ 80  |  Set 2: 100 × (1 + 5/30) ≈ 116.67
        expect(getEstimated1RM(ex)).toBeCloseTo(116.67, 1);
    });

    it('returns 0 for bodyweight (weight=0) sets', () => {
        expect(getEstimated1RM(makeExercise([makeSet(0, 15)]))).toBe(0);
    });

    it('returns 0 when no sets are marked done', () => {
        expect(getEstimated1RM(makeExercise([makeSet(100, 5, false)]))).toBe(0);
    });
});

// ─── calculateWorkoutScore ────────────────────────────────────────────────────

describe('calculateWorkoutScore', () => {
    describe('quality', () => {
        it('= 100 when every set is done', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5), makeSet(100, 5)])]),
                baseProfile,
            );
            expect(score.quality).toBe(100);
        });

        it('= 50 when exactly half the sets are done', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5, true), makeSet(100, 5, false)])]),
                baseProfile,
            );
            expect(score.quality).toBe(50);
        });

        it('= 100 for a workout with no sets (showed up counts)', async () => {
            const score = await calculateWorkoutScore(makeWorkout([]), baseProfile);
            expect(score.quality).toBe(100);
        });
    });

    describe('consistency', () => {
        it('= 100 when weekly plan has no targets', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                baseProfile,
            );
            expect(score.consistency).toBe(100);
        });

        it('= 33 when 0 of 3 target workouts completed (current counts as +1)', async () => {
            mockGetCurrentWeeklyPlan.mockResolvedValueOnce({
                id: 'w', weekStartDate: 0, dayAssignments: [],
                targetTemplateIds: ['t1', 't2', 't3'],
                completedWorkouts: [],
                hasCheckedIn: false,
            });
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                baseProfile,
            );
            expect(score.consistency).toBe(33);
        });

        it('= 100 when all targets completed (including current)', async () => {
            mockGetCurrentWeeklyPlan.mockResolvedValueOnce({
                id: 'w', weekStartDate: 0, dayAssignments: [],
                targetTemplateIds: ['t1', 't2'],
                completedWorkouts: ['wh-done-1'], // 1 done + 1 current = 2/2
                hasCheckedIn: false,
            });
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                baseProfile,
            );
            expect(score.consistency).toBe(100);
        });
    });

    describe('progression', () => {
        it('= 85 (baseline) when no previous workout for that exercise', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                baseProfile,
            );
            expect(score.progression).toBe(85);
        });

        it('= 100 (Strength) when estimated 1RM improves vs last session', async () => {
            await db.workoutHistory.add({
                id: 'wh-prev', name: 'Prev', startTime: 1, endTime: 2, durationMs: 1,
                exercises: [makeExercise([makeSet(80, 5)])], // 1RM ≈ 93
            });
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]), // 1RM ≈ 117
                { id: 'default', goal: 'Strength' },
            );
            expect(score.progression).toBe(100);
        });

        it('= 85 (maintained) when 1RM is unchanged', async () => {
            await db.workoutHistory.add({
                id: 'wh-prev-same', name: 'Prev', startTime: 1, endTime: 2, durationMs: 1,
                exercises: [makeExercise([makeSet(100, 5)])],
            });
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                { id: 'default', goal: 'Strength' },
            );
            expect(score.progression).toBe(85);
        });

        it('is floored at 50 on a severe regression', async () => {
            await db.workoutHistory.add({
                id: 'wh-strong', name: 'Prev', startTime: 1, endTime: 2, durationMs: 1,
                exercises: [makeExercise([makeSet(200, 5)])], // volume = 1000
            });
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(60, 3)])]), // volume = 180
                { id: 'default', goal: 'Hypertrophy' },
            );
            expect(score.progression).toBeGreaterThanOrEqual(50);
            expect(score.progression).toBeLessThan(100);
        });
    });

    describe('overall goal weighting', () => {
        it('Strength: 45% progression + 35% consistency + 20% quality', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                { id: 'default', goal: 'Strength' },
            );
            // No previous workout → progression=85, no targets → consistency=100, all done → quality=100
            expect(score.overall).toBe(Math.round(85 * 0.45 + 100 * 0.35 + 100 * 0.20));
        });

        it('Hypertrophy: 45% quality + 35% progression + 20% consistency', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                { id: 'default', goal: 'Hypertrophy' },
            );
            expect(score.overall).toBe(Math.round(100 * 0.45 + 85 * 0.35 + 100 * 0.20));
        });

        it('Fat loss/Conditioning: 50% quality + 50% consistency (no progression weight)', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                { id: 'default', goal: 'Fat loss/Conditioning' },
            );
            expect(score.overall).toBe(Math.round(100 * 0.50 + 100 * 0.50));
        });

        it('overall is always an integer', async () => {
            const score = await calculateWorkoutScore(
                makeWorkout([makeExercise([makeSet(100, 5)])]),
                baseProfile,
            );
            expect(Number.isInteger(score.overall)).toBe(true);
        });
    });
});
