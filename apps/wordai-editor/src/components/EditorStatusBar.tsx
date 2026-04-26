/**
 * EditorStatusBar - Sync status bar fixed at the bottom of the editor
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import { useState, useEffect } from 'react';

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
  // Tick every second to update "Synced · Ns ago" (Req 13.7)
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  let statusText: string;
  if (isSyncing) {
    // Req 13.3
    statusText = 'Syncing...';
  } else if (isDirty || lastSyncedAt === null) {
    // Req 13.4, 13.8
    statusText = 'Unsaved changes';
  } else {
    // Req 13.2, 13.7
    const n = secondsSince(lastSyncedAt);
    statusText = `Synced · ${n}s ago`;
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
