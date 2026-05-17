/**
 * Unit tests for cloudSettingsService
 * Requirements: 14.3, 14.4, 14.5, 19.1, 19.2, 19.3, 19.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCloudSettings,
  patchCloudSetting,
  uploadAllCloudSettings,
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

const mockFetchJson = vi.mocked(fetchJson);

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
});
