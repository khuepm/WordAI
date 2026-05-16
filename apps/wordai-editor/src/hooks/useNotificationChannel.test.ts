/**
 * Unit tests for useNotificationChannel hooks
 * Requirement: 2.10
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useNotificationChannel, useTopNotification } from './useNotificationChannel';
import { notificationDispatcher } from '../services/notificationDispatcher';
import { notificationChannelRegistry } from '../services/notificationChannels';
import type { ActiveNotification } from '../types/notification';

// Mock the dispatcher and channel registry
vi.mock('../services/notificationDispatcher', () => ({
  notificationDispatcher: {
    subscribeChannel: vi.fn(),
    getChannelNotifications: vi.fn(),
  },
}));

vi.mock('../services/notificationChannels', () => ({
  notificationChannelRegistry: {
    getHandler: vi.fn(),
  },
}));

const mockSubscribeChannel = vi.mocked(notificationDispatcher.subscribeChannel);
const mockGetChannelNotifications = vi.mocked(notificationDispatcher.getChannelNotifications);
const mockGetHandler = vi.mocked(notificationChannelRegistry.getHandler);

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

describe('useNotificationChannel', () => {
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unsubscribe = vi.fn();
    mockSubscribeChannel.mockReturnValue(unsubscribe);
    mockGetChannelNotifications.mockReturnValue([]);
    mockGetHandler.mockReturnValue({
      channel: 'statusBar',
      supportsAutoDismiss: true,
      pauseOnBlur: false,
      rendersUI: true,
      getVisibleNotifications: (notifications: ActiveNotification[]) => notifications,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no notifications exist', () => {
    const { result } = renderHook(() => useNotificationChannel('statusBar'));
    expect(result.current).toEqual([]);
  });

  it('subscribes to the correct channel', () => {
    renderHook(() => useNotificationChannel('statusBar'));
    expect(mockSubscribeChannel).toHaveBeenCalledWith('statusBar', expect.any(Function));
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useNotificationChannel('statusBar'));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('returns visible notifications filtered through channel handler', () => {
    const notification = createNotification();
    mockGetChannelNotifications.mockReturnValue([notification]);

    const { result } = renderHook(() => useNotificationChannel('statusBar'));
    expect(result.current).toEqual([notification]);
  });

  it('filters notifications through channel handler getVisibleNotifications', () => {
    const notifications = [
      createNotification({ id: '1', priority: 'high' }),
      createNotification({ id: '2', priority: 'low' }),
      createNotification({ id: '3', priority: 'medium' }),
    ];
    mockGetChannelNotifications.mockReturnValue(notifications);
    // Handler only returns first notification (like statusBar showOnlyTop)
    mockGetHandler.mockReturnValue({
      channel: 'statusBar',
      supportsAutoDismiss: true,
      pauseOnBlur: false,
      rendersUI: true,
      getVisibleNotifications: (notifs: ActiveNotification[]) => notifs.slice(0, 1),
    });

    const { result } = renderHook(() => useNotificationChannel('statusBar'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('re-renders when channel listener is called', () => {
    let capturedListener: (() => void) | null = null;
    mockSubscribeChannel.mockImplementation((_channel, listener) => {
      capturedListener = listener;
      return unsubscribe;
    });

    mockGetChannelNotifications.mockReturnValue([]);
    const { result } = renderHook(() => useNotificationChannel('statusBar'));
    expect(result.current).toEqual([]);

    // Simulate a new notification arriving
    const notification = createNotification();
    mockGetChannelNotifications.mockReturnValue([notification]);

    act(() => {
      capturedListener!();
    });

    expect(result.current).toEqual([notification]);
  });

  it('uses correct channel when channel prop changes', () => {
    const { rerender } = renderHook(
      ({ channel }) => useNotificationChannel(channel),
      { initialProps: { channel: 'statusBar' as const } }
    );

    expect(mockSubscribeChannel).toHaveBeenCalledWith('statusBar', expect.any(Function));

    rerender({ channel: 'toast' as const });

    expect(mockSubscribeChannel).toHaveBeenCalledWith('toast', expect.any(Function));
  });
});

describe('useTopNotification', () => {
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unsubscribe = vi.fn();
    mockSubscribeChannel.mockReturnValue(unsubscribe);
    mockGetChannelNotifications.mockReturnValue([]);
    mockGetHandler.mockReturnValue({
      channel: 'statusBar',
      supportsAutoDismiss: true,
      pauseOnBlur: false,
      rendersUI: true,
      getVisibleNotifications: (notifications: ActiveNotification[]) => notifications,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no notifications exist', () => {
    const { result } = renderHook(() => useTopNotification('statusBar'));
    expect(result.current).toBeNull();
  });

  it('returns the highest-priority notification', () => {
    const notifications = [
      createNotification({ id: '1', priority: 'critical' }),
      createNotification({ id: '2', priority: 'high' }),
      createNotification({ id: '3', priority: 'low' }),
    ];
    mockGetChannelNotifications.mockReturnValue(notifications);

    const { result } = renderHook(() => useTopNotification('statusBar'));
    expect(result.current).not.toBeNull();
    expect(result.current!.id).toBe('1');
  });

  it('returns null when channel handler filters out all notifications', () => {
    const notifications = [createNotification()];
    mockGetChannelNotifications.mockReturnValue(notifications);
    mockGetHandler.mockReturnValue({
      channel: 'none',
      supportsAutoDismiss: false,
      pauseOnBlur: false,
      rendersUI: false,
      getVisibleNotifications: () => [],
    });

    const { result } = renderHook(() => useTopNotification('none'));
    expect(result.current).toBeNull();
  });

  it('updates when channel listener fires', () => {
    let capturedListener: (() => void) | null = null;
    mockSubscribeChannel.mockImplementation((_channel, listener) => {
      capturedListener = listener;
      return unsubscribe;
    });

    mockGetChannelNotifications.mockReturnValue([]);
    const { result } = renderHook(() => useTopNotification('statusBar'));
    expect(result.current).toBeNull();

    // Simulate notification arriving
    const notification = createNotification({ priority: 'high' });
    mockGetChannelNotifications.mockReturnValue([notification]);

    act(() => {
      capturedListener!();
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.priority).toBe('high');
  });
});
