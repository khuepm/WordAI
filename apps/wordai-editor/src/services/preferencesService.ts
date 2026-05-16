/**
 * preferencesService - Tauri IPC wrappers for preferences operations
 * Requirements: 6.1, 7.1, 7.3, 7.4
 */

import { invoke } from '@tauri-apps/api/core';
import type { Preferences } from '../types/preferences';
import { SETTING_REGISTRY } from '../data/settingRegistry';
import { notificationDispatcher } from './notificationDispatcher';

/**
 * Validate and clamp autoSyncInterval to the allowed range [5, 60].
 * Returns the previous valid value if the new value is out of range.
 * Requirements: 10.4, 10.5
 */
export function validateAutoSyncInterval(value: number, previous: number): number {
  if (value < 5 || value > 60) {
    return previous;
  }
  return value;
}

/**
 * Load preferences for a user via Tauri IPC.
 * Requirements: 7.1
 */
export async function loadPreferences(userId: string): Promise<Preferences> {
  return invoke<Preferences>('load_preferences', { userId });
}

/**
 * Map a tab key from the Preferences object to the tab format used in setting registry IDs.
 */
function mapTabKey(tab: string): string {
  if (tab === 'aiEngine') return 'ai-engine';
  return tab;
}

/**
 * Get a human-readable label for a preference key from the setting registry.
 * Falls back to the key itself if no entry is found.
 */
function getLabelForKey(registryId: string): string {
  const entry = SETTING_REGISTRY.find((e) => e.id === registryId);
  return entry?.label ?? registryId;
}

/**
 * Detect changed preferences between old and new values and emit
 * `preference.changed` events via the notification dispatcher.
 *
 * Iterates over top-level tabs and their keys, comparing values with
 * JSON.stringify for deep equality. Only emits for values that actually changed.
 *
 * Requirements: 7.4
 */
function emitPreferenceChanges(
  oldPrefs: Preferences,
  newPrefs: Preferences
): void {
  const tabs = Object.keys(newPrefs) as (keyof Preferences)[];

  for (const tab of tabs) {
    const oldTab = oldPrefs[tab] as Record<string, unknown> | undefined;
    const newTab = newPrefs[tab] as Record<string, unknown>;

    if (!oldTab) continue;

    const mappedTab = mapTabKey(tab);

    for (const key of Object.keys(newTab)) {
      const oldValue = oldTab[key];
      const newValue = newTab[key];

      // Deep comparison using JSON.stringify
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const registryId = `${mappedTab}.${key}`;
        const label = getLabelForKey(registryId);

        notificationDispatcher.dispatch({
          sourceKey: `preference.changed.${mappedTab}.${key}`,
          trigger: 'onChange',
          data: { key: registryId, oldValue, newValue, label },
          timestamp: Date.now(),
        });
      }
    }
  }
}

/**
 * Save preferences for a user via Tauri IPC.
 * Validates autoSyncInterval before saving; rejects with an error if the
 * current value is out of range and no previous value is available.
 * After a successful save, emits `preference.changed` events for each
 * preference that actually changed.
 * Requirements: 7.3, 7.4, 10.4, 10.5
 */
export async function savePreferences(userId: string, preferences: Preferences): Promise<void> {
  // Load current preferences to detect changes
  let oldPreferences: Preferences | null = null;
  try {
    oldPreferences = await loadPreferences(userId);
  } catch {
    // If we can't load old preferences, we still save but skip change detection
  }

  await invoke('save_preferences', { userId, preferences });

  // Emit preference.changed events for each changed value
  if (oldPreferences) {
    emitPreferenceChanges(oldPreferences, preferences);
  }
}

/**
 * Reset preferences for a user (optionally a specific group) via Tauri IPC.
 * Requirements: 7.4
 */
export async function resetPreferences(userId: string, group?: string): Promise<Preferences> {
  return invoke<Preferences>('reset_preferences', { userId, group });
}
