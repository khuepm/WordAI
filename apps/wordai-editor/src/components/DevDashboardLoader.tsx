/**
 * DevDashboardLoader - Opens the Dev Dashboard in a separate OS window.
 *
 * Handles:
 * - `import.meta.env.DEV` guard (renders nothing in production)
 * - Keyboard shortcut listener: Cmd+D (macOS) / Ctrl+Alt+D (Windows/Linux)
 * - Opens a new native OS window via Tauri WebviewWindow API
 *
 * This component should be placed near the root of the app (e.g., in App.tsx).
 * In production builds, the entire component tree-shakes away because of the
 * `import.meta.env.DEV` guard — Vite statically replaces it with `false` and
 * dead-code elimination removes the block.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.12
 */

import { useEffect } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const DEV_DASHBOARD_WINDOW_LABEL = 'dev-dashboard';

async function openDevDashboardWindow(): Promise<void> {
  // Check if window already exists
  const existing = await WebviewWindow.getByLabel(DEV_DASHBOARD_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const dashWindow = new WebviewWindow(DEV_DASHBOARD_WINDOW_LABEL, {
    url: 'devdashboard.html',
    title: 'Dev Dashboard — Notification System',
    width: 1100,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    center: true,
    resizable: true,
    decorations: true,
    focus: true,
  });

  dashWindow.once('tauri://error', (e) => {
    console.error('Failed to create dev dashboard window:', e);
  });
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * DevDashboardLoader listens for the keyboard shortcut and opens the
 * Dev Dashboard in a separate OS window. Renders nothing to the DOM.
 */
export function DevDashboardLoader() {
  // Guard: render nothing in production
  if (!import.meta.env.DEV) {
    return null;
  }

  return <DevDashboardShortcutListener />;
}

/**
 * Inner component that handles the keyboard shortcut.
 * Separated to keep the DEV guard at the top level without hooks.
 */
function DevDashboardShortcutListener() {
  // Keyboard shortcut: Cmd+D (macOS) / Ctrl+Alt+D (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isShortcut = isMac
        ? e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && e.key.toLowerCase() === 'd'
        : e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.key.toLowerCase() === 'd';

      if (isShortcut) {
        e.preventDefault();
        void openDevDashboardWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // This component renders nothing — it only listens for the shortcut
  return null;
}

export default DevDashboardLoader;
