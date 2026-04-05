/**
 * auraBrainManager unit tests
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 4.1, 4.2, 4.6, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sync,
  isDirty,
  computeContentHash,
  getState,
  _resetStateForTesting,
} from './auraBrainManager';
import type { Document } from '../types/document';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    title: 'Test Intent',
    content: 'Hello world',
    metadata: { wordCount: 2, readingTime: 0, status: 'draft', tags: [] },
    version: 1,
    lastModified: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetStateForTesting();
});

// ---------------------------------------------------------------------------
// computeContentHash
// ---------------------------------------------------------------------------

describe('computeContentHash', () => {
  it('returns a 64-char hex string for any input', async () => {
    const hash = await computeContentHash('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns the same hash for identical content', async () => {
    const h1 = await computeContentHash('same content');
    const h2 = await computeContentHash('same content');
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different content', async () => {
    const h1 = await computeContentHash('content A');
    const h2 = await computeContentHash('content B');
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// isDirty
// ---------------------------------------------------------------------------

describe('isDirty', () => {
  it('returns false when lastSyncedHash is null (new document)', () => {
    expect(isDirty('any-hash')).toBe(false);
  });

  it('returns false when hash matches lastSyncedHash', async () => {
    mockInvoke.mockResolvedValueOnce(2);
    const doc = makeDoc();
    await sync(doc);
    const hash = await computeContentHash(doc.content);
    expect(isDirty(hash)).toBe(false);
  });

  it('returns true when hash differs from lastSyncedHash', async () => {
    mockInvoke.mockResolvedValueOnce(2);
    await sync(makeDoc({ content: 'original' }));
    const differentHash = await computeContentHash('modified content');
    expect(isDirty(differentHash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sync — basic success path
// ---------------------------------------------------------------------------

describe('sync — success', () => {
  it('calls sync_intent IPC with the document', async () => {
    mockInvoke.mockResolvedValueOnce(2);
    const doc = makeDoc();
    await sync(doc);
    expect(mockInvoke).toHaveBeenCalledWith('sync_intent', { document: doc });
  });

  it('returns success with version from IPC', async () => {
    mockInvoke.mockResolvedValueOnce(3);
    const result = await sync(makeDoc());
    expect(result.success).toBe(true);
    expect(result.version).toBe(3);
  });

  it('updates lastSyncedHash and lastSyncedAt after success', async () => {
    mockInvoke.mockResolvedValueOnce(2);
    const doc = makeDoc({ content: 'synced content' });
    const before = Date.now();
    await sync(doc);
    const after = Date.now();

    const state = getState();
    const expectedHash = await computeContentHash(doc.content);
    expect(state.lastSyncedHash).toBe(expectedHash);
    expect(state.lastSyncedAt).toBeGreaterThanOrEqual(before);
    expect(state.lastSyncedAt).toBeLessThanOrEqual(after);
  });

  it('sets isSyncing = false after completion', async () => {
    mockInvoke.mockResolvedValueOnce(2);
    await sync(makeDoc());
    expect(getState().isSyncing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sync — error path
// ---------------------------------------------------------------------------

describe('sync — IPC error', () => {
  it('returns success=false with error message', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('SQLite write failed'));
    const result = await sync(makeDoc());
    expect(result.success).toBe(false);
    expect(result.error).toContain('SQLite write failed');
  });

  it('sets isSyncing = false even on error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('fail'));
    await sync(makeDoc());
    expect(getState().isSyncing).toBe(false);
  });

  it('does not update lastSyncedHash on error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('fail'));
    await sync(makeDoc());
    expect(getState().lastSyncedHash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sync_Queue — Requirements 1.5, 1.6, 9.4
// ---------------------------------------------------------------------------

describe('Sync_Queue logic', () => {
  it('enqueues a second sync while first is in progress', async () => {
    // First sync: never resolves during this test (we control it)
    let resolveFirst!: (v: number) => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<number>((res) => { resolveFirst = res; })
    );

    const doc1 = makeDoc({ content: 'first' });
    const doc2 = makeDoc({ content: 'second' });

    // Start first sync (does not await yet)
    const firstSync = sync(doc1);

    // While first is in-flight, trigger second sync
    const secondSync = sync(doc2);

    // Queue should now hold doc2
    expect(getState().syncQueue?.document.content).toBe('second');

    // Resolve first IPC call
    resolveFirst(2);
    await firstSync;

    // Second sync was queued — it will fire automatically; resolve it too
    mockInvoke.mockResolvedValueOnce(3);
    await secondSync;
    // Give the fire-and-forget queue drain a tick to complete
    await new Promise((r) => setTimeout(r, 0));

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('third sync replaces second sync in queue (last-write-wins)', async () => {
    let resolveFirst!: (v: number) => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<number>((res) => { resolveFirst = res; })
    );

    const doc1 = makeDoc({ content: 'first' });
    const doc2 = makeDoc({ content: 'second' });
    const doc3 = makeDoc({ content: 'third' });

    const firstSync = sync(doc1);

    // Enqueue second, then immediately replace with third
    void sync(doc2);
    void sync(doc3);

    // Queue must hold only the latest (doc3)
    expect(getState().syncQueue?.document.content).toBe('third');

    resolveFirst(2);
    await firstSync;
  });

  it('processes queued sync after first sync completes', async () => {
    let resolveFirst!: (v: number) => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<number>((res) => { resolveFirst = res; })
    );
    mockInvoke.mockResolvedValueOnce(3); // for the queued sync

    const doc1 = makeDoc({ content: 'first' });
    const doc2 = makeDoc({ content: 'queued' });

    const firstSync = sync(doc1);
    void sync(doc2); // goes into queue

    resolveFirst(2);
    await firstSync;

    // Allow the fire-and-forget queue drain to run
    await new Promise((r) => setTimeout(r, 50));

    // Both IPC calls should have been made
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    // Final state should reflect the queued document's content
    const expectedHash = await computeContentHash(doc2.content);
    expect(getState().lastSyncedHash).toBe(expectedHash);
  });

  it('clears syncQueue after draining', async () => {
    let resolveFirst!: (v: number) => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<number>((res) => { resolveFirst = res; })
    );
    mockInvoke.mockResolvedValueOnce(3);

    const firstSync = sync(makeDoc({ content: 'first' }));
    void sync(makeDoc({ content: 'queued' }));

    resolveFirst(2);
    await firstSync;
    await new Promise((r) => setTimeout(r, 50));

    expect(getState().syncQueue).toBeNull();
  });
});
