import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuraBrainStoragePath, getFileManagerLabel } from './platformService';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe('platformService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('loads AuraBrain storage path from backend command', async () => {
    mockInvoke.mockResolvedValueOnce('/Users/test/Library/Application Support/WordAI/AuraBrain');

    await expect(getAuraBrainStoragePath()).resolves.toBe('/Users/test/Library/Application Support/WordAI/AuraBrain');
    expect(mockInvoke).toHaveBeenCalledWith('get_aurabrain_storage_path');
  });

  it('returns empty string instead of guessing when backend path lookup fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('path unavailable'));

    await expect(getAuraBrainStoragePath()).resolves.toBe('');
  });

  it('uses platform-specific file manager labels', () => {
    const platformSpy = vi.spyOn(navigator, 'platform', 'get');

    platformSpy.mockReturnValue('MacIntel');
    expect(getFileManagerLabel()).toBe('Reveal in Finder');

    platformSpy.mockReturnValue('Win32');
    expect(getFileManagerLabel()).toBe('Reveal in Explorer');

    platformSpy.mockReturnValue('Linux x86_64');
    expect(getFileManagerLabel()).toBe('Reveal in File Manager');

    platformSpy.mockRestore();
  });
});
