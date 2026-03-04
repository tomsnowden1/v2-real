import type { Exercise } from '../db/database';

export interface ResolutionResult {
    rawName: string;
    status: 'resolved' | 'needs_user';
    exerciseId?: string;
    dbExercise?: Exercise;
    candidates?: Exercise[];
}

export function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Attempts to intelligently map an AI-suggested exercise name to the canonical database library.
 * Useful for preventing the silent creation of duplicate "Custom" exercises.
 */
export function resolveExerciseName(
    aiName: string,
    allExercises: Exercise[]
): ResolutionResult {
    const normalizedTarget = normalize(aiName);

    // 1. Exact Name/Alias Match
    const exactMatch = allExercises.find(ex => {
        if (normalize(ex.name) === normalizedTarget) return true;
        if (ex.aliases && ex.aliases.some(alias => normalize(alias) === normalizedTarget)) return true;
        return false;
    });

    if (exactMatch) {
        return {
            rawName: aiName,
            status: 'resolved',
            exerciseId: exactMatch.id,
            dbExercise: exactMatch
        };
    }

    // 2. Exact match WITHOUT parentheticals 
    // e.g. "Deadlift (Barbell)" -> "deadlift". If AI said "Deadlift", it should match.
    const withoutParentheticals = allExercises.filter(ex => {
        const nameNoParen = normalize(ex.name.replace(/\(.*?\)/g, ''));
        return nameNoParen === normalizedTarget;
    });

    // If exactly ONE canonical match strips down to the AI's requested base name
    if (withoutParentheticals.length === 1) {
        return {
            rawName: aiName,
            status: 'resolved',
            exerciseId: withoutParentheticals[0].id,
            dbExercise: withoutParentheticals[0]
        };
    }

    // 3. Fuzzy / Token overlap matching for candidates
    const tokens = aiName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    const scoredCandidates = allExercises.map(ex => {
        const exNameNorm = normalize(ex.name);
        const exNameTokens = ex.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

        let score = 0;
        let matchedTokens = 0;
        for (const token of tokens) {
            if (exNameTokens.includes(token)) {
                matchedTokens++;
            }
        }

        if (exNameNorm.includes(normalizedTarget) || normalizedTarget.includes(exNameNorm)) {
            score += 10; // Boost for heavy substring overlap
        }

        score += (matchedTokens / Math.max(tokens.length, exNameTokens.length)) * 10;

        return { exercise: ex, score };
    }).filter(c => c.score > 2);

    scoredCandidates.sort((a, b) => b.score - a.score);
    const candidates = scoredCandidates.slice(0, 3).map(c => c.exercise);

    // If we had parenthetical matches but there were multiple (e.g. DB Bench and BB Bench), 
    // ensure they are at the top of the candidates list
    const finalCandidates = [...withoutParentheticals];
    for (const c of candidates) {
        if (!finalCandidates.some(ex => ex.id === c.id)) {
            finalCandidates.push(c);
        }
    }

    return {
        rawName: aiName,
        status: 'needs_user',
        candidates: finalCandidates.slice(0, 5) // keep it concise
    };
}
