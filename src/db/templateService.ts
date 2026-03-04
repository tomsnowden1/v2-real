import { db, type Template, type WorkoutExercise } from './database';
import { generateId } from '../lib/id';

export async function getAllTemplates(): Promise<Template[]> {
    return await db.templates.toArray();
}

export async function getTemplate(id: string): Promise<Template | undefined> {
    return await db.templates.get(id);
}

export async function saveAsTemplate(name: string, exercises: WorkoutExercise[]): Promise<Template> {
    const template: Template = {
        id: `tpl-${generateId()}`,
        name,
        exercises,
        lastPerformed: undefined
    };

    await db.templates.add(template);
    return template;
}

export async function deleteTemplate(id: string): Promise<void> {
    await db.templates.delete(id);
}

/**
 * Update only the set values (weight/reps) in the template's existing exercises.
 * Preserves the exercise list — only syncs values for exercises that exist in both.
 */
export async function updateTemplateValues(id: string, workoutExercises: WorkoutExercise[]): Promise<void> {
    const template = await db.templates.get(id);
    if (!template) return;

    const updatedExercises = template.exercises.map(tplEx => {
        const matchingWorkoutEx = workoutExercises.find(we => we.exerciseId === tplEx.exerciseId);
        if (matchingWorkoutEx) {
            // Keep the template's exercise structure but update set values
            return {
                ...tplEx,
                sets: matchingWorkoutEx.sets.map(s => ({
                    ...s,
                    isDone: false // Reset done state for template
                }))
            };
        }
        return tplEx;
    });

    await db.templates.update(id, { exercises: updatedExercises, lastPerformed: Date.now() });
}

/**
 * Replace the template's exercise list entirely with the current workout's exercises and values.
 */
export async function updateTemplateExercisesAndValues(id: string, workoutExercises: WorkoutExercise[]): Promise<void> {
    const cleanedExercises = workoutExercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
            ...s,
            isDone: false // Reset done state for template
        }))
    }));

    await db.templates.update(id, { exercises: cleanedExercises, lastPerformed: Date.now() });
}
