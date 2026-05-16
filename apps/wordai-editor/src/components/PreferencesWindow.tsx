/**
 * PreferencesWindow - Standalone component for the Preferences OS window.
 * Renders the same content as PreferencesDialog but without the modal overlay,
 * since it lives in its own native OS window.
 */

import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Tab } from '../types/preferences';
import '../i18n';

import { PreferencesDialogContent } from './PreferencesDialog';

export function PreferencesWindow() {
  // Parse URL params for initial tab
  const params = new URLSearchParams(window.location.search);
  const initialTab = (params.get('tab') as Tab) || 'general';
  const targetSettingId = params.get('settingId') || undefined;

  const handleClose = useCallback(() => {
    getCurrentWindow().close();
  }, []);

  const handleApply = useCallback(async () => {
    // Emit event to main window to refresh preferences
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('preferences-updated');
    } catch {
      // Ignore if event system not available
    }
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      background: '#ffffff',
      fontFamily: 'var(--font-family-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    }}>
      <PreferencesDialogContent
        initialTab={initialTab}
        targetSettingId={targetSettingId}
        onClose={handleClose}
        onApply={handleApply}
        isWindowed={true}
      />
    </div>
  );
}
