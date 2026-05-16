/**
 * DevDashboardWindow - Standalone component for the Dev Dashboard OS window.
 * Renders the DevDashboard content directly (no overlay/backdrop) since it
 * lives in its own native OS window.
 */

import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DevDashboard } from './DevDashboard';

export function DevDashboardWindow() {
  const handleClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--md-sys-color-surface, #fefbff)',
      fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    }}>
      <DevDashboard isOpen={true} onClose={handleClose} isWindowed={true} />
    </div>
  );
}
