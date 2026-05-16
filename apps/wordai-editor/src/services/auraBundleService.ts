/**
 * auraBundleService — Load/save .aura bundle files
 *
 * Provides both sync (cache-based) and async (disk-based) access to AuraBundle files.
 * The sync `loadBundle` reads from an in-memory cache populated by `preloadBundle` or
 * previous `loadBundleAsync` calls. The async `loadBundleAsync` reads from disk.
 *
 * File path: {appDataDir}/aura/{intentId}.aura.json
 * Strategy: overwrite (no versioning)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 */

import type { AuraBundle } from '../components/prism/types';
import { auraBundleSchema } from '../utils/auraSchema';

// ---------------------------------------------------------------------------
// In-memory cache for sync access
// ---------------------------------------------------------------------------
const bundleCache = new Map<string, AuraBundle>();

// ---------------------------------------------------------------------------
// I/O abstraction — allows mocking in tests and browser dev mode
// ---------------------------------------------------------------------------

export interface AuraBundleIO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  getAppDataDir(): Promise<string>;
}

/**
 * Default I/O implementation using Tauri invoke commands.
 * Falls back gracefully when running outside Tauri (browser dev mode).
 */
const defaultIO: AuraBundleIO = {
  async readFile(path: string): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('plugin:fs|read_text_file', { path });
  },
  async writeFile(path: string, content: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:fs|write_text_file', { path, contents: content });
  },
  async exists(path: string): Promise<boolean> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<boolean>('plugin:fs|exists', { path });
  },
  async mkdir(path: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('plugin:fs|mkdir', { path, options: { recursive: true } });
  },
  async getAppDataDir(): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('plugin:path|resolve_directory', {
      directory: 'AppData',
    });
  },
};

let io: AuraBundleIO = defaultIO;

/**
 * Replace the I/O layer (for testing).
 */
export function setIO(newIO: AuraBundleIO): void {
  io = newIO;
}

/**
 * Reset to default I/O.
 */
export function resetIO(): void {
  io = defaultIO;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

async function getBundlePath(intentId: string): Promise<string> {
  const appData = await io.getAppDataDir();
  // Normalize path separator
  const sep = appData.includes('\\') ? '\\' : '/';
  return `${appData}${sep}aura${sep}${intentId}.aura.json`;
}

async function getAuraDir(): Promise<string> {
  const appData = await io.getAppDataDir();
  const sep = appData.includes('\\') ? '\\' : '/';
  return `${appData}${sep}aura`;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Load AuraBundle synchronously from in-memory cache.
 * Returns null if not cached. Use `preloadBundle` or `loadBundleAsync` to populate cache.
 *
 * This is the sync version called by intentSourceService.
 */
function loadBundle(intentId: string): AuraBundle | null {
  return bundleCache.get(intentId) ?? null;
}

/**
 * Load AuraBundle asynchronously from disk.
 * Reads file, validates with schema, caches result.
 * Returns null if file doesn't exist or is invalid. Never throws.
 */
async function loadBundleAsync(intentId: string): Promise<AuraBundle | null> {
  try {
    const path = await getBundlePath(intentId);
    const fileExists = await io.exists(path);
    if (!fileExists) {
      bundleCache.delete(intentId);
      return null;
    }

    const content = await io.readFile(path);
    const parsed = JSON.parse(content);
    const result = auraBundleSchema.safeParse(parsed);

    if (!result.success) {
      bundleCache.delete(intentId);
      return null;
    }

    const bundle = result.data as unknown as AuraBundle;
    bundleCache.set(intentId, bundle);
    return bundle;
  } catch {
    // I/O error, parse error, etc. — return null
    bundleCache.delete(intentId);
    return null;
  }
}

/**
 * Preload a bundle into cache (async read from disk, populates sync cache).
 * Useful for app startup or when opening a document.
 */
async function preloadBundle(intentId: string): Promise<void> {
  await loadBundleAsync(intentId);
}

/**
 * Save AuraBundle to disk.
 * Validates with schema before writing. Throws if validation fails.
 * Updates lastModified to current ISO 8601 timestamp.
 * Uses overwrite strategy (no versioning).
 */
async function saveBundle(bundle: AuraBundle): Promise<void> {
  // Update lastModified before validation
  const bundleToSave: AuraBundle = {
    ...bundle,
    lastModified: new Date().toISOString(),
  };

  // Validate with schema — throw if invalid
  const result = auraBundleSchema.safeParse(bundleToSave);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`AuraBundle validation failed: ${errors.join('; ')}`);
  }

  // Ensure directory exists
  const dir = await getAuraDir();
  await io.mkdir(dir);

  // Write file (overwrite)
  const path = await getBundlePath(bundleToSave.intentId);
  const content = JSON.stringify(bundleToSave, null, 2);
  await io.writeFile(path, content);

  // Update cache
  bundleCache.set(bundleToSave.intentId, bundleToSave);
}

/**
 * Clear a specific bundle from cache.
 */
function clearCache(intentId?: string): void {
  if (intentId) {
    bundleCache.delete(intentId);
  } else {
    bundleCache.clear();
  }
}

export const auraBundleService = {
  loadBundle,
  loadBundleAsync,
  preloadBundle,
  saveBundle,
  clearCache,
};
