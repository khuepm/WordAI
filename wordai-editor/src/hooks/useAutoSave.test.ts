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
