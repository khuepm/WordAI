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
import { fetchJson } from './authService';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BRIDGE_API_BASE_URL =
  import.meta.env.VITE_BRIDGE_API_URL || 'http://localhost:3001';

/** Debounce window in milliseconds for batching cloud setting patches. */
const DEBOUNCE_MS = 1000;

/** Maximum retry attempts for failed API calls. */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds (exponential backoff base). */
const RETRY_BASE_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Pending settings changes waiting to be sent in the next debounced batch. */
let pendingPatches: Record<string, unknown> = {};

/** Timer handle for the debounce window. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Queue of failed patches awaiting retry. */
interface RetryEntry {
  sessionId: string;
  settings: Record<string, unknown>;
  attempts: number;
}

const retryQueue: RetryEntry[] = [];

/** Timer handle for retry processing. */
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Bridge API: Fetch Cloud Settings (Req 14.3, 15.1, 15.2)
// ---------------------------------------------------------------------------

interface CloudSettingsResponse {
  settings: Record<string, unknown>;
  updated_at: string;
}

/**
 * Fetch all cloud settings from the Bridge API.
 *
 * GET /user/preferences → { settings: Record<string, unknown>, updated_at: string }
 *
 * Returns only the settings object (flat key-value map).
 * On failure, throws the underlying BridgeApiError.
 *
 * Requirements: 14.3, 15.1, 15.2
 */
export async function fetchCloudSettings(
  sessionId: string,
): Promise<Record<string, unknown>> {
  const response = await fetchJson<CloudSettingsResponse>(
    `${BRIDGE_API_BASE_URL}/user/preferences`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
    },
  );
  return response.settings;
}

// ---------------------------------------------------------------------------
// Bridge API: Patch Cloud Setting (Req 14.3, 19.2, 19.3)
// ---------------------------------------------------------------------------

/**
 * Queue a single setting change for debounced batch PATCH to the Bridge API.
 *
 * Multiple calls within the 1-second debounce window are batched into a
 * single PATCH request. On failure, the patch is queued for retry without
 * reverting the UI (optimistic update pattern).
 *
 * Requirements: 14.3, 19.2, 19.3
 */
export async function patchCloudSetting(
  sessionId: string,
  key: string,
  value: unknown,
): Promise<void> {
  // Accumulate the change in the pending batch
  pendingPatches[key] = value;

  // Reset the debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    flushPendingPatches(sessionId);
  }, DEBOUNCE_MS);
}

/**
 * Flush all pending patches as a single PATCH request.
 * On failure, queue for retry (Req 19.3).
 */
async function flushPendingPatches(sessionId: string): Promise<void> {
  const batch = { ...pendingPatches };
  pendingPatches = {};
  debounceTimer = null;

  if (Object.keys(batch).length === 0) return;

  try {
    await sendPatchRequest(sessionId, batch);
  } catch {
    // Network failure: queue for retry, never revert UI (Req 19.3)
    enqueueRetry(sessionId, batch);
  }
}

/**
 * Send a PATCH request to the Bridge API.
 * PATCH /user/preferences → body: { settings: { key: value, ... } }
 */
async function sendPatchRequest(
  sessionId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await fetchJson<{ updated_at: string }>(
    `${BRIDGE_API_BASE_URL}/user/preferences`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({ settings }),
    },
  );
}

// ---------------------------------------------------------------------------
// Bridge API: Upload All Cloud Settings (Req 15.4)
// ---------------------------------------------------------------------------

/**
 * Upload all cloud settings to the Bridge API in a single request.
 * Used after sign-up to persist the user's initial local preferences.
 *
 * Requirements: 15.4
 */
export async function uploadAllCloudSettings(
  sessionId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await sendPatchRequest(sessionId, settings);
}

// ---------------------------------------------------------------------------
// Cloud Settings Reset (Req 11.6, 19.5)
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
 * Requirements: 11.6, 14.1, 14.2, 19.5
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

// ---------------------------------------------------------------------------
// Retry Queue (Req 19.3)
// ---------------------------------------------------------------------------

/**
 * Enqueue a failed patch for retry with exponential backoff.
 * Never reverts the UI — the optimistic local value is retained.
 */
function enqueueRetry(sessionId: string, settings: Record<string, unknown>): void {
  retryQueue.push({ sessionId, settings, attempts: 0 });
  scheduleRetryProcessing();
}

/**
 * Schedule retry processing if not already scheduled.
 */
function scheduleRetryProcessing(): void {
  if (retryTimer !== null) return;

  retryTimer = setTimeout(() => {
    retryTimer = null;
    processRetryQueue();
  }, RETRY_BASE_DELAY_MS);
}

/**
 * Process the retry queue: attempt to resend failed patches.
 * Uses exponential backoff. Entries exceeding MAX_RETRIES are dropped
 * (the local optimistic value is still retained).
 */
