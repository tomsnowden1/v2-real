import { db, type WeeklyPlan } from './database';

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
