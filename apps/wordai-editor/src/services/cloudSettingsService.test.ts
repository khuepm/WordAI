/**
 * Unit tests for cloudSettingsService
 * Requirements: 14.3, 14.4, 14.5, 19.1, 19.2, 19.3, 19.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCloudSettings,
  patchCloudSetting,
  uploadAllCloudSettings,
  uploadLocalSettingsOnSignup,
  _resetInternalState,
  _getPendingPatches,
  _getRetryQueueLength,
  _forceFlush,
} from './cloudSettingsService';

// Mock authService's fetchJson
vi.mock('./authService', () => ({
  fetchJson: vi.fn(),
}));

// Mock preferencesService
vi.mock('./preferencesService', () => ({
  loadPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

// Mock types/preferences
vi.mock('../types/preferences', () => ({
  defaultPreferences: {
    general: {
      theme: 'system',
      language: 'en-US',
      focusMode: false,
      autoSave: true,
      autoSyncEnabled: true,
      autoSyncInterval: 30,
      defaultExportFormat: 'markdown',
      defaultExportPath: '',
    },
    aiEngine: {
      agent: 'claude',
      model: 'aura-turbo',
      creativity: 75,
      contextWindowTokens: 16000,
      responseLanguage: 'auto',
      webAccess: true,
    },
    typography: {
      fontFamily: 'inter',
      fontSize: 'medium',
      lineSpacing: '1.15',
      smartQuotes: true,
      autoCapitalize: false,
      ligatures: true,
    },
    privacy: {
      allowAITraining: false,
      localProcessingOnly: false,
      crashReports: true,
      analyticsEnabled: false,
    },
  },
}));

import { fetchJson } from './authService';
import { loadPreferences } from './preferencesService';

const mockFetchJson = vi.mocked(fetchJson);
const mockLoadPreferences = vi.mocked(loadPreferences);

describe('cloudSettingsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetInternalState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    _resetInternalState();
    vi.useRealTimers();
  });

  describe('fetchCloudSettings', () => {
    it('calls GET /user/preferences with session header and returns settings', async () => {
      const mockSettings = { 'general.theme': 'dark', 'ai-engine.model': 'gpt-4' };
      mockFetchJson.mockResolvedValueOnce({
        settings: mockSettings,
        updated_at: '2024-01-01T00:00:00Z',
      });

      const result = await fetchCloudSettings('session-123');

      expect(mockFetchJson).toHaveBeenCalledWith(
        expect.stringContaining('/user/preferences'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Session-Id': 'session-123',
          }),
        }),
      );
      expect(result).toEqual(mockSettings);
    });

    it('propagates errors from fetchJson', async () => {
      mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchCloudSettings('session-123')).rejects.toThrow('Network error');
    });
  });

  describe('patchCloudSetting', () => {
    it('accumulates changes in pending patches', async () => {
      await patchCloudSetting('session-1', 'general.theme', 'dark');

      expect(_getPendingPatches()).toEqual({ 'general.theme': 'dark' });
    });

    it('batches multiple changes within the debounce window', async () => {
      await patchCloudSetting('session-1', 'general.theme', 'dark');
      await patchCloudSetting('session-1', 'ai-engine.model', 'gpt-4');

      expect(_getPendingPatches()).toEqual({
        'general.theme': 'dark',
        'ai-engine.model': 'gpt-4',
      });
    });

    it('sends a single PATCH after debounce timer expires', async () => {
      mockFetchJson.mockResolvedValueOnce({ updated_at: '2024-01-01T00:00:00Z' });

      await patchCloudSetting('session-1', 'general.theme', 'dark');
      await patchCloudSetting('session-1', 'ai-engine.model', 'gpt-4');

      // Before timer fires, no API call
      expect(mockFetchJson).not.toHaveBeenCalled();

      // Advance past debounce window
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockFetchJson).toHaveBeenCalledTimes(1);
      expect(mockFetchJson).toHaveBeenCalledWith(
        expect.stringContaining('/user/preferences'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            settings: { 'general.theme': 'dark', 'ai-engine.model': 'gpt-4' },
          }),
        }),
      );
    });

    it('resets debounce timer on each new change', async () => {
      mockFetchJson.mockResolvedValueOnce({ updated_at: '2024-01-01T00:00:00Z' });

      await patchCloudSetting('session-1', 'general.theme', 'dark');

      // Advance 800ms (not yet expired)
      await vi.advanceTimersByTimeAsync(800);
      expect(mockFetchJson).not.toHaveBeenCalled();

      // Add another change — resets the timer
      await patchCloudSetting('session-1', 'ai-engine.model', 'gpt-4');

      // Advance another 800ms (1600ms total, but only 800ms since last change)
      await vi.advanceTimersByTimeAsync(800);
      expect(mockFetchJson).not.toHaveBeenCalled();

      // Advance remaining 200ms to complete the 1000ms debounce
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFetchJson).toHaveBeenCalledTimes(1);
    });

    it('queues for retry on network failure without reverting', async () => {
      mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

      await patchCloudSetting('session-1', 'general.theme', 'dark');

      // Flush the debounce
      await vi.advanceTimersByTimeAsync(1000);

      // Should have attempted the call
      expect(mockFetchJson).toHaveBeenCalledTimes(1);

      // Should be queued for retry
      expect(_getRetryQueueLength()).toBe(1);
    });
  });

  describe('uploadAllCloudSettings', () => {
    it('sends all settings in a single PATCH request', async () => {
      mockFetchJson.mockResolvedValueOnce({ updated_at: '2024-01-01T00:00:00Z' });

      const settings = { 'general.theme': 'dark', 'typography.fontSize': 'large' };
      await uploadAllCloudSettings('session-1', settings);

      expect(mockFetchJson).toHaveBeenCalledWith(
        expect.stringContaining('/user/preferences'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'X-Session-Id': 'session-1',
          }),
          body: JSON.stringify({ settings }),
        }),
      );
    });

    it('propagates errors from the API', async () => {
      mockFetchJson.mockRejectedValueOnce(new Error('Server error'));

      await expect(
        uploadAllCloudSettings('session-1', { 'general.theme': 'dark' }),
      ).rejects.toThrow('Server error');
    });
  });

  describe('_forceFlush', () => {
    it('immediately sends pending patches without waiting for debounce', async () => {
      mockFetchJson.mockResolvedValueOnce({ updated_at: '2024-01-01T00:00:00Z' });

      await patchCloudSetting('session-1', 'general.theme', 'dark');
      await _forceFlush('session-1');

      expect(mockFetchJson).toHaveBeenCalledTimes(1);
      expect(_getPendingPatches()).toEqual({});
    });
  });

  describe('uploadLocalSettingsOnSignup', () => {
    it('loads local preferences and uploads only CLOUD_SETTINGS keys in flat dot-notation', async () => {
      mockLoadPreferences.mockResolvedValueOnce({
        general: {
          theme: 'dark',
          language: 'vi',
          focusMode: true,
          autoSave: { enabled: true, intervalMinutes: 5 },
          autoSyncEnabled: true,
          autoSyncInterval: 15,
          defaultExportFormat: 'docx',
          defaultExportPath: '/local/path', // LOCAL_SETTING — should NOT be uploaded
        },
        aiEngine: {
          agent: 'claude',
          model: 'gpt-4',
          creativity: 80,
          contextWindowTokens: 32000,
          responseLanguage: 'vi',
          webAccess: false,
        },
        typography: {
          fontFamily: 'roboto',
          fontSize: 'large',
          lineSpacing: '1.5',
          smartQuotes: false,
          autoCapitalize: true,
          ligatures: false,
        },
        privacy: {
          allowAITraining: true,
          localProcessingOnly: true,
          crashReports: false, // LOCAL_SETTING — should NOT be uploaded
          analyticsEnabled: true, // LOCAL_SETTING — should NOT be uploaded
        },
      } as unknown as import('../types/preferences').Preferences);

      mockFetchJson.mockResolvedValueOnce({ updated_at: '2024-01-01T00:00:00Z' });

      await uploadLocalSettingsOnSignup('session-signup');

      expect(mockLoadPreferences).toHaveBeenCalledWith('default');
      expect(mockFetchJson).toHaveBeenCalledTimes(1);

      const callArgs = mockFetchJson.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      // Should include cloud settings
      expect(body.settings['general.theme']).toBe('dark');
      expect(body.settings['general.language']).toBe('vi');
      expect(body.settings['general.focusMode']).toBe(true);
      expect(body.settings['ai-engine.agent']).toBe('claude');
      expect(body.settings['ai-engine.model']).toBe('gpt-4');
      expect(body.settings['typography.fontFamily']).toBe('roboto');
      expect(body.settings['privacy.allowAITraining']).toBe(true);
      expect(body.settings['privacy.localProcessingOnly']).toBe(true);

      // Should NOT include local settings
      expect(body.settings['general.defaultExportPath']).toBeUndefined();
      expect(body.settings['privacy.crashReports']).toBeUndefined();
      expect(body.settings['privacy.analyticsEnabled']).toBeUndefined();
    });

    it('does not call API when no cloud settings are found', async () => {
      mockLoadPreferences.mockResolvedValueOnce({} as unknown as import('../types/preferences').Preferences);

      await uploadLocalSettingsOnSignup('session-signup');

      expect(mockFetchJson).not.toHaveBeenCalled();
    });

    it('does not throw when loadPreferences fails', async () => {
      mockLoadPreferences.mockRejectedValueOnce(new Error('Storage unavailable'));

      // Should not throw — best-effort
      await expect(uploadLocalSettingsOnSignup('session-signup')).resolves.toBeUndefined();
      expect(mockFetchJson).not.toHaveBeenCalled();
    });

    it('does not throw when API call fails', async () => {
      mockLoadPreferences.mockResolvedValueOnce({
        general: { theme: 'dark' },
      } as unknown as import('../types/preferences').Preferences);
      mockFetchJson.mockRejectedValueOnce(new Error('Server error'));

      // Should not throw — best-effort
      await expect(uploadLocalSettingsOnSignup('session-signup')).resolves.toBeUndefined();
    });
  });
});
