/**
 * preferencesService - Tauri IPC wrappers for preferences operations
 * Requirements: 6.1, 7.1, 7.3, 7.4
 */

import { invoke } from '@tauri-apps/api/core';
import type { Preferences } from '../types/preferences';

/**
 * Load preferences for a user via Tauri IPC.
 * Requirements: 7.1
 */
export async function loadPreferences(userId: string): Promise<Preferences> {
  return invoke<Preferences>('load_preferences', { userId });
}

/**
 * Save preferences for a user via Tauri IPC.
 * Requirements: 7.3
 */
export async function savePreferences(userId: string, preferences: Preferences): Promise<void> {
  await invoke('save_preferences', { userId, preferences });
}

/**
 * Reset preferences for a user (optionally a specific group) via Tauri IPC.
 * Requirements: 7.4
 */
export async function resetPreferences(userId: string, group?: string): Promise<Preferences> {
  return invoke<Preferences>('reset_preferences', { userId, group });
}
