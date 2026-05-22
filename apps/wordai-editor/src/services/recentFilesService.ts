/**
 * recentFilesService — Track recently opened files & intents.
 *
 * Persists a small list (max 20) of recently opened documents in localStorage.
 * Items can be either AuraBrain intents (no file path) or on-disk files.
 *
 * Used by LibraryView's "Recently Used" section and any other UI that wants
 * a quick history of the user's most recent documents.
 */

const STORAGE_KEY = 'wordai_recent_files';
const MAX_ENTRIES = 20;

export interface RecentFileEntry {
  /** Document id (AuraBrain intent id or generated for file-only docs) */
  id: string;
  /** Display title at the time of opening */
  title: string;
  /** Absolute file path on disk, or null for AuraBrain-only intents */
  filePath: string | null;
  /** ISO 8601 timestamp of when the entry was last opened */
  lastOpenedAt: string;
  /** Optional source: where the open came from */
  source?: 'library' | 'archive' | 'file' | 'startup' | 'new';
}

function readAll(): RecentFileEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentFileEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RecentFileEntry).id === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(entries: RecentFileEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Ignore localStorage quota errors — best-effort tracking
  }
}

/** Returns the recent file list, most recent first. */
export function listRecentFiles(): RecentFileEntry[] {
  return readAll().sort(
    (a, b) =>
      new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );
}

/**
 * Record that a document was just opened. Updates the entry if it already
 * exists (matching by id), otherwise inserts. Trims to MAX_ENTRIES.
 */
export function recordRecentFile(
  entry: Omit<RecentFileEntry, 'lastOpenedAt'>,
): void {
  if (!entry.id) return;
  const all = readAll();
  const existingIdx = all.findIndex((e) => e.id === entry.id);
  const next: RecentFileEntry = {
    ...entry,
    lastOpenedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    all[existingIdx] = { ...all[existingIdx], ...next };
  } else {
    all.unshift(next);
  }
  // Sort newest first, dedupe keeps newest
  const sorted = all.sort(
    (a, b) =>
      new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );
  writeAll(sorted);
}

/** Remove a recent file entry by id. */
export function removeRecentFile(id: string): void {
  const all = readAll().filter((e) => e.id !== id);
  writeAll(all);
}

/** Clear all recent files. */
export function clearRecentFiles(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
