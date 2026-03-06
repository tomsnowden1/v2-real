import { db, type Exercise } from '../db/database';
import { generateId } from '../lib/id';
import { normalize } from '../lib/exerciseResolver';

export function getAllExercises(): Promise<Exercise[]> {
    return db.exercises.toArray();
}

/**
 * Multi-field substring search across name, aliases, bodyPart, and category.
 * Returns all exercises for an empty query.
 */
export async function searchExercises(query: string): Promise<Exercise[]> {
    const all = await getAllExercises();
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(ex =>
        ex.name.toLowerCase().includes(q) ||
        ex.bodyPart.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        (ex.aliases || []).some(a => a.toLowerCase().includes(q))
    );
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

/**
 * Builds a compact exercise catalog string grouped by category.
 * Passed to the AI coach so it can reference exact canonical exercise names.
 * ~300 tokens for 204 exercises.
 */
export function buildExerciseCatalogContext(exercises: Exercise[]): string {
    const byCategory: Record<string, string[]> = {};
    for (const ex of exercises) {
        if (!byCategory[ex.category]) byCategory[ex.category] = [];
        byCategory[ex.category].push(ex.name);
    }
    const lines = Object.entries(byCategory).map(
        ([cat, names]) => `${cat}: ${names.join(', ')}`
    );
    return `EXERCISE LIBRARY — use these exact names when suggesting exercises:\n${lines.join('\n')}`;
}
