/**
 * useTimerFormat - React hook for countdown and elapsed notification formats
 *
 * Provides self-updating timer logic for notifications with format='countdown' or format='elapsed'.
 * Both formats update every second WITHOUT re-dispatching the notification.
 *
 * - Countdown: starts from a value (remainingSeconds in data or calculated from createdAt + duration),
 *   decreases each second. Dispatches "done" event when reaching 0.
 * - Elapsed: calculates seconds since notification.createdAt, increases each second.
 *
 * Requirements: 3.1, 3.2, 3.7
 */

import { useEffect, useRef, useState } from 'react';
import type { ActiveNotification } from '../types/notification';

/**
 * Format timer content for a notification based on its format type and current time.
 *
 * For elapsed: calculates `Math.floor((currentTime - notification.createdAt) / 1000)`
 * and resolves the template with {seconds}.
 *
 * For countdown: calculates remaining time from `notification.data.remainingSeconds`
 * (or from createdAt + duration) and resolves the template with {remainingSeconds}.
 *
 * Requirements: 3.1, 3.2, 3.7
 */
export function formatTimerContent(
  notification: ActiveNotification,
  currentTime: number
): string {
  const { format, resolvedContent, data, createdAt, duration } = notification;

  if (format === 'elapsed') {
    const elapsedSeconds = Math.max(0, Math.floor((currentTime - createdAt) / 1000));
    // Replace {seconds} in the template with the calculated elapsed value
    return resolvedContent.replace(/\d+(?=s\s*ago)/, String(elapsedSeconds));
  }

  if (format === 'countdown') {
    let remainingSeconds: number;

    if (typeof data.remainingSeconds === 'number') {
      // Calculate how many seconds have passed since notification was created
      const elapsedSeconds = Math.floor((currentTime - createdAt) / 1000);
      remainingSeconds = Math.max(0, (data.remainingSeconds as number) - elapsedSeconds);
    } else if (duration !== null) {
      // Fallback: calculate from createdAt + duration
      const endTime = createdAt + duration;
      remainingSeconds = Math.max(0, Math.ceil((endTime - currentTime) / 1000));
    } else {
      remainingSeconds = 0;
    }

    // Replace the numeric value in the resolved content
    return resolvedContent.replace(/\d+(?=s\b)/, String(remainingSeconds));
  }

  // For non-timer formats, return the resolved content as-is
  return resolvedContent;
}

export interface UseTimerFormatResult {
  /** The current formatted display string, updated every second */
  displayContent: string;
  /** Whether the countdown has reached zero */
  isDone: boolean;
  /** Current seconds value (elapsed seconds or remaining seconds) */
  currentSeconds: number;
}

/**
 * React hook that provides self-updating timer display for countdown and elapsed notifications.
 *
 * - For `elapsed` format: starts from 0, increases every second.
 * - For `countdown` format: starts from a value, decreases every second.
 *   Sets `isDone` to true when reaching 0.
 * - Both update WITHOUT re-dispatching the notification (Requirement 3.7).
 *
 * For non-timer formats (message, indicator, progress), returns the static resolvedContent.
 *
 * Requirements: 3.1, 3.2, 3.7
 */
export function useTimerFormat(notification: ActiveNotification | null): UseTimerFormatResult {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneCalledRef = useRef(false);

  const isTimerFormat =
    notification !== null &&
    (notification.format === 'countdown' || notification.format === 'elapsed');

  // Start/stop interval based on whether we have a timer-format notification
  useEffect(() => {
    if (!isTimerFormat) {
      // Clear any existing interval
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset done state when notification changes
    onDoneCalledRef.current = false;

    // Start interval to update every second
    intervalRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerFormat, notification?.id]);

  // Calculate current values
  if (notification === null) {
    return {
      displayContent: '',
      isDone: false,
      currentSeconds: 0,
    };
  }

  if (!isTimerFormat) {
    return {
      displayContent: notification.resolvedContent,
      isDone: false,
      currentSeconds: 0,
    };
  }

  const displayContent = formatTimerContent(notification, currentTime);

  let currentSeconds: number;
  let isDone = false;

  if (notification.format === 'elapsed') {
    currentSeconds = Math.max(0, Math.floor((currentTime - notification.createdAt) / 1000));
  } else {
    // countdown
    if (typeof notification.data.remainingSeconds === 'number') {
      const elapsedSeconds = Math.floor((currentTime - notification.createdAt) / 1000);
      currentSeconds = Math.max(0, (notification.data.remainingSeconds as number) - elapsedSeconds);
    } else if (notification.duration !== null) {
      const endTime = notification.createdAt + notification.duration;
      currentSeconds = Math.max(0, Math.ceil((endTime - currentTime) / 1000));
    } else {
      currentSeconds = 0;
    }

    isDone = currentSeconds === 0;
  }

  return {
    displayContent,
    isDone,
    currentSeconds,
  };
}
