import type { WorkoutHistory, UserProfile, WorkoutExercise } from '../db/database';
import { db } from '../db/database';
import { getCurrentWeeklyPlan } from '../db/weeklyPlanService';

export interface ScoreBreakdown {
    overall: number;
    consistency: number;
    progression: number;
    quality: number;
}

// Helper: Calculate Volume Load
export function getVolumeLoad(ex: WorkoutExercise): number {
    return ex.sets.reduce((total, set) => {
        if (!set.isDone) return total;
        // if weight is 0 (e.g. bodyweight), we just count the reps as the load proxy
        const load = set.weight > 0 ? set.weight * set.reps : set.reps;
        return total + load;
    }, 0);
}

// Helper: Calculate Estimated 1RM (Epley Formula)
export function getEstimated1RM(ex: WorkoutExercise): number {
    let max1RM = 0;
    ex.sets.forEach(set => {
        if (!set.isDone || set.weight === 0 || set.reps === 0) return;
        // Epley Formula: W * (1 + R / 30)
        const e1rm = set.weight * (1 + set.reps / 30);
        if (e1rm > max1RM) max1RM = e1rm;
    });
    return max1RM;
}

export async function calculateWorkoutScore(
    currentWorkout: Omit<WorkoutHistory, 'id'>, // ID might not be assigned yet when computing before save
    userProfile: UserProfile
): Promise<ScoreBreakdown> {

    // --- 1. CONSISTENCY (0-100) ---
    // How well are they adhering to the weekly goal?
    let consistency = 0;
    try {
        const plan = await getCurrentWeeklyPlan();
        // If they have no target, default to 100 for just showing up
        if (plan.targetTemplateIds.length === 0) {
            consistency = 100;
        } else {
            // Count this workout as +1 since it's about to be saved
            const completedCount = plan.completedWorkouts.length + 1;
            consistency = Math.min(100, Math.round((completedCount / plan.targetTemplateIds.length) * 100));
        }
    } catch (e) {
        console.error("Failed to calculate consistency score", e);
        consistency = 85; // Fallback "good" score
    }

    // --- 2. QUALITY (0-100) ---
    // Did they do all the sets they planned to do?
    let quality = 0;
    let totalPlannedSets = 0;
    let totalCompletedSets = 0;

    currentWorkout.exercises.forEach(ex => {
        ex.sets.forEach(set => {
            totalPlannedSets++;
            if (set.isDone) totalCompletedSets++;
        });
    });

    if (totalPlannedSets === 0) {
        quality = 100; // Empty workout? High quality for showing up I guess.
    } else {
        quality = Math.round((totalCompletedSets / totalPlannedSets) * 100);
    }

    // --- 3. PROGRESSION (0-100) ---
    // Did they improve on their key lift compared to last time?
    let progression = 85; // Baseline for new exercises

    if (currentWorkout.exercises.length > 0) {
        // Find the first main compound lift. (Normally we'd check category='Barbell' etc, but for V1 we just take the first exercise as the "Key Lift")
        const keyLift = currentWorkout.exercises[0];

        // Find the last time they did THIS exercise
        const previousWorkouts = await db.workoutHistory
            .orderBy('startTime')
            .reverse()
            .toArray();

        let previousKeyLiftInstance: WorkoutExercise | undefined;

        // Search backwards through history
        for (const pw of previousWorkouts) {
            const found = pw.exercises.find(e => e.exerciseId === keyLift.exerciseId);
            if (found) {
                previousKeyLiftInstance = found;
                break;
            }
        }

        if (previousKeyLiftInstance) {
            const goal = userProfile.goal;
            let currentMetric = 0;
            let previousMetric = 0;

            if (goal === 'Strength') {
                currentMetric = getEstimated1RM(keyLift);
                previousMetric = getEstimated1RM(previousKeyLiftInstance);
            } else {
                // Hypertrophy, Consistency, Fat Loss all use Volume base proxy for progression here
                currentMetric = getVolumeLoad(keyLift);
                previousMetric = getVolumeLoad(previousKeyLiftInstance);
            }

            // Progression Logic
            if (previousMetric === 0) {
                progression = 85; // Previous was empty/0
            } else if (currentMetric > previousMetric) {
                progression = 100; // Improved!
            } else if (currentMetric === previousMetric) {
                progression = 85; // Maintained
            } else {
                // Regressed. Calculate how much they dropped off, floor at 50
                const ratio = currentMetric / previousMetric;
                progression = Math.max(50, Math.round(ratio * 100));
            }
        } else {
            // First time doing this exercise
            progression = 85;
        }
    }


    // --- 4. OVERALL WEIGHTING ---
    let overall = 0;
    const goal = userProfile.goal;

    if (goal === 'Strength') {
        overall = (progression * 0.45) + (consistency * 0.35) + (quality * 0.20);
    } else if (goal === 'Hypertrophy') {
        overall = (quality * 0.45) + (progression * 0.35) + (consistency * 0.20);
    } else if (goal === 'Fat loss/Conditioning') {
        overall = (quality * 0.50) + (consistency * 0.50);
    } else {
        // Consistency/Newborn
        overall = (consistency * 0.70) + (quality * 0.30);
    }

    return {
        overall: Math.round(overall),
        consistency,
        progression,
        quality
    };
}
