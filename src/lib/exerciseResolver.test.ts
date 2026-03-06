import { describe, it, expect } from 'vitest';
import { resolveExerciseName, normalize } from './exerciseResolver';
import type { Exercise } from '../db/database';

const mockExercises: Exercise[] = [
    { id: '1', name: 'Deadlift (Barbell)', category: 'Barbell', bodyPart: 'Back', isCustom: false, userNotes: '' },
    { id: '2', name: 'Dumbbell Bench Press', category: 'Dumbbell', bodyPart: 'Chest', isCustom: false, userNotes: '' },
    { id: '3', name: 'Pull Up', aliases: ['pullups', 'pull-ups'], category: 'Bodyweight', bodyPart: 'Back', isCustom: false, userNotes: '' },
    { id: '4', name: 'Bench Press (Barbell)', category: 'Barbell', bodyPart: 'Chest', isCustom: false, userNotes: '' },
    { id: '5', name: 'Bench Press (Dumbbell)', category: 'Dumbbell', bodyPart: 'Chest', isCustom: false, userNotes: '' },
    { id: '6', name: 'Squat (Barbell)', category: 'Barbell', bodyPart: 'Legs', isCustom: false, userNotes: '' },
    { id: '7', name: 'Romanian Deadlift', category: 'Barbell', bodyPart: 'Legs', isCustom: false, userNotes: '' },
];

// ─── normalize helper ─────────────────────────────────────────────────────────

describe('normalize', () => {
    it('lowercases and strips all non-alphanumeric characters', () => {
        expect(normalize('Bench Press (Barbell)')).toBe('benchpressbarbell');
    });

    it('strips dashes and underscores', () => {
        expect(normalize('pull-ups')).toBe('pullups');
    });

    it('handles empty string', () => {
        expect(normalize('')).toBe('');
    });
});

// ─── Original tests (preserved) ───────────────────────────────────────────────

