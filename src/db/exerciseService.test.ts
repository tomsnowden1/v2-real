import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database';
import { searchExercises, buildExerciseCatalogContext } from './exerciseService';
import type { Exercise } from './database';

const sampleExercises: Exercise[] = [
    {
        id: 'ex-1',
        name: 'Bench Press (Barbell)',
        category: 'Barbell',
        bodyPart: 'Chest',
        isCustom: false,
        userNotes: '',
        aliases: ['bench', 'bench press'],
        primaryMuscle: 'Chest',
    },
    {
        id: 'ex-2',
        name: 'Pull Up',
        category: 'Bodyweight',
        bodyPart: 'Back',
        isCustom: false,
        userNotes: '',
        aliases: ['pullups', 'pull-ups', 'chin ups'],
    },
    {
        id: 'ex-3',
        name: 'Bicep Curl (Dumbbell)',
        category: 'Dumbbell',
        bodyPart: 'Arms',
        isCustom: false,
        userNotes: '',
        aliases: ['bicep curl', 'dumbbell curl'],
    },
    {
        id: 'ex-4',
        name: 'Lat Pulldown (Cable)',
        category: 'Cable',
        bodyPart: 'Back',
        isCustom: false,
        userNotes: '',
        aliases: ['lat pulldown', 'lat pull'],
    },
    {
        id: 'ex-5',
        name: 'Custom Squat',
        category: 'Custom',
        bodyPart: 'Legs',
        isCustom: true,
        userNotes: '',
    },
];

beforeEach(async () => {
    await db.exercises.clear();
    await db.exercises.bulkAdd(sampleExercises as Exercise[]);
});

// ─── searchExercises — multi-field ───────────────────────────────────────────

describe('searchExercises — multi-field matching', () => {
    it('returns all exercises for an empty query', async () => {
        const results = await searchExercises('');
        expect(results.length).toBe(sampleExercises.length);
    });

    it('finds exercise by exact name substring', async () => {
        const results = await searchExercises('Bench Press');
        expect(results.map(r => r.id)).toContain('ex-1');
    });

    it('finds exercise by partial name (case-insensitive)', async () => {
        const results = await searchExercises('bench press');
        expect(results.map(r => r.id)).toContain('ex-1');
    });

    it('finds exercise by alias substring', async () => {
        const results = await searchExercises('pullups');
        expect(results.map(r => r.id)).toContain('ex-2');
    });

    it('finds exercise by partial alias', async () => {
        const results = await searchExercises('chin ups');
        expect(results.map(r => r.id)).toContain('ex-2');
    });

    it('finds exercise by bodyPart', async () => {
        const results = await searchExercises('Back');
        const ids = results.map(r => r.id);
        expect(ids).toContain('ex-2');  // Pull Up — Back
        expect(ids).toContain('ex-4');  // Lat Pulldown — Back
    });

    it('finds exercise by category', async () => {
        const results = await searchExercises('Dumbbell');
        expect(results.map(r => r.id)).toContain('ex-3');
    });

    it('finds exercise by category (case-insensitive)', async () => {
        const results = await searchExercises('cable');
        expect(results.map(r => r.id)).toContain('ex-4');
    });

    it('returns empty array when nothing matches', async () => {
        const results = await searchExercises('xyznotreal999');
        expect(results.length).toBe(0);
    });

    it('does NOT return results that only partially match field boundaries', async () => {
        // "Chest" is a bodyPart — should return bench press; should NOT return Pull Up
        const results = await searchExercises('Chest');
        const ids = results.map(r => r.id);
        expect(ids).toContain('ex-1');
        expect(ids).not.toContain('ex-2');
    });
});

// ─── buildExerciseCatalogContext ─────────────────────────────────────────────

describe('buildExerciseCatalogContext', () => {
    it('includes all category groups', () => {
        const catalog = buildExerciseCatalogContext(sampleExercises);
        expect(catalog).toContain('Barbell:');
        expect(catalog).toContain('Bodyweight:');
        expect(catalog).toContain('Dumbbell:');
        expect(catalog).toContain('Cable:');
    });

    it('includes exercise names within their category', () => {
        const catalog = buildExerciseCatalogContext(sampleExercises);
        expect(catalog).toContain('Bench Press (Barbell)');
        expect(catalog).toContain('Pull Up');
    });

    it('starts with the instruction header', () => {
        const catalog = buildExerciseCatalogContext(sampleExercises);
        expect(catalog).toMatch(/^EXERCISE LIBRARY/);
    });

    it('returns a non-empty string for empty exercise list', () => {
        const catalog = buildExerciseCatalogContext([]);
        expect(typeof catalog).toBe('string');
    });
});
