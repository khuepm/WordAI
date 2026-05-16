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
 * If the window is already open, it will be focused instead of creating a new one.
 */
export async function openPreferencesWindow(options?: {
  tab?: Tab;
  settingId?: string;
}): Promise<void> {
  // Check if window already exists
  const existing = await WebviewWindow.getByLabel(PREFERENCES_WINDOW_LABEL);
  if (existing) {
    // Focus the existing window
    await existing.setFocus();
    return;
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
