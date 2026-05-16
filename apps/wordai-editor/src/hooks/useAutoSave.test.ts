/**
 * Unit tests for useAutoSave hook
 * Requirements: 2.1, 2.2, 2.4
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAutoSave } from './useAutoSave';
import type { Document } from '../types/document';
import type { IPCError } from '../types/ipc';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

const makeDocument = (content = 'Hello world'): Document => ({
  id: 'doc-1',
  title: 'Test Doc',
  content,
  metadata: { wordCount: 2, readingTime: 1, status: 'draft', tags: [] },
  version: 1,
  lastModified: new Date('2024-01-01T00:00:00Z'),
});

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not save immediately on mount', () => {
    const doc = makeDocument();
    renderHook(() => useAutoSave(doc, '/tmp/doc.json', vi.fn(), vi.fn()));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('saves after 2 seconds when content changes', async () => {
    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    const updatedDoc = makeDocument('Updated content');
    rerender({ d: updatedDoc });

    expect(mockInvoke).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).toHaveBeenCalledWith('save_document', {
      path: '/tmp/doc.json',
      document: updatedDoc,
    });
  });

  it('debounces rapid changes — only saves once after last change', async () => {
    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('change 1') });
    vi.advanceTimersByTime(500);
    rerender({ d: makeDocument('change 2') });
    vi.advanceTimersByTime(500);
    rerender({ d: makeDocument('change 3') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('calls onSaveSuccess with updated lastModified on success', async () => {
    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    const updatedDoc = makeDocument('New content');
    rerender({ d: updatedDoc });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const savedDoc: Document = onSuccess.mock.calls[0][0];
    expect(savedDoc.content).toBe('New content');
    expect(savedDoc.lastModified).toBeInstanceOf(Date);
    // lastModified should be updated to now, not the original
    expect(savedDoc.lastModified.getTime()).toBeGreaterThan(
      new Date('2024-01-01T00:00:00Z').getTime()
    );
  });

  it('calls onSaveError on IPC failure', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Disk full' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const onError = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), onError),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('Failing content') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onError).toHaveBeenCalledWith(ipcError);
  });

  it('returns isSaving=true during save and false after', async () => {
    let resolveInvoke!: () => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<void>((res) => { resolveInvoke = res; })
    );

    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('Saving...') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isSaving).toBe(true);

    await act(async () => {
      resolveInvoke();
    });

    expect(result.current.isSaving).toBe(false);
  });

  it('updates lastSaved after a successful save', async () => {
    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    expect(result.current.lastSaved).toBeNull();

    rerender({ d: makeDocument('Saved content') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });

  it('does not save when filePath is empty', async () => {
    const doc = makeDocument();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('No path') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('cancels pending save on unmount', async () => {
    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('About to unmount') });
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useAutoSave - error handling and retry (Req 2.5, 17.2, 17.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sets hasUnsavedChanges=true when content changes', () => {
    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('changed content') });
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('clears hasUnsavedChanges and saveError on successful save', async () => {
    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('new content') });
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.saveError).toBeNull();
  });

  it('sets saveError on IPC failure', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Disk full' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('failing content') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.saveError).toEqual(ipcError);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('retries save after 5 seconds on error', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Disk full' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('retry content') });

    // Trigger initial save failure
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Advance 5 seconds for retry
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('clears saveError and hasUnsavedChanges after successful retry', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Disk full' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('retry content') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.saveError).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.saveError).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('cancels retry timer on unmount', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Disk full' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('content') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Only the initial failed call, no retry after unmount
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useAutoSave - triggerSave (manual save, Req 21.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('triggerSave immediately invokes save_document without waiting for debounce', async () => {
    const doc = makeDocument('manual save content');
    const onSuccess = vi.fn();
    const { result } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    // Call triggerSave without advancing timers
    await act(async () => {
      await result.current.triggerSave();
    });

    expect(mockInvoke).toHaveBeenCalledWith('save_document', {
      path: '/tmp/doc.json',
      document: doc,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('triggerSave clears hasUnsavedChanges on success', async () => {
    const doc = makeDocument();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    rerender({ d: makeDocument('changed') });
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.triggerSave();
    });

    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('triggerSave updates lastSaved on success', async () => {
    const doc = makeDocument();
    const { result } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), vi.fn()),
      { initialProps: { d: doc } }
    );

    expect(result.current.lastSaved).toBeNull();

    await act(async () => {
      await result.current.triggerSave();
    });

    expect(result.current.lastSaved).toBeInstanceOf(Date);
  });

  it('triggerSave sets saveError on IPC failure', async () => {
    const ipcError: IPCError = { code: 'IO_ERROR', message: 'Permission denied' };
    mockInvoke.mockRejectedValueOnce(ipcError);

    const doc = makeDocument();
    const onError = vi.fn();
    const { result } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', vi.fn(), onError),
      { initialProps: { d: doc } }
    );

    await act(async () => {
      await result.current.triggerSave();
    });

    expect(result.current.saveError).toEqual(ipcError);
    expect(onError).toHaveBeenCalledWith(ipcError);
  });

  it('triggerSave does nothing when filePath is empty', async () => {
    const doc = makeDocument();
    const onSuccess = vi.fn();
    const { result } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    await act(async () => {
      await result.current.triggerSave();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('triggerSave uses the latest document even after content changes', async () => {
    const doc = makeDocument('original');
    const onSuccess = vi.fn();
    const { result, rerender } = renderHook(
      ({ d }: { d: Document }) => useAutoSave(d, '/tmp/doc.json', onSuccess, vi.fn()),
      { initialProps: { d: doc } }
    );

    const updatedDoc = makeDocument('updated content');
    rerender({ d: updatedDoc });

    await act(async () => {
      await result.current.triggerSave();
    });

    expect(mockInvoke).toHaveBeenCalledWith('save_document', {
      path: '/tmp/doc.json',
      document: updatedDoc,
    });
  });
});

// ---------------------------------------------------------------------------
// useAutoSync tests
// Requirements: 2.1, 2.2, 2.6, 2.7
// ---------------------------------------------------------------------------

import { renderHook as renderHookSync } from '@testing-library/react';
import { useAutoSync } from './useAutoSave';
import * as auraBrainManager from '../services/auraBrainManager';

vi.mock('../services/auraBrainManager', () => ({
  sync: vi.fn().mockResolvedValue({ success: true }),
  syncDocument: vi.fn().mockResolvedValue({ success: true }),
  isDocumentDirty: vi.fn().mockResolvedValue(true),
  getState: vi.fn(),
}));

vi.mock('../services/notificationDispatcher', () => ({
  notificationDispatcher: {
    dispatch: vi.fn(),
  },
}));

const mockSync = vi.mocked(auraBrainManager.syncDocument);
const mockGetState = vi.mocked(auraBrainManager.getState);
const mockIsDocumentDirty = vi.mocked(auraBrainManager.isDocumentDirty);

const makeDoc = (content = 'Hello'): Document => ({
  id: 'doc-1',
  title: 'Test',
  content,
  metadata: { wordCount: 1, readingTime: 0, status: 'draft', tags: [] },
  version: 1,
  lastModified: new Date('2024-01-01T00:00:00Z'),
});

function idleState(overrides: Partial<auraBrainManager.AuraBrainState> = {}): auraBrainManager.AuraBrainState {
  return {
    activeDocumentId: null,
    isSyncing: false,
    syncQueue: null,
    lastSyncedHashByDocumentId: {},
    lastSyncedAtByDocumentId: {},
    lastErrorByDocumentId: {},
    lastSyncedHash: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

describe('useAutoSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSync.mockResolvedValue({ success: true });
    mockGetState.mockReturnValue(idleState());
    mockIsDocumentDirty.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calls sync on interval tick (Req 2.1)', async () => {
    const doc = makeDoc();
    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 10 })
    );

    expect(mockSync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(doc, 'auto');
  });

  it('calls sync multiple times across multiple intervals (Req 2.1)', async () => {
    const doc = makeDoc();
    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 5 })
    );

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    expect(mockSync).toHaveBeenCalledTimes(3);
  });

  it('updates interval timer when preferences interval changes', async () => {
    const doc = makeDoc();
    const { rerender } = renderHookSync(
      ({ interval }: { interval: number }) =>
        useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: interval }),
      { initialProps: { interval: 30 } },
    );

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockSync).not.toHaveBeenCalled();

    rerender({ interval: 5 });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('calls sync on window blur event (Req 2.2)', async () => {
    const doc = makeDoc();
    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 30 })
    );

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(doc, 'blur');
  });

  it('skips blur-triggered sync within 2000ms debounce window (Req 2.6)', async () => {
    const doc = makeDoc();
    const recentSyncTime = Date.now() - 500; // 500ms ago — within debounce window
    mockGetState.mockReturnValue(idleState({ lastSyncedAt: recentSyncTime }));

    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 30 })
    );

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).not.toHaveBeenCalled();
  });

  it('allows blur-triggered sync after 2000ms debounce window (Req 2.6)', async () => {
    const doc = makeDoc();
    const oldSyncTime = Date.now() - 3000; // 3s ago — outside debounce window
    mockGetState.mockReturnValue(idleState({ lastSyncedAt: oldSyncTime }));

    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 30 })
    );

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('skips interval sync when isSyncing = true (Req 2.7)', async () => {
    const doc = makeDoc();
    mockGetState.mockReturnValue(idleState({ isSyncing: true }));

    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 10 })
    );

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockSync).not.toHaveBeenCalled();
  });

  it('skips blur sync when isSyncing = true (Req 2.7)', async () => {
    const doc = makeDoc();
    mockGetState.mockReturnValue(idleState({ isSyncing: true }));

    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 30 })
    );

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does not set up interval when autoSyncEnabled = false', async () => {
    const doc = makeDoc();
    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: false, autoSyncInterval: 10 })
    );

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does not trigger blur sync when autoSyncEnabled = false', async () => {
    const doc = makeDoc();
    renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: false, autoSyncInterval: 30 })
    );

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).not.toHaveBeenCalled();
  });

  it('cleans up interval and blur listener on unmount', async () => {
    const doc = makeDoc();
    const { unmount } = renderHookSync(() =>
      useAutoSync({ document: doc, autoSyncEnabled: true, autoSyncInterval: 10 })
    );

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      window.dispatchEvent(new Event('blur'));
    });

    expect(mockSync).not.toHaveBeenCalled();
  });
});
