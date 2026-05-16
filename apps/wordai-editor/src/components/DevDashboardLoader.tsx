/**
 * DevDashboardLoader - Loader component for the Dev Dashboard.
 *
 * Handles:
 * - `import.meta.env.DEV` guard (renders nothing in production)
 * - Keyboard shortcut listener: Ctrl+Shift+Alt+D (Windows/Linux) / Cmd+Shift+Option+D (macOS)
 * - React.lazy + Suspense wrapper for code splitting
 * - Open/close state management
 *
 * This component should be placed near the root of the app (e.g., in App.tsx).
 * In production builds, the entire component tree-shakes away because of the
 * `import.meta.env.DEV` guard — Vite statically replaces it with `false` and
 * dead-code elimination removes the block.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.12
 */

import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';

// Lazy-load the DevDashboard only when needed (code splitting)
const DevDashboard = lazy(() => import('./DevDashboard'));

// ─── Loading Fallback ───────────────────────────────────────────────────────────

const loadingStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
  color: '#fff',
  fontSize: '0.875rem',
};

function LoadingFallback() {
  return (
    <div style={loadingStyle} data-testid="dev-dashboard-loading">
      Loading Dev Dashboard…
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * DevDashboardLoader renders the Dev Dashboard only in development mode.
 * It listens for the keyboard shortcut and lazily loads the dashboard component.
 */
export function DevDashboardLoader() {
  // Guard: render nothing in production
  if (!import.meta.env.DEV) {
    return null;
  }

  return <DevDashboardLoaderInner />;
}

/**
 * Inner component that handles state and keyboard shortcut.
 * Separated to keep the DEV guard at the top level without hooks.
 */
function DevDashboardLoaderInner() {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Keyboard shortcut: Ctrl+Shift+Alt+D (Windows/Linux) / Cmd+Shift+Option+D (macOS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isShortcut =
        e.shiftKey &&
        e.altKey &&
        e.key.toLowerCase() === 'd' &&
        (e.ctrlKey || e.metaKey);

      if (isShortcut) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DevDashboard isOpen={isOpen} onClose={handleClose} />
    </Suspense>
  );
}

export default DevDashboardLoader;
