/**
 * cloudSettingsService — Cloud settings sync and management.
 *
 * Handles syncing user preferences to/from the Bridge API.
 * Cloud settings are preferences that follow the user across devices.
 *
 * Requirements: 14.3, 14.4, 14.5, 19.1, 19.2, 19.3, 19.4
 */

import { defaultPreferences } from '../types/preferences';
import { loadPreferences, savePreferences } from './preferencesService';

// ---------------------------------------------------------------------------
// Cloud Settings Reset (Req 11.6)
// ---------------------------------------------------------------------------

/**
 * Reset all cloud-classified settings to their default values.
 * Called on sign-out to ensure no user-specific preferences persist locally.
 *
 * Cloud settings include: general.theme, general.language, general.focusMode,
 * general.autoSave, general.autoSyncEnabled, general.autoSyncInterval,
 * general.defaultExportFormat, all ai-engine.*, all typography.*,
 * privacy.allowAITraining, privacy.localProcessingOnly.
 *
 * Local settings (general.defaultExportPath, about.auraBrainStoragePath,
 * privacy.crashReports, privacy.analyticsEnabled) are retained.
 *
 * Requirements: 11.6, 14.1, 14.2
 */
export async function resetCloudSettingsToDefaults(): Promise<void> {
  try {
    const current = await loadPreferences('default');
    const currentObj = (typeof current === 'object' && current !== null) ? current as Record<string, unknown> : {};

    // Preserve local-only settings, reset cloud settings to defaults
    const reset = {
      general: {
        ...defaultPreferences.general,
        // Preserve local-only: defaultExportPath
        defaultExportPath: (currentObj.general as Record<string, unknown>)?.defaultExportPath ?? defaultPreferences.general.defaultExportPath,
      },
      aiEngine: { ...defaultPreferences.aiEngine },
      typography: { ...defaultPreferences.typography },
      privacy: {
        ...defaultPreferences.privacy,
        // Preserve local-only: crashReports, analyticsEnabled
        crashReports: (currentObj.privacy as Record<string, unknown>)?.crashReports ?? defaultPreferences.privacy.crashReports,
        analyticsEnabled: (currentObj.privacy as Record<string, unknown>)?.analyticsEnabled ?? defaultPreferences.privacy.analyticsEnabled,
      },
    };

    await savePreferences('default', reset);
  } catch {
    // Best-effort reset — don't block sign-out on failure
  }
}
