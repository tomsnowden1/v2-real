import { db, type WeeklyPlan, type UserProfile } from './database';

function getStartOfWeek(date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    // In Javascript, 0 is Sunday. Let's make Monday = 0, Sunday = 6.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(d.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

export function getCurrentWeekId(): string {
    const startOfWeek = getStartOfWeek();
    // Example: "2024-05-13" serves as a unique ID for that week
    return `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
}

export async function getCurrentWeeklyPlan(): Promise<WeeklyPlan> {
    const id = getCurrentWeekId();
    const existing = await db.weeklyPlans.get(id);

    if (existing) {
        return existing;
    }

    const newPlan: WeeklyPlan = {
        id,
        weekStartDate: getStartOfWeek().getTime(),
        targetTemplateIds: [],
        dayAssignments: Array(7).fill({ templateId: null }),
        completedWorkouts: [],
        hasCheckedIn: false
    };

    await db.weeklyPlans.put(newPlan);
    return newPlan;
}

export async function setTargetTemplates(templateIds: string[]): Promise<void> {
    const plan = await getCurrentWeeklyPlan();
    await db.weeklyPlans.update(plan.id, { targetTemplateIds: templateIds });
}

export async function assignTemplateToDay(dayIndex: number, templateId: string | null): Promise<void> {
    const plan = await getCurrentWeeklyPlan();
    const newAssignments = [...(plan.dayAssignments || Array(7).fill({ templateId: null }))];
    newAssignments[dayIndex] = { ...newAssignments[dayIndex], templateId };
    await db.weeklyPlans.update(plan.id, { dayAssignments: newAssignments });
}

export async function addCompletedWorkoutToWeek(workoutId: string): Promise<void> {
    const plan = await getCurrentWeeklyPlan();

    const updates: Partial<WeeklyPlan> = {};
    if (!plan.completedWorkouts.includes(workoutId)) {
        updates.completedWorkouts = [...plan.completedWorkouts, workoutId];
    }

    // Try to map to today's day (0-6)
    const todayIndex = (new Date().getDay() + 6) % 7;
    const currentAssignments = plan.dayAssignments || Array(7).fill({ templateId: null });

    // If today had a template, mark it done.
    if (currentAssignments[todayIndex].templateId && !currentAssignments[todayIndex].completedWorkoutId) {
        const newAssignments = [...currentAssignments];
        newAssignments[todayIndex] = { ...newAssignments[todayIndex], completedWorkoutId: workoutId };
        updates.dayAssignments = newAssignments;
    }

    if (Object.keys(updates).length > 0) {
        await db.weeklyPlans.update(plan.id, updates);
    }
}

export async function markDayCompleted(dayIndex: number, workoutId: string): Promise<void> {
    const plan = await getCurrentWeeklyPlan();
    const newAssignments = [...(plan.dayAssignments || Array(7).fill({ templateId: null }))];
    newAssignments[dayIndex] = { ...newAssignments[dayIndex], completedWorkoutId: workoutId };
    await db.weeklyPlans.update(plan.id, { dayAssignments: newAssignments });
}

export async function setWeekCheckedIn(): Promise<void> {
    const plan = await getCurrentWeeklyPlan();
    await db.weeklyPlans.update(plan.id, { hasCheckedIn: true });
}

// ── Accountability Architect: Block Week Context ───────────────────────────────

/**
 * Pure function (no DB call). Returns the volume multiplier and metadata
 * for the user's current position in their 6-week training block.
 *
 * Week schedule:
 *   Week 1        → Intro / Adaptation  (0.80x volume)
 *   Weeks 2-3     → Building            (1.00x volume)
 *   Weeks 4-5     → Peak                (1.15x volume)
 *   Week 6        → Deload / Recovery   (0.70x volume)
 */
export function getBlockWeekContext(profile: UserProfile): {
    currentBlockWeek: number;
    volumeMultiplier: number;
    isIntroWeek: boolean;
    isPeakWeek: boolean;
    isDeloadWeek: boolean;
} {
    const week = profile.currentBlockWeek ?? 1;
    let multiplier = 1.0;
    if (week === 1) multiplier = 0.80;
    else if (week <= 3) multiplier = 1.00;
    else if (week <= 5) multiplier = 1.15;
    else multiplier = 0.70;

    return {
        currentBlockWeek: week,
        volumeMultiplier: multiplier,
        isIntroWeek: week === 1,
        isPeakWeek: week === 4 || week === 5,
        isDeloadWeek: week >= 6,
    };
}

// ── Accountability Architect: Weekly Score ─────────────────────────────────────

/**
 * Calculate and persist the Weekly Score for the given week.
 * Starts at 100 and deducts 15 points per planned-but-missed day that has
 * already passed without a recovery completion.
 * Returns the final score (floor 0).
 */
export async function calculateWeeklyScore(weekId: string): Promise<number> {
    const plan = await db.weeklyPlans.get(weekId);
    if (!plan) return 100;

    // Day index 0 = Monday, 6 = Sunday. getDay() returns 0=Sun,1=Mon,...
    const todayIndex = (new Date().getDay() + 6) % 7;
    let score = 100;

    plan.dayAssignments.forEach((day, idx) => {
        const isPastDay = idx < todayIndex;
        const wasPlanned = day.templateId !== null;
        const wasCompleted = !!day.completedWorkoutId;

        if (isPastDay && wasPlanned && !wasCompleted) {
            score -= 15; // missed day penalty
        }
    });

    const finalScore = Math.max(0, score);
    await db.weeklyPlans.update(weekId, { weeklyScore: finalScore });
    return finalScore;
}

// ── Accountability Architect: Shift Logic ──────────────────────────────────────

/**
 * If any past-due day has a templateId but no completedWorkoutId,
 * this function shifts its assignment forward to the next available rest slot
 * within the same week. Conservative: never shifts across week boundaries.
 */
export async function applyShiftLogic(weekId: string): Promise<void> {
    const plan = await db.weeklyPlans.get(weekId);
    if (!plan) return;

    const todayIndex = (new Date().getDay() + 6) % 7;
    const assignments = [...plan.dayAssignments];

    for (let idx = 0; idx < todayIndex; idx++) {
        const day = assignments[idx];
        if (!day.templateId || day.completedWorkoutId) continue;

        // Find the next available rest slot after today
        for (let fwd = Math.max(idx + 1, todayIndex); fwd < 7; fwd++) {
            if (!assignments[fwd].templateId) {
                // Shift missed template to this rest slot
                assignments[fwd] = { templateId: day.templateId };
                assignments[idx] = { templateId: null }; // clear original
                break;
            }
        }
    }

    await db.weeklyPlans.update(weekId, { dayAssignments: assignments });
}

// ── Accountability Architect: Recovery ────────────────────────────────────────

/**
 * Called when a user completes a workout on a day that was shifted from a missed day.
 * Marks the day completed and applies a +10 recovery bonus to the weekly score.
 */
export async function recoverMissedDay(weekId: string, dayIndex: number, workoutId: string): Promise<void> {
    const plan = await db.weeklyPlans.get(weekId);
    if (!plan) return;

    const newAssignments = [...plan.dayAssignments];
    newAssignments[dayIndex] = { ...newAssignments[dayIndex], completedWorkoutId: workoutId };

    const completedWorkouts = plan.completedWorkouts.includes(workoutId)
        ? plan.completedWorkouts
        : [...plan.completedWorkouts, workoutId];

    // Recalculate score and apply recovery bonus (cap at 100)
    const baseScore = plan.weeklyScore ?? 100;
    const recoveredScore = Math.min(100, baseScore + 10);

    await db.weeklyPlans.update(weekId, {
        dayAssignments: newAssignments,
        completedWorkouts,
        weeklyScore: recoveredScore,
    });
}
