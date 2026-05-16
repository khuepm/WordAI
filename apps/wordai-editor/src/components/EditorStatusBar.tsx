/**
 * EditorStatusBar - Sync status bar fixed at the bottom of the editor
 * Requirements: 7.1, 7.6, 7.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 *
 * Subscribes to the 'statusBar' notification channel. If a notification is active,
 * it renders the notification content (supporting elapsed, countdown, message, indicator formats).
 * If no notification is present, falls back to the original hardcoded behavior.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopNotification } from '../hooks/useNotificationChannel';
import { useTimerFormat } from '../hooks/useTimerFormat';

export interface EditorStatusBarProps {
  isSyncing: boolean;
  isDirty: boolean;
  lastSyncedAt: number | null;
  storagePath: string;
}

/**
 * Returns elapsed seconds since the given timestamp.
 */
function secondsSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 1000);
}

export function EditorStatusBar({
  isSyncing,
  isDirty,
  lastSyncedAt,
  storagePath,
}: EditorStatusBarProps) {
  const { t } = useTranslation();

  // Subscribe to the statusBar notification channel (Req 7.1)
  const topNotification = useTopNotification('statusBar');

  // Self-updating timer for elapsed/countdown formats (Req 3.1, 3.2, 3.7)
  const { displayContent } = useTimerFormat(topNotification);

  // Tick every second to update fallback "Synced · Ns ago" (Req 13.7)
  const [, setTick] = useState(0);
  useEffect(() => {
    // Only run the fallback timer when there's no notification driving the display
    if (topNotification !== null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [topNotification]);

  // Determine status text: notification-driven or fallback (Req 7.6, 7.7)
  let statusText: string;

  if (topNotification !== null) {
    // Notification channel is active — render based on format
    if (topNotification.format === 'elapsed' || topNotification.format === 'countdown') {
      // Timer formats use the self-updating displayContent from useTimerFormat
      statusText = displayContent;
    } else {
      // 'message' and 'indicator' formats use resolvedContent directly
      statusText = topNotification.resolvedContent;
    }
  } else {
    // Fallback: no notification → existing hardcoded behavior (Req 7.6, 7.7)
    if (isSyncing) {
      // Req 13.3
      statusText = t('statusBar.syncing');
    } else if (isDirty || lastSyncedAt === null) {
      // Req 13.4, 13.8
      statusText = t('statusBar.unsaved');
    } else {
      // Req 13.2, 13.7
      const n = secondsSince(lastSyncedAt);
      statusText = t('statusBar.synced', { seconds: n });
    }
  }

  return (
    <div
      data-testid="editor-status-bar"
      title={storagePath}
      aria-label={`Sync status: ${statusText}`}
      style={styles.bar}
    >
      <span data-testid="status-text" style={styles.text}>
        {statusText}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem 1rem',
    background: 'var(--md-sys-color-surface-variant, #e7e0ec)',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.7rem',
    color: 'var(--md-sys-color-on-surface-variant, #49454f)',
    userSelect: 'none',
    flexShrink: 0,
    cursor: 'default',
  },
  text: {
    opacity: 0.75,
    letterSpacing: '0.02em',
  },
};

export default EditorStatusBar;
