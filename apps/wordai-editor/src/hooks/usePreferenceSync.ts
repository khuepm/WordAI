/**
 * usePreferenceSync — Wires preference changes to cloud sync.
 *
 * When preferences change:
 * 1. Updates are already applied to the store immediately (optimistic update by caller).
 * 2. If the changed setting is a Cloud_Setting AND user is authenticated:
 *    → calls patchCloudSetting(sessionId, key, value) which debounces 1s before PATCH.
 * 3. If the changed setting is a Local_Setting OR user is a guest:
 *    → no additional action (localStorage persistence is handled by preferencesService).
 *
 * On sign-out: resetCloudSettingsToDefaults() is called externally (task 8.1).
 * On sign-in: syncCloudSettingsOnLogin() overwrites local with server (task 9.3).
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
 */

import { useEffect, useRef } from 'react';
import type { Preferences } from '../types/preferences';
import type { AccessContext } from '../types/auth';
import { isCloudSetting } from '../data/settingClassification';
import { patchCloudSetting } from '../services/cloudSettingsService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a nested Preferences key path to the dot-notation format used by
 * settingClassification (e.g., { aiEngine: { model: 'x' } } → 'ai-engine.model').
 */
function mapSectionToDotKey(section: string): string {
  if (section === 'aiEngine') return 'ai-engine';
  return section;
}

/**
 * Detect changed keys between two Preferences objects.
 * Returns an array of { dotKey, value } for each changed setting.
 */
export function detectChangedSettings(
  oldPrefs: Preferences,
  newPrefs: Preferences,
): Array<{ dotKey: string; value: unknown }> {
  const changes: Array<{ dotKey: string; value: unknown }> = [];

  const sections = Object.keys(newPrefs) as (keyof Preferences)[];

  for (const section of sections) {
    const oldSection = oldPrefs[section] as Record<string, unknown> | undefined;
    const newSection = newPrefs[section] as Record<string, unknown>;

    if (!oldSection) continue;

    const dotSection = mapSectionToDotKey(section);

    for (const key of Object.keys(newSection)) {
      const oldValue = oldSection[key];
      const newValue = newSection[key];

      // Deep comparison using JSON.stringify
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({ dotKey: `${dotSection}.${key}`, value: newValue });
      }
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UsePreferenceSyncOptions {
  /** Current preferences state (already applied optimistically). */
  preferences: Preferences;
  /** Current access context, or null if guest. */
  accessContext: AccessContext | null;
}

/**
 * Hook that syncs preference changes to the cloud when appropriate.
 *
 * Call this in the component that manages the `preferences` state (App.tsx).
 * It compares the current preferences with the previous render and, for any
 * changed Cloud_Setting keys, calls patchCloudSetting if the user is authenticated.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */
export function usePreferenceSync({ preferences, accessContext }: UsePreferenceSyncOptions): void {
  const prevPrefsRef = useRef<Preferences>(preferences);
  // Track whether this is the initial mount to skip the first "change" detection
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip on initial mount — the first preferences load is not a "change"
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPrefsRef.current = preferences;
      return;
    }

    const oldPrefs = prevPrefsRef.current;
    prevPrefsRef.current = preferences;

    // Detect what changed
    const changes = detectChangedSettings(oldPrefs, preferences);

    if (changes.length === 0) return;

    // Req 19.4, 19.5 — If guest, no cloud sync needed (localStorage already handled)
    if (!accessContext) return;

    const sessionId = accessContext.session.id;

    // Req 19.1, 19.2 — For each changed cloud setting, queue a debounced patch
    for (const { dotKey, value } of changes) {
      if (isCloudSetting(dotKey)) {
        // Req 19.2 — patchCloudSetting already debounces 1s and batches
        // Req 19.3 — On failure, patchCloudSetting queues for retry without reverting UI
        patchCloudSetting(sessionId, dotKey, value);
      }
      // Req 19.4 — Local settings: no additional action needed
      // (preferencesService.savePreferences already persisted to disk)
    }
  }, [preferences, accessContext]);
}
