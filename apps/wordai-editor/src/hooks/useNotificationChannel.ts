/**
 * useNotificationChannel - React hooks for subscribing to notification channels
 *
 * Provides two hooks:
 * - useNotificationChannel(channel): subscribe to a channel, returns visible ActiveNotification[]
 * - useTopNotification(channel): returns the first (highest-priority) visible notification or null
 *
 * Uses useSyncExternalStore for subscription to the NotificationDispatcher.
 * Notifications are filtered through the channel handler's getVisibleNotifications().
 *
 * Snapshot caching: Since getChannelNotifications and getVisibleNotifications return
 * new arrays each time, we cache the result and only update the reference when the
 * content actually changes. This prevents useSyncExternalStore from triggering
 * infinite re-renders.
 *
 * Requirement: 2.10
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ActiveNotification, NotificationChannel } from '../types/notification';
import { notificationDispatcher } from '../services/notificationDispatcher';
import { notificationChannelRegistry } from '../services/notificationChannels';

/**
 * Compare two notification arrays by their ids to determine if content changed.
 * Returns true if the arrays are equivalent (same ids in same order with same state).
 */
function areNotificationsEqual(
  a: ActiveNotification[],
  b: ActiveNotification[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].state !== b[i].state || a[i].resolvedContent !== b[i].resolvedContent) {
      return false;
    }
  }
  return true;
}

/**
 * Subscribe to notifications for a specific channel.
 * Returns the visible notifications filtered through the channel handler,
 * sorted by priority (critical > high > medium > low).
 *
 * Requirement: 2.10
 */
export function useNotificationChannel(channel: NotificationChannel): ActiveNotification[] {
  const cacheRef = useRef<ActiveNotification[]>([]);

  const subscribe = useCallback(
    (listener: () => void) => {
      return notificationDispatcher.subscribeChannel(channel, listener);
    },
    [channel]
  );

  const getSnapshot = useCallback(() => {
    const allChannelNotifications = notificationDispatcher.getChannelNotifications(channel);
    const handler = notificationChannelRegistry.getHandler(channel);
    const visible = handler.getVisibleNotifications(allChannelNotifications);

    // Return cached reference if content hasn't changed
    if (areNotificationsEqual(cacheRef.current, visible)) {
      return cacheRef.current;
    }

    cacheRef.current = visible;
    return visible;
  }, [channel]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to the highest-priority visible notification for a channel.
 * Returns the first notification from the visible list, or null if none.
 *
 * Requirement: 2.10
 */
export function useTopNotification(channel: NotificationChannel): ActiveNotification | null {
  const cacheRef = useRef<ActiveNotification | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      return notificationDispatcher.subscribeChannel(channel, listener);
    },
    [channel]
  );

  const getSnapshot = useCallback(() => {
    const allChannelNotifications = notificationDispatcher.getChannelNotifications(channel);
    const handler = notificationChannelRegistry.getHandler(channel);
    const visible = handler.getVisibleNotifications(allChannelNotifications);
    const top = visible.length > 0 ? visible[0] : null;

    // Return cached reference if content hasn't changed
    if (cacheRef.current === null && top === null) return cacheRef.current;
    if (
      cacheRef.current !== null &&
      top !== null &&
      cacheRef.current.id === top.id &&
      cacheRef.current.state === top.state &&
      cacheRef.current.resolvedContent === top.resolvedContent
    ) {
      return cacheRef.current;
    }

    cacheRef.current = top;
    return top;
  }, [channel]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
