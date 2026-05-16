/**
 * preferencesService unit tests
 * Requirements: 6.1, 7.1, 7.3, 7.4, 7.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPreferences, savePreferences, resetPreferences, validateAutoSyncInterval } from './preferencesService';
import { defaultPreferences, type Preferences } from '../types/preferences';

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock notificationDispatcher
vi.mock('./notificationDispatcher', () => ({
  notificationDispatcher: {
    dispatch: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { notificationDispatcher } from './notificationDispatcher';

const mockInvoke = vi.mocked(invoke);
const mockDispatch = vi.mocked(notificationDispatcher.dispatch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadPreferences', () => {
  it('calls invoke with load_preferences and correct args', async () => {
    mockInvoke.mockResolvedValueOnce(defaultPreferences);

    await loadPreferences('user1');

    expect(mockInvoke).toHaveBeenCalledWith('load_preferences', { userId: 'user1' });
  });

  it('returns the resolved preferences', async () => {
    mockInvoke.mockResolvedValueOnce(defaultPreferences);

    const result = await loadPreferences('user1');

    expect(result).toEqual(defaultPreferences);
  });

  it('rejects with the same error when invoke rejects', async () => {
    const error = new Error('IPC failure');
    mockInvoke.mockRejectedValueOnce(error);

    await expect(loadPreferences('user1')).rejects.toThrow('IPC failure');
  });
});

describe('savePreferences', () => {
  it('calls invoke with save_preferences and correct args', async () => {
    // First call: loadPreferences, second call: save_preferences
    mockInvoke.mockResolvedValueOnce(defaultPreferences); // load
    mockInvoke.mockResolvedValueOnce(null); // save

    await savePreferences('user1', defaultPreferences);

    expect(mockInvoke).toHaveBeenCalledWith('save_preferences', {
      userId: 'user1',
      preferences: defaultPreferences,
    });
  });

  it('emits preference.changed for each changed value', async () => {
    const oldPrefs = { ...defaultPreferences };
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: {
        ...defaultPreferences.general,
        theme: 'dark',
        autoSyncInterval: 15,
      },
    };

    mockInvoke.mockResolvedValueOnce(oldPrefs); // load
    mockInvoke.mockResolvedValueOnce(null); // save

    await savePreferences('user1', newPrefs);

    // Should dispatch for theme change
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: 'preference.changed.general.theme',
        trigger: 'onChange',
        data: expect.objectContaining({
          key: 'general.theme',
          oldValue: 'system',
          newValue: 'dark',
          label: 'Theme',
        }),
      })
    );

    // Should dispatch for autoSyncInterval change
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: 'preference.changed.general.autoSyncInterval',
        trigger: 'onChange',
        data: expect.objectContaining({
          key: 'general.autoSyncInterval',
          oldValue: 30,
          newValue: 15,
          label: 'Auto Sync Interval',
        }),
      })
    );
  });

  it('does not emit preference.changed when no values changed', async () => {
    mockInvoke.mockResolvedValueOnce(defaultPreferences); // load
    mockInvoke.mockResolvedValueOnce(null); // save

    await savePreferences('user1', defaultPreferences);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('emits preference.changed for ai-engine tab with correct mapped key', async () => {
    const newPrefs: Preferences = {
      ...defaultPreferences,
      aiEngine: {
        ...defaultPreferences.aiEngine,
        creativity: 50,
      },
    };

    mockInvoke.mockResolvedValueOnce(defaultPreferences); // load
    mockInvoke.mockResolvedValueOnce(null); // save

    await savePreferences('user1', newPrefs);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: 'preference.changed.ai-engine.creativity',
        trigger: 'onChange',
        data: expect.objectContaining({
          key: 'ai-engine.creativity',
          oldValue: 75,
          newValue: 50,
          label: 'Creativity',
        }),
      })
    );
  });

  it('still saves successfully when loadPreferences fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('load failed')); // load fails
    mockInvoke.mockResolvedValueOnce(null); // save succeeds

    await savePreferences('user1', defaultPreferences);

    expect(mockInvoke).toHaveBeenCalledWith('save_preferences', {
      userId: 'user1',
      preferences: defaultPreferences,
    });
    // No dispatch since we couldn't load old preferences
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('resetPreferences', () => {
  it('calls invoke with reset_preferences and group undefined when no group given', async () => {
    mockInvoke.mockResolvedValueOnce(defaultPreferences);

    await resetPreferences('user1');

    expect(mockInvoke).toHaveBeenCalledWith('reset_preferences', {
      userId: 'user1',
      group: undefined,
    });
  });

  it('calls invoke with reset_preferences and the provided group', async () => {
    mockInvoke.mockResolvedValueOnce(defaultPreferences);

    await resetPreferences('user1', 'general');

    expect(mockInvoke).toHaveBeenCalledWith('reset_preferences', {
      userId: 'user1',
      group: 'general',
    });
  });
});

/**
 * validateAutoSyncInterval unit tests
 * Requirements: 10.4, 10.5
 */
describe('validateAutoSyncInterval', () => {
  it('accepts value at lower boundary (5)', () => {
    expect(validateAutoSyncInterval(5, 30)).toBe(5);
  });

  it('accepts value at upper boundary (60)', () => {
    expect(validateAutoSyncInterval(60, 30)).toBe(60);
  });

  it('accepts value within range', () => {
    expect(validateAutoSyncInterval(30, 10)).toBe(30);
  });

  it('rejects value below 5 and returns previous', () => {
    expect(validateAutoSyncInterval(4, 30)).toBe(30);
    expect(validateAutoSyncInterval(0, 15)).toBe(15);
    expect(validateAutoSyncInterval(-1, 20)).toBe(20);
  });

  it('rejects value above 60 and returns previous', () => {
    expect(validateAutoSyncInterval(61, 30)).toBe(30);
    expect(validateAutoSyncInterval(100, 45)).toBe(45);
  });
});
