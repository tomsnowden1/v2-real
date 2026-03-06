import type { Exercise } from '../db/database';

export interface ResolutionResult {
    rawName: string;
    status: 'resolved' | 'needs_user';
    confidence: 'high' | 'medium' | 'low';
    exerciseId?: string;
    dbExercise?: Exercise;
    candidates?: Exercise[];
}

export function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Scores how well a candidate text matches a set of query tokens.
 * Used for both exercise names and aliases in the fuzzy tier.
 */
function scoreAgainst(queryTokens: string[], candidateText: string): number {
    const normalizedCandidate = normalize(candidateText);
    const normalizedQuery = queryTokens.join('');
    const candidateTokens = candidateText.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    let score = 0;
    let matchedTokens = 0;
    for (const token of queryTokens) {
        if (candidateTokens.includes(token)) {
            matchedTokens++;
        }
    }

    if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
        score += 10; // Boost for heavy substring overlap
    }

    score += (matchedTokens / Math.max(queryTokens.length, candidateTokens.length)) * 10;

    return score;
}

/**
 * Attempts to intelligently map an AI-suggested exercise name to the canonical database library.
 * Returns a confidence tier so callers can decide whether to auto-accept or ask the user.
 *
 * Tiers:
 *   resolved + high    → exact/alias/parenthetical match, or one dominant fuzzy winner
 *   needs_user + medium → plausible candidates (top score ≥ 4), best guess pre-selected
 *   needs_user + low   → poor/no match, no pre-selection
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
            confidence: 'high',
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
            confidence: 'high',
            exerciseId: withoutParentheticals[0].id,
            dbExercise: withoutParentheticals[0]
        };
    }

    // 3. Fuzzy / Token overlap matching — now includes alias scoring
    const queryTokens = aiName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    const scoredCandidates = allExercises.map(ex => {
        // Score against the exercise name
        const nameScore = scoreAgainst(queryTokens, ex.name);

        // Score against each alias; take the best alias score
        const aliasScore = (ex.aliases || []).reduce((best, alias) => {
            return Math.max(best, scoreAgainst(queryTokens, alias));
        }, 0);

        const score = Math.max(nameScore, aliasScore);

        return { exercise: ex, score };
    }).filter(c => c.score > 2);

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Take top 5 by score, then merge parenthetical matches at the front
    const top5 = scoredCandidates.slice(0, 5).map(c => c.exercise);
    const finalCandidates = [...withoutParentheticals];
    for (const c of top5) {
        if (!finalCandidates.some(ex => ex.id === c.id)) {
            finalCandidates.push(c);
        }
    }
    const candidates = finalCandidates.slice(0, 5);

    // High-confidence auto-resolve: one clear dominant winner
    const topScore = scoredCandidates[0]?.score ?? 0;
    const secondScore = scoredCandidates[1]?.score ?? 0;

    if (topScore >= 8 && (topScore - secondScore) >= 3) {
        return {
            rawName: aiName,
            status: 'resolved',
            confidence: 'high',
            exerciseId: scoredCandidates[0].exercise.id,
            dbExercise: scoredCandidates[0].exercise
        };
    }

    // Determine medium vs low confidence based on whether candidates are plausible
    const confidence = topScore >= 4 ? 'medium' : 'low';

    return {
        rawName: aiName,
        status: 'needs_user',
        confidence,
        candidates
    };
}
