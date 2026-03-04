import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { WorkoutProvider, useWorkout } from './WorkoutContext';
import { db } from '../db/database';
import type { ReactNode } from 'react';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../db/weeklyPlanService', () => ({
    getCurrentWeeklyPlan: vi.fn().mockResolvedValue({
        id: 'w', weekStartDate: 0,
        targetTemplateIds: [], dayAssignments: [],
        completedWorkouts: [], hasCheckedIn: false,
    }),
    addCompletedWorkoutToWeek: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test wrapper ─────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkoutProvider>{children}</WorkoutProvider>
);

beforeEach(async () => {
    localStorage.clear();
    await db.workoutHistory.clear();
    await db.prs.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkoutContext', () => {
    describe('initial state', () => {
        it('starts inactive with default values', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            expect(result.current.isActive).toBe(false);
            expect(result.current.workoutName).toBe('New Workout');
            expect(result.current.exercises).toHaveLength(0);
            expect(result.current.startTime).toBeNull();
            expect(result.current.sourceTemplateId).toBeNull();
        });
    });

    describe('startWorkout', () => {
        it('sets isActive=true and records a startTime', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Push Day'); });

            expect(result.current.isActive).toBe(true);
            expect(result.current.workoutName).toBe('Push Day');
            expect(result.current.startTime).toBeGreaterThan(0);
        });

        it('uses default name "Evening Workout" when none supplied', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout(); });

            expect(result.current.workoutName).toBe('Evening Workout');
        });

        it('records the sourceTemplateId when supplied', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Leg Day', 'tpl-123'); });

            expect(result.current.sourceTemplateId).toBe('tpl-123');
        });
    });

    describe('updateWorkoutName', () => {
        it('changes the workout name in place', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Legs'); });
            act(() => { result.current.updateWorkoutName('Leg Day (Heavy)'); });

            expect(result.current.workoutName).toBe('Leg Day (Heavy)');
        });
    });

    describe('cancelWorkout', () => {
        it('resets all state to defaults', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Pull Day', 'tpl-456'); });
            act(() => { result.current.cancelWorkout(); });

            expect(result.current.isActive).toBe(false);
            expect(result.current.workoutName).toBe('New Workout');
            expect(result.current.exercises).toHaveLength(0);
            expect(result.current.startTime).toBeNull();
            expect(result.current.sourceTemplateId).toBeNull();
        });

        it('stores isActive=false so the workout is not resumed on next mount', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Pull Day'); });
            act(() => { result.current.cancelWorkout(); });

            // The save-on-change effect re-writes the key with the cleared state.
            // What matters is that isActive=false so the workout is not restored next load.
            const stored = JSON.parse(localStorage.getItem('ironai_active_workout') || '{}');
            expect(stored.isActive).toBe(false);
        });
    });

    describe('localStorage persistence', () => {
        it('writes active workout to localStorage', () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Saved Workout'); });

            const stored = JSON.parse(localStorage.getItem('ironai_active_workout') || '{}');
            expect(stored.isActive).toBe(true);
            expect(stored.workoutName).toBe('Saved Workout');
        });

        it('restores an in-progress workout from localStorage on mount', () => {
            localStorage.setItem('ironai_active_workout', JSON.stringify({
                isActive: true,
                workoutName: 'Resumed Workout',
                exercises: [],
                startTime: Date.now() - 1_800_000,
                sourceTemplateId: null,
            }));

            const { result } = renderHook(() => useWorkout(), { wrapper });

            expect(result.current.isActive).toBe(true);
            expect(result.current.workoutName).toBe('Resumed Workout');
        });
    });

    describe('finishWorkout', () => {
        it('saves the workout to db.workoutHistory', async () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Test Workout'); });
            await act(async () => { await result.current.finishWorkout(); });

            const history = await db.workoutHistory.toArray();
            expect(history).toHaveLength(1);
            expect(history[0].name).toBe('Test Workout');
        });

        it('resets all state after saving', async () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Quick Workout'); });
            await act(async () => { await result.current.finishWorkout(); });

            expect(result.current.isActive).toBe(false);
            expect(result.current.startTime).toBeNull();
        });

        it('generates a unique id for each saved workout', async () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            act(() => { result.current.startWorkout('Workout A'); });
            await act(async () => { await result.current.finishWorkout(); });

            act(() => { result.current.startWorkout('Workout B'); });
            await act(async () => { await result.current.finishWorkout(); });

            const history = await db.workoutHistory.toArray();
            expect(history).toHaveLength(2);
            expect(history[0].id).not.toBe(history[1].id);
        });

        it('is a no-op if no workout is active', async () => {
            const { result } = renderHook(() => useWorkout(), { wrapper });

            await act(async () => { await result.current.finishWorkout(); });

            const history = await db.workoutHistory.toArray();
            expect(history).toHaveLength(0);
        });
    });
});
