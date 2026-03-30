/**
 * preferencesService unit tests
 * Requirements: 6.1, 7.1, 7.3, 7.4, 7.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPreferences, savePreferences, resetPreferences } from './preferencesService';
import { defaultPreferences } from '../types/preferences';

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

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
    mockInvoke.mockResolvedValueOnce(null);

    await savePreferences('user1', defaultPreferences);

    expect(mockInvoke).toHaveBeenCalledWith('save_preferences', {
      userId: 'user1',
      preferences: defaultPreferences,
    });
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