describe('exerciseResolver', () => {
    it('resolves exactly matched known exercise', () => {
        const result = resolveExerciseName('Dumbbell Bench Press', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('2');
    });

    it('resolves exactly matched aliases', () => {
        const result = resolveExerciseName('pullups', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('3');
    });

    it('resolves base name matching without parentheticals', () => {
        const result = resolveExerciseName('Deadlift', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('1');
    });

    it('returns needs_user with candidates for partial/ambiguous matches', () => {
        const result = resolveExerciseName('Bench Press', mockExercises);
        expect(result.status).toBe('needs_user');
        expect(result.candidates?.length).toBeGreaterThan(0);
        expect(result.candidates?.map(c => c.id)).toContain('4');
    });

    it('handles garbage / completely unknown exercises', () => {
        const result = resolveExerciseName('Bosu Ball Squat Jumps', mockExercises);
        expect(result.status).toBe('needs_user');
        expect(result.rawName).toBe('Bosu Ball Squat Jumps');
    });
});

// ─── Extended edge-case tests ─────────────────────────────────────────────────

describe('resolveExerciseName — case insensitivity', () => {
    it('resolves name match when AI shouts in ALL CAPS', () => {
        const result = resolveExerciseName('DUMBBELL BENCH PRESS', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('2');
    });

    it('resolves alias match case-insensitively (PULL-UPS → Pull Up)', () => {
        const result = resolveExerciseName('PULL-UPS', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('3');
    });
});

describe('resolveExerciseName — parenthetical stripping', () => {
    it('resolves uniquely when only one exercise strips to the base name', () => {
        const result = resolveExerciseName('Romanian Deadlift', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('7');
    });

    it('returns needs_user when multiple exercises share the same base name', () => {
        const result = resolveExerciseName('Bench Press', mockExercises);
        expect(result.status).toBe('needs_user');
        const ids = result.candidates?.map(c => c.id) ?? [];
        // Both Barbell and Dumbbell variants should be candidates
        expect(ids).toContain('4');
        expect(ids).toContain('5');
    });
});

describe('resolveExerciseName — empty / edge inputs', () => {
    it('returns needs_user with no candidates against an empty database', () => {
        const result = resolveExerciseName('Squat', []);
        expect(result.status).toBe('needs_user');
        expect(result.candidates?.length ?? 0).toBe(0);
    });

    it('caps candidates at 5 even with many partial matches', () => {
        const bigDb: Exercise[] = Array.from({ length: 20 }, (_, i) => ({
            id: `ex-${i}`,
            name: `Bench Press Variant ${i}`,
            category: 'Barbell',
            bodyPart: 'Chest',
            isCustom: false,
            userNotes: '',
        }));
        const result = resolveExerciseName('Bench Press', bigDb);
        expect(result.candidates?.length).toBeLessThanOrEqual(5);
    });
});

describe('resolveExerciseName — rawName passthrough', () => {
    it('always preserves the original input string in rawName', () => {
        const input = '  Barbell Row  ';
        const trimmedInput = '  Barbell Row  ';
        const result = resolveExerciseName(trimmedInput, mockExercises);
        expect(result.rawName).toBe(input);
    });
});

// ─── New: confidence tier ─────────────────────────────────────────────────────

describe('resolveExerciseName — confidence field', () => {
    it('all exact/alias/parenthetical matches have confidence: high', () => {
        const exact = resolveExerciseName('Dumbbell Bench Press', mockExercises);
        expect(exact.confidence).toBe('high');

        const alias = resolveExerciseName('pullups', mockExercises);
        expect(alias.confidence).toBe('high');

        const paren = resolveExerciseName('Deadlift', mockExercises);
        expect(paren.confidence).toBe('high');
    });

    it('Romanian Deadlift auto-resolves with high confidence (unique clear winner)', () => {
        const result = resolveExerciseName('Romanian Deadlift', mockExercises);
        expect(result.status).toBe('resolved');
        expect(result.confidence).toBe('high');
        expect(result.exerciseId).toBe('7');
    });

    it('does NOT auto-resolve Bench Press — two candidates score similarly', () => {
        const result = resolveExerciseName('Bench Press', mockExercises);
        expect(result.status).toBe('needs_user');
        // Confidence may be medium since candidates are plausible
        expect(['medium', 'low']).toContain(result.confidence);
    });
});

// ─── New: alias fuzzy scoring ─────────────────────────────────────────────────

describe('resolveExerciseName — alias fuzzy scoring', () => {
    it('resolves or surfaces a near-alias phrase via alias scoring', () => {
        const exercises: Exercise[] = [{
            id: 'lat1',
            name: 'Lat Pulldown (Cable)',
            aliases: ['lat pulldown', 'lat pull'],
            category: 'Cable',
            bodyPart: 'Back',
            isCustom: false,
            userNotes: ''
        }];
        const result = resolveExerciseName('Lat Pulldowns', exercises);
        // Should either auto-resolve or surface lat1 as top candidate
        const resolvedOrTop = result.exerciseId === 'lat1' || result.candidates?.[0]?.id === 'lat1';
        expect(resolvedOrTop).toBe(true);
    });

    it('scores aliases so a phrase matching an alias wins over unrelated exercises', () => {
        const exercises: Exercise[] = [
            {
                id: 'bc1',
                name: 'Bicep Curl (Dumbbell)',
                aliases: ['bicep curl', 'dumbbell curl'],
                category: 'Dumbbell',
                bodyPart: 'Arms',
                isCustom: false,
                userNotes: ''
            },
            {
                id: 'unrelated',
                name: 'Leg Press (Machine)',
                aliases: [],
                category: 'Machine',
                bodyPart: 'Legs',
                isCustom: false,
                userNotes: ''
            }
        ];
        const result = resolveExerciseName('Bicep Curl', exercises);
        // bc1 should either be resolved or top candidate
        const bc1IsTop = result.exerciseId === 'bc1' || result.candidates?.[0]?.id === 'bc1';
        expect(bc1IsTop).toBe(true);
    });
});

// ─── New: remembered alias reuse ──────────────────────────────────────────────

describe('resolveExerciseName — remembered alias reuse', () => {
    it('resolves after user confirmed alias was added', () => {
        // Simulates: user confirmed "Bicep Curl" → "Bicep Curl (Dumbbell)" and checked "Remember"
        // addAliasToExercise added "Bicep Curl" to the exercise aliases
        const exercises: Exercise[] = [{
            id: 'bc1',
            name: 'Bicep Curl (Dumbbell)',
            aliases: ['Bicep Curl'], // persisted from prior confirmation
            category: 'Dumbbell',
            bodyPart: 'Arms',
            isCustom: false,
            userNotes: ''
        }];
        const result = resolveExerciseName('Bicep Curl', exercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('bc1');
        expect(result.confidence).toBe('high');
    });

    it('normalize ensures alias "Bicep Curl" matches query "bicep curl"', () => {
        const exercises: Exercise[] = [{
            id: 'bc1',
            name: 'Bicep Curl (Dumbbell)',
            aliases: ['Bicep Curl'],
            category: 'Dumbbell',
            bodyPart: 'Arms',
            isCustom: false,
            userNotes: ''
        }];
        // lowercase variation — normalize strips case so this still resolves
        const result = resolveExerciseName('bicep curl', exercises);
        expect(result.status).toBe('resolved');
        expect(result.exerciseId).toBe('bc1');
    });
});
