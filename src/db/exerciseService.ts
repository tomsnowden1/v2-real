import { db, type Exercise } from '../db/database';
import { generateId } from '../lib/id';

export function getAllExercises(): Promise<Exercise[]> {
    return db.exercises.toArray();
}

export function searchExercises(query: string): Promise<Exercise[]> {
    return db.exercises
        .where('name')
        .startsWithIgnoreCase(query)
        .toArray();
}

export function addExercise(exercise: Exercise): Promise<string> {
    return db.exercises.add(exercise);
}

export function updateExercise(id: string, modifications: Partial<Exercise>) {
    return db.exercises.update(id, modifications);
}

export async function addAliasToExercise(id: string, newAlias: string): Promise<void> {
    const ex = await db.exercises.get(id);
    if (!ex) return;
    const aliases = ex.aliases || [];
    if (!aliases.includes(newAlias)) {
        await db.exercises.update(id, { aliases: [...aliases, newAlias] });
    }
}

function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function findOrCreateExerciseByName(name: string): Promise<Exercise> {
    const allExercises = await getAllExercises();
    const normalizedTarget = normalize(name);

    // Try to find exact match or alias match
    const match = allExercises.find(ex => {
        if (normalize(ex.name) === normalizedTarget) return true;
        if (ex.aliases && ex.aliases.some(alias => normalize(alias) === normalizedTarget)) return true;
        return false;
    });

    if (match) return match;

    // No match found, create a new custom exercise
    const newEx: Exercise = {
        id: `ex-custom-${generateId()}`,
        name: name, // Preserve original capitalization from AI for the display name
        category: 'Custom',
        bodyPart: 'Unknown',
        userNotes: '',
        isCustom: true,
        aliases: []
    };

    await addExercise(newEx);
    return newEx;
}
