/**
 * preferencesWindow - Opens the Preferences dialog as a separate OS window.
 * Uses Tauri's WebviewWindow API to create a native window that can be
 * moved, resized, and positioned independently.
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Tab } from '../types/preferences';

const PREFERENCES_WINDOW_LABEL = 'preferences';

/**
 * Open the Preferences window as a separate OS window.
 * If the window is already open, it will be closed and reopened with new params
 * to navigate to the correct setting.
 */
export async function openPreferencesWindow(options?: {
  tab?: Tab;
  settingId?: string;
}): Promise<void> {
  // Close existing window if open (so we can reopen with new params)
  const existing = await WebviewWindow.getByLabel(PREFERENCES_WINDOW_LABEL);
  if (existing) {
    if (options?.settingId || options?.tab) {
      // Close and reopen with new params to navigate to the setting
      await existing.close();
      // Small delay to ensure window is fully closed before reopening
      await new Promise((r) => setTimeout(r, 100));
    } else {
      // No specific target — just focus
      await existing.setFocus();
      return;
    }
  }

  // Build URL with optional query params
  const params = new URLSearchParams();
  if (options?.tab) params.set('tab', options.tab);
  if (options?.settingId) params.set('settingId', options.settingId);
  const query = params.toString();
  const url = `preferences.html${query ? `?${query}` : ''}`;

  // Create a new OS window for preferences
  const prefsWindow = new WebviewWindow(PREFERENCES_WINDOW_LABEL, {
    url,
    title: 'Preferences',
    width: 900,
    height: 640,
    minWidth: 520,
    minHeight: 400,
    center: true,
    resizable: true,
    decorations: true,
    focus: true,
  });

  // Handle creation errors
  prefsWindow.once('tauri://error', (e) => {
    console.error('Failed to create preferences window:', e);
  });
}

/**
 * Close the Preferences window if it's open.
 */
export async function closePreferencesWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(PREFERENCES_WINDOW_LABEL);
  if (existing) {
    await existing.close();
  }
}
