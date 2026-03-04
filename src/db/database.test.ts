import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database';

// The db singleton uses fake-indexeddb (polyfilled in src/test/setup.ts).
// These tests verify that the v11 (chatMessages) and v12 (restTimerPrefs)
// schema additions are present and behave correctly.

beforeEach(async () => {
    await db.chatMessages.clear();
    await db.restTimerPrefs.clear();
});

// ─── Schema presence ──────────────────────────────────────────────────────────

describe('database schema', () => {
    it('has a chatMessages table (added in v11)', () => {
        const tableNames = db.tables.map(t => t.name);
        expect(tableNames).toContain('chatMessages');
    });

    it('has a restTimerPrefs table (added in v12)', () => {
        const tableNames = db.tables.map(t => t.name);
        expect(tableNames).toContain('restTimerPrefs');
    });
});

// ─── chatMessages CRUD ────────────────────────────────────────────────────────

describe('chatMessages table', () => {
    it('stores and retrieves a message by id', async () => {
        await db.chatMessages.add({
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: 1000,
        });

        const msg = await db.chatMessages.get('msg-1');
        expect(msg?.role).toBe('user');
        expect(msg?.content).toBe('Hello');
        expect(msg?.timestamp).toBe(1000);
    });

    it('stores both user and assistant roles', async () => {
        await db.chatMessages.bulkAdd([
            { id: 'u1', role: 'user',      content: 'Question', timestamp: 1000 },
            { id: 'a1', role: 'assistant', content: 'Answer',   timestamp: 2000 },
        ]);

        const user = await db.chatMessages.get('u1');
        const assistant = await db.chatMessages.get('a1');
        expect(user?.role).toBe('user');
        expect(assistant?.role).toBe('assistant');
    });

    it('returns messages in timestamp order when sorted', async () => {
        await db.chatMessages.bulkAdd([
            { id: 'c', role: 'user', content: 'Third',  timestamp: 3000 },
            { id: 'a', role: 'user', content: 'First',  timestamp: 1000 },
            { id: 'b', role: 'user', content: 'Second', timestamp: 2000 },
        ]);

        const ordered = await db.chatMessages.orderBy('timestamp').toArray();
        expect(ordered.map(m => m.content)).toEqual(['First', 'Second', 'Third']);
    });

    it('clears all messages', async () => {
        await db.chatMessages.bulkAdd([
            { id: 'm1', role: 'user', content: 'A', timestamp: 1 },
            { id: 'm2', role: 'user', content: 'B', timestamp: 2 },
        ]);

        await db.chatMessages.clear();
        const count = await db.chatMessages.count();
        expect(count).toBe(0);
    });

    it('bulkPut does not duplicate on re-insert of the same id', async () => {
        await db.chatMessages.add({ id: 'dup', role: 'user', content: 'Original', timestamp: 1 });
        await db.chatMessages.bulkPut([{ id: 'dup', role: 'assistant', content: 'Updated', timestamp: 2 }]);

        const all = await db.chatMessages.toArray();
        expect(all).toHaveLength(1);
        expect(all[0].content).toBe('Updated');
    });
});

// ─── restTimerPrefs CRUD ──────────────────────────────────────────────────────

describe('restTimerPrefs table', () => {
    it('stores a per-exercise duration by exerciseId primary key', async () => {
        await db.restTimerPrefs.put({ exerciseId: 'ex-squat', durationSecs: 120 });

        const pref = await db.restTimerPrefs.get('ex-squat');
        expect(pref?.durationSecs).toBe(120);
    });

    it('overwrites (upserts) an existing preference on put', async () => {
        await db.restTimerPrefs.put({ exerciseId: 'ex-bench', durationSecs: 90 });
        await db.restTimerPrefs.put({ exerciseId: 'ex-bench', durationSecs: 150 });

        const all = await db.restTimerPrefs.toArray();
        expect(all).toHaveLength(1);
        expect(all[0].durationSecs).toBe(150);
    });

    it('stores independent preferences per exercise', async () => {
        await db.restTimerPrefs.bulkPut([
            { exerciseId: 'ex-squat',  durationSecs: 180 },
            { exerciseId: 'ex-bench',  durationSecs: 90  },
            { exerciseId: 'ex-curl',   durationSecs: 60  },
        ]);

        const squat = await db.restTimerPrefs.get('ex-squat');
        const bench = await db.restTimerPrefs.get('ex-bench');
        expect(squat?.durationSecs).toBe(180);
        expect(bench?.durationSecs).toBe(90);
    });

    it('returns undefined for an unknown exerciseId', async () => {
        const pref = await db.restTimerPrefs.get('ex-nonexistent');
        expect(pref).toBeUndefined();
    });
});
