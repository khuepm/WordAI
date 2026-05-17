/**
 * Tests for syncCloudSettingsOnLogin — Req 15.1, 15.2, 15.3
 *
 * Verifies:
 * - Cloud settings are fetched and merged over local preferences (server wins)
 * - Merged preferences are applied via the callback
 * - On failure: error callback is invoked with the correct message
 * - Empty cloud settings result in no merge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCloudSettingsOnLogin, _resetInternalState } from './cloudSettingsService';

// Mock dependencies
vi.mock('./authService', () => ({
  fetchJson: vi.fn(),
}));

vi.mock('./preferencesService', () => ({
  loadPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

vi.mock('../types/preferences', () => ({
  defaultPreferences: {
    general: { theme: 'system', language: 'en-US', focusMode: false },
    aiEngine: { agent: 'claude', model: 'aura-turbo' },
    typography: { fontFamily: 'inter', fontSize: 'medium' },
    privacy: { allowAITraining: false, localProcessingOnly: false },
  },
}));

import { fetchJson } from './authService';
import { loadPreferences, savePreferences } from './preferencesService';

const mockFetchJson = vi.mocked(fetchJson);
const mockLoadPreferences = vi.mocked(loadPreferences);
const mockSavePreferences = vi.mocked(savePreferences);

describe('syncCloudSettingsOnLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetInternalState();
  });

  it('fetches cloud settings and merges server values over local (Req 15.1, 15.2)', async () => {
    // Local preferences
    const localPrefs = {
      general: { theme: 'light', language: 'en-US', focusMode: false, defaultExportPath: '/local/path' },
      aiEngine: { agent: 'claude', model: 'aura-turbo' },
      typography: { fontFamily: 'inter', fontSize: 'medium' },
      privacy: { allowAITraining: false, localProcessingOnly: false },
    };

    // Cloud settings from server (server wins)
    const cloudSettings = {
      'general.theme': 'dark',
      'general.language': 'vi',
      'ai-engine.model': 'gpt-4',
      'typography.fontFamily': 'roboto',
    };

    mockFetchJson.mockResolvedValueOnce({ settings: cloudSettings, updated_at: '2024-01-01T00:00:00Z' });
    mockLoadPreferences.mockResolvedValueOnce(localPrefs as any);
    mockSavePreferences.mockResolvedValueOnce(undefined);

    const applyPreferences = vi.fn();
    const onError = vi.fn();

    await syncCloudSettingsOnLogin('session-123', { applyPreferences, onError });

    // Verify fetch was called with correct session ID
    expect(mockFetchJson).toHaveBeenCalledWith(
      expect.stringContaining('/user/preferences'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Session-Id': 'session-123' }),
      }),
    );

    // Verify merged preferences were saved
    expect(mockSavePreferences).toHaveBeenCalledWith('default', expect.objectContaining({
      general: expect.objectContaining({
        theme: 'dark', // server wins
        language: 'vi', // server wins
        defaultExportPath: '/local/path', // local preserved
      }),
      aiEngine: expect.objectContaining({
        model: 'gpt-4', // server wins
        agent: 'claude', // unchanged
      }),
      typography: expect.objectContaining({
        fontFamily: 'roboto', // server wins
        fontSize: 'medium', // unchanged
      }),
    }));

    // Verify applyPreferences was called with merged result
    expect(applyPreferences).toHaveBeenCalledWith(expect.objectContaining({
      general: expect.objectContaining({ theme: 'dark', language: 'vi' }),
      aiEngine: expect.objectContaining({ model: 'gpt-4' }),
      typography: expect.objectContaining({ fontFamily: 'roboto' }),
    }));

    // No error
    expect(onError).not.toHaveBeenCalled();
  });

  it('does nothing when cloud settings are empty (new user with no saved prefs)', async () => {
    mockFetchJson.mockResolvedValueOnce({ settings: {}, updated_at: '2024-01-01T00:00:00Z' });

    const applyPreferences = vi.fn();
    const onError = vi.fn();

    await syncCloudSettingsOnLogin('session-123', { applyPreferences, onError });

    // Should not load local prefs or save anything
    expect(mockLoadPreferences).not.toHaveBeenCalled();
    expect(mockSavePreferences).not.toHaveBeenCalled();
    expect(applyPreferences).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError with correct message when fetch fails (Req 15.3)', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

    const applyPreferences = vi.fn();
    const onError = vi.fn();

    await syncCloudSettingsOnLogin('session-123', { applyPreferences, onError });

    // Should not apply preferences
    expect(applyPreferences).not.toHaveBeenCalled();

    // Should call onError with the correct message
    expect(onError).toHaveBeenCalledWith('Settings sync failed. Using local preferences.');
  });

  it('calls onError when savePreferences fails (Req 15.3)', async () => {
    const cloudSettings = { 'general.theme': 'dark' };
    const localPrefs = {
      general: { theme: 'light' },
      aiEngine: {},
      typography: {},
      privacy: {},
    };

    mockFetchJson.mockResolvedValueOnce({ settings: cloudSettings, updated_at: '2024-01-01T00:00:00Z' });
    mockLoadPreferences.mockResolvedValueOnce(localPrefs as any);
    mockSavePreferences.mockRejectedValueOnce(new Error('Save failed'));

    const applyPreferences = vi.fn();
    const onError = vi.fn();

    await syncCloudSettingsOnLogin('session-123', { applyPreferences, onError });

    expect(applyPreferences).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Settings sync failed. Using local preferences.');
  });

  it('maps ai-engine keys to aiEngine in the merged object', async () => {
    const cloudSettings = {
      'ai-engine.agent': 'openai',
      'ai-engine.creativity': 90,
    };
    const localPrefs = {
      general: {},
      aiEngine: { agent: 'claude', model: 'aura-turbo', creativity: 75 },
      typography: {},
      privacy: {},
    };

    mockFetchJson.mockResolvedValueOnce({ settings: cloudSettings, updated_at: '2024-01-01T00:00:00Z' });
    mockLoadPreferences.mockResolvedValueOnce(localPrefs as any);
    mockSavePreferences.mockResolvedValueOnce(undefined);

    const applyPreferences = vi.fn();

    await syncCloudSettingsOnLogin('session-123', { applyPreferences });

    expect(applyPreferences).toHaveBeenCalledWith(expect.objectContaining({
      aiEngine: expect.objectContaining({
        agent: 'openai', // server wins
        model: 'aura-turbo', // unchanged
        creativity: 90, // server wins
      }),
    }));
  });

  it('does not call onError when onError is not provided and fetch fails', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

    const applyPreferences = vi.fn();

    // Should not throw
    await expect(
      syncCloudSettingsOnLogin('session-123', { applyPreferences }),
    ).resolves.toBeUndefined();

    expect(applyPreferences).not.toHaveBeenCalled();
  });
});
