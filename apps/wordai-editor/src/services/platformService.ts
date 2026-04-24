import { invoke } from '@tauri-apps/api/core';

export async function getAuraBrainStoragePath(): Promise<string> {
  try {
    const path = await invoke<string>('get_aurabrain_storage_path');
    return typeof path === 'string' ? path : '';
  } catch {
    return '';
  }
}

export function getFileManagerLabel(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'Reveal in Finder';
  if (platform.includes('win')) return 'Reveal in Explorer';
  return 'Reveal in File Manager';
}
