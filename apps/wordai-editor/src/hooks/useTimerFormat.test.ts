/**
 * Unit tests for useTimerFormat hook and formatTimerContent utility
 * Requirements: 3.1, 3.2, 3.7
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTimerFormat, formatTimerContent } from './useTimerFormat';
import type { ActiveNotification } from '../types/notification';

function createNotification(overrides: Partial<ActiveNotification> = {}): ActiveNotification {
  return {
    id: 'notif-1',
    policyId: 'policy-1',
    channel: 'statusBar',
    format: 'message',
    priority: 'medium',
    duration: null,
    resolvedContent: 'Test notification',
    data: {},
    state: 'active',
    createdAt: Date.now(),
    dismissAt: null,
    ...overrides,
  };
}

describe('formatTimerContent', () => {
  describe('elapsed format', () => {
    it('calculates elapsed seconds from createdAt', () => {
      const createdAt = 1000;
      const currentTime = 16000; // 15 seconds later
      const notification = createNotification({
        format: 'elapsed',
        resolvedContent: 'Synced · 0s ago',
        createdAt,
      });

      const result = formatTimerContent(notification, currentTime);
      expect(result).toBe('Synced · 15s ago');
    });

    it('returns 0s when currentTime equals createdAt', () => {
      const createdAt = 5000;
      const notification = createNotification({
        format: 'elapsed',
        resolvedContent: 'Synced · 0s ago',
        createdAt,
      });

      const result = formatTimerContent(notification, createdAt);
      expect(result).toBe('Synced · 0s ago');
    });

    it('never returns negative elapsed time', () => {
      const createdAt = 10000;
      const currentTime = 5000; // before createdAt (edge case)
      const notification = createNotification({
        format: 'elapsed',
        resolvedContent: 'Synced · 0s ago',
        createdAt,
      });

      const result = formatTimerContent(notification, currentTime);
      expect(result).toBe('Synced · 0s ago');
    });
  });

  describe('countdown format', () => {
    it('calculates remaining seconds from data.remainingSeconds', () => {
      const createdAt = 1000;
      const currentTime = 6000; // 5 seconds later
      const notification = createNotification({
        format: 'countdown',
        resolvedContent: 'Next sync in 30s',
        data: { remainingSeconds: 30 },
        createdAt,
      });

      const result = formatTimerContent(notification, currentTime);
      expect(result).toBe('Next sync in 25s');
    });

    it('never returns negative remaining time', () => {
      const createdAt = 1000;
      const currentTime = 50000; // 49 seconds later, more than remainingSeconds
      const notification = createNotification({
        format: 'countdown',
        resolvedContent: 'Next sync in 30s',
        data: { remainingSeconds: 30 },
        createdAt,
      });

      const result = formatTimerContent(notification, currentTime);
      expect(result).toBe('Next sync in 0s');
    });

    it('calculates from duration when remainingSeconds not in data', () => {
      const createdAt = 1000;
      const duration = 20000; // 20 seconds
      const currentTime = 11000; // 10 seconds later
      const notification = createNotification({
        format: 'countdown',
        resolvedContent: 'Next sync in 20s',
        data: {},
        createdAt,
        duration,
      });

      const result = formatTimerContent(notification, currentTime);
      expect(result).toBe('Next sync in 10s');
    });

    it('returns 0 when no remainingSeconds and no duration', () => {
      const notification = createNotification({
        format: 'countdown',
        resolvedContent: 'Next sync in 0s',
        data: {},
        duration: null,
      });

      const result = formatTimerContent(notification, Date.now());
      expect(result).toBe('Next sync in 0s');
    });
  });

  describe('non-timer formats', () => {
    it('returns resolvedContent as-is for message format', () => {
      const notification = createNotification({
        format: 'message',
        resolvedContent: 'Sync failed: timeout',
      });

      const result = formatTimerContent(notification, Date.now());
      expect(result).toBe('Sync failed: timeout');
    });

    it('returns resolvedContent as-is for indicator format', () => {
      const notification = createNotification({
        format: 'indicator',
        resolvedContent: '●',
      });

      const result = formatTimerContent(notification, Date.now());
      expect(result).toBe('●');
    });
  });
});

describe('useTimerFormat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty content when notification is null', () => {
    const { result } = renderHook(() => useTimerFormat(null));

    expect(result.current.displayContent).toBe('');
    expect(result.current.isDone).toBe(false);
    expect(result.current.currentSeconds).toBe(0);
  });

  it('returns static content for non-timer formats', () => {
    const notification = createNotification({
      format: 'message',
      resolvedContent: 'Hello world',
    });

    const { result } = renderHook(() => useTimerFormat(notification));

    expect(result.current.displayContent).toBe('Hello world');
    expect(result.current.isDone).toBe(false);
    expect(result.current.currentSeconds).toBe(0);
  });

  it('updates elapsed format every second (Requirement 3.2, 3.7)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const notification = createNotification({
      format: 'elapsed',
      resolvedContent: 'Synced · 0s ago',
      createdAt: now,
    });

    const { result } = renderHook(() => useTimerFormat(notification));

    expect(result.current.currentSeconds).toBe(0);

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.currentSeconds).toBe(3);
    expect(result.current.displayContent).toBe('Synced · 3s ago');
  });

  it('updates countdown format every second (Requirement 3.1, 3.7)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const notification = createNotification({
      format: 'countdown',
      resolvedContent: 'Next sync in 10s',
      data: { remainingSeconds: 10 },
      createdAt: now,
    });

    const { result } = renderHook(() => useTimerFormat(notification));

    expect(result.current.currentSeconds).toBe(10);
    expect(result.current.isDone).toBe(false);

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.currentSeconds).toBe(5);
    expect(result.current.displayContent).toBe('Next sync in 5s');
    expect(result.current.isDone).toBe(false);
  });

  it('sets isDone to true when countdown reaches 0 (Requirement 3.1)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const notification = createNotification({
      format: 'countdown',
      resolvedContent: 'Next sync in 3s',
      data: { remainingSeconds: 3 },
      createdAt: now,
    });

    const { result } = renderHook(() => useTimerFormat(notification));

    // Advance past the countdown
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.currentSeconds).toBe(0);
    expect(result.current.isDone).toBe(true);
  });

  it('cleans up interval on unmount', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const notification = createNotification({
      format: 'elapsed',
      resolvedContent: 'Synced · 0s ago',
      createdAt: now,
    });

    const { unmount } = renderHook(() => useTimerFormat(notification));

    // Should not throw after unmount
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // No assertion needed - just verifying no errors occur
  });

  it('does not start interval for non-timer formats', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    const notification = createNotification({
      format: 'message',
      resolvedContent: 'Static message',
    });

    renderHook(() => useTimerFormat(notification));

    // setInterval should not be called for message format
    // (it may be called 0 times or the effect may not trigger setInterval)
    const timerCalls = setIntervalSpy.mock.calls.filter(
      (call) => call[1] === 1000
    );
    expect(timerCalls).toHaveLength(0);

    setIntervalSpy.mockRestore();
  });

  it('resets interval when notification id changes', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const notification1 = createNotification({
      id: 'notif-1',
      format: 'elapsed',
      resolvedContent: 'Synced · 0s ago',
      createdAt: now,
    });

    const { result, rerender } = renderHook(
      ({ notif }) => useTimerFormat(notif),
      { initialProps: { notif: notification1 } }
    );

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.currentSeconds).toBe(5);

    // Switch to a new notification
    const newNow = Date.now();
    const notification2 = createNotification({
      id: 'notif-2',
      format: 'elapsed',
      resolvedContent: 'Synced · 0s ago',
      createdAt: newNow,
    });

    rerender({ notif: notification2 });

    // After rerender with new notification, seconds should reset
    expect(result.current.currentSeconds).toBe(0);
  });
});
