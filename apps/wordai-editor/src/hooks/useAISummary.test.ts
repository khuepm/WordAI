/**
 * Tests for useAISummary — AI summary generation hook.
 * Requirements: 9.4, 9.5, 9.6, 9.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISummary } from './useAISummary';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

// Helper to flush microtasks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

describe('useAISummary — idle state', () => {
  it('returns idle state when itemId is null (Req 9.4)', () => {
    const { result } = renderHook(() => useAISummary(null));

    expect(result.current.state).toEqual({
      status: 'idle',
      text: null,
      retryCount: 0,
    });
  });

  it('retry is a no-op when itemId is null', () => {
    const { result } = renderHook(() => useAISummary(null));

    act(() => {
      result.current.retry();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Loading and success
// ---------------------------------------------------------------------------

describe('useAISummary — loading and success', () => {
  it('sets loading state when itemId is provided (Req 9.4)', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAISummary('item-1'));

    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.text).toBeNull();
    expect(result.current.state.retryCount).toBe(0);
  });

  it('sets success state with summary text on successful generation (Req 9.4)', async () => {
    mockInvoke.mockResolvedValue('This is an AI summary.');

    const { result } = renderHook(() => useAISummary('item-1'));

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.text).toBe('This is an AI summary.');
    expect(result.current.state.retryCount).toBe(0);
    expect(mockInvoke).toHaveBeenCalledWith('generate_archive_summary', { id: 'item-1', api_key: '', endpoint: null });
  });
});

// ---------------------------------------------------------------------------
// Error and timeout
// ---------------------------------------------------------------------------

describe('useAISummary — error and timeout', () => {
  it('sets error state when generation fails (Req 9.5)', async () => {
    mockInvoke.mockRejectedValue(new Error('AI service unavailable'));

    const { result } = renderHook(() => useAISummary('item-1'));

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.text).toBeNull();
    expect(result.current.state.retryCount).toBe(1);
  });

  it('sets error state when 30s timeout elapses (Req 9.5)', async () => {
    vi.useFakeTimers();

    mockInvoke.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAISummary('item-1'));

    expect(result.current.state.status).toBe('loading');

    // Advance past the 30s timeout and flush microtasks
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.retryCount).toBe(1);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Retry behavior
// ---------------------------------------------------------------------------

describe('useAISummary — retry', () => {
  it('retry re-initiates generation when retryCount < 3 (Req 9.6)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useAISummary('item-1'));

    // Wait for initial failure
    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.retryCount).toBe(1);

    // Now mock a successful response for retry
    mockInvoke.mockResolvedValueOnce('Retry summary');

    act(() => {
      result.current.retry();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.text).toBe('Retry summary');
    expect(result.current.state.retryCount).toBe(1);
  });

  it('retry is a no-op after 3 failures (Req 9.7)', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useAISummary('item-1'));

    // First failure (retryCount = 1)
    await act(async () => {
      await flushPromises();
    });
    expect(result.current.state.retryCount).toBe(1);

    // Second failure (retryCount = 2)
    act(() => {
      result.current.retry();
    });
    await act(async () => {
      await flushPromises();
    });
    expect(result.current.state.retryCount).toBe(2);

    // Third failure (retryCount = 3)
    act(() => {
      result.current.retry();
    });
    await act(async () => {
      await flushPromises();
    });
    expect(result.current.state.retryCount).toBe(3);

    // Clear mock call count
    mockInvoke.mockClear();

    // Retry should be a no-op now
    act(() => {
      result.current.retry();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.state.retryCount).toBe(3);
    expect(result.current.state.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// itemId changes
// ---------------------------------------------------------------------------

describe('useAISummary — itemId changes', () => {
  it('resets to idle when itemId changes to null', async () => {
    mockInvoke.mockResolvedValue('Summary text');

    const { result, rerender } = renderHook(
      ({ id }) => useAISummary(id),
      { initialProps: { id: 'item-1' as string | null } },
    );

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('success');

    rerender({ id: null });

    expect(result.current.state).toEqual({
      status: 'idle',
      text: null,
      retryCount: 0,
    });
  });

  it('re-initiates generation when itemId changes to a new value', async () => {
    mockInvoke.mockResolvedValueOnce('Summary for item-1');
    mockInvoke.mockResolvedValueOnce('Summary for item-2');

    const { result, rerender } = renderHook(
      ({ id }) => useAISummary(id),
      { initialProps: { id: 'item-1' as string | null } },
    );

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.text).toBe('Summary for item-1');

    rerender({ id: 'item-2' });

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.text).toBe('Summary for item-2');
    expect(result.current.state.retryCount).toBe(0);
    expect(mockInvoke).toHaveBeenCalledWith('generate_archive_summary', { id: 'item-2', api_key: '', endpoint: null });
  });
});