async function processRetryQueue(): Promise<void> {
  const entries = retryQueue.splice(0, retryQueue.length);

  for (const entry of entries) {
    entry.attempts += 1;

    if (entry.attempts > MAX_RETRIES) {
      // Give up after max retries — local value is still retained (Req 19.3)
      continue;
    }

    try {
      await sendPatchRequest(entry.sessionId, entry.settings);
    } catch {
      // Still failing — re-enqueue with incremented attempt count
      retryQueue.push(entry);
    }
  }

  // If there are still entries, schedule another round
  if (retryQueue.length > 0) {
    const nextDelay = RETRY_BASE_DELAY_MS * Math.pow(2, retryQueue[0].attempts - 1);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      processRetryQueue();
    }, nextDelay);
  }
}

// ---------------------------------------------------------------------------
// Sync on Login (Req 15.1, 15.2, 15.3)
// ---------------------------------------------------------------------------

/**
 * Sync cloud settings after a successful login or session restoration.
 *
 * 1. Fetches cloud settings from the Bridge API.
 * 2. Merges server values over local preferences (server wins for all CLOUD_SETTINGS keys).
 * 3. Applies merged preferences via the provided callback so the UI re-renders immediately.
 * 4. On failure: calls the onError callback with a user-facing message.
 *
 * Requirements: 15.1, 15.2, 15.3
 */
export async function syncCloudSettingsOnLogin(
  sessionId: string,
  options: {
    /** Callback to apply merged preferences to the store/state (triggers UI re-render). */
    applyPreferences: (prefs: Record<string, unknown>) => void;
    /** Called on failure with a user-facing error message. */
    onError?: (message: string) => void;
  },
): Promise<void> {
  try {
    const cloudSettings = await fetchCloudSettings(sessionId);

    if (Object.keys(cloudSettings).length === 0) {
      // No cloud settings stored yet — nothing to merge
      return;
    }

    // Load current local preferences
    let localPrefs: Record<string, unknown>;
    try {
      const loaded = await loadPreferences('default');
      localPrefs = (typeof loaded === 'object' && loaded !== null)
        ? loaded as Record<string, unknown>
        : {};
    } catch {
      localPrefs = {};
    }

    // Merge: server wins for all CLOUD_SETTINGS keys
    const merged = mergeCloudOverLocal(localPrefs, cloudSettings);

    // Persist merged preferences locally
    await savePreferences('default', merged as Parameters<typeof savePreferences>[1]);

    // Apply to store so UI re-renders immediately (theme, font, AI model, etc.)
    options.applyPreferences(merged);
  } catch {
    // Req 15.3 — On failure: retain local values, show non-blocking toast
    if (options.onError) {
      options.onError('Settings sync failed. Using local preferences.');
    }
  }
}

/**
 * Merge cloud settings over local preferences.
 * Server wins for all keys that map to CLOUD_SETTINGS.
 *
 * Cloud settings keys use dot notation (e.g., 'general.theme', 'ai-engine.model').
 * The local preferences object uses nested structure (e.g., { general: { theme: '...' } }).
 * The cloud settings response is a flat key-value map.
 */
function mergeCloudOverLocal(
  local: Record<string, unknown>,
  cloud: Record<string, unknown>,
): Record<string, unknown> {
  // Deep clone local to avoid mutation
  const merged = JSON.parse(JSON.stringify(local)) as Record<string, unknown>;

  for (const [dotKey, value] of Object.entries(cloud)) {
    // Map dot-notation key to nested path
    // e.g., 'general.theme' → ['general', 'theme']
    // e.g., 'ai-engine.model' → ['aiEngine', 'model']
    const parts = dotKey.split('.');
    if (parts.length !== 2) continue;

    let [section, key] = parts;

    // Map 'ai-engine' to 'aiEngine' to match the Preferences interface
    if (section === 'ai-engine') {
      section = 'aiEngine';
    }

    // Ensure the section exists
    if (!merged[section] || typeof merged[section] !== 'object') {
      merged[section] = {};
    }

    // Server wins: overwrite local value with cloud value
    (merged[section] as Record<string, unknown>)[key] = value;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Test helpers (exported for testing only)
// ---------------------------------------------------------------------------

/**
 * Cancel any pending debounce timer and clear the pending patches.
 * Used in tests to reset internal state between test cases.
 */
export function _resetInternalState(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  pendingPatches = {};
  retryQueue.length = 0;
}

/**
 * Get the current pending patches (for testing).
 */
export function _getPendingPatches(): Record<string, unknown> {
  return { ...pendingPatches };
}

/**
 * Get the current retry queue length (for testing).
 */
export function _getRetryQueueLength(): number {
  return retryQueue.length;
}

/**
 * Force flush pending patches immediately (for testing).
 */
export async function _forceFlush(sessionId: string): Promise<void> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  await flushPendingPatches(sessionId);
}
