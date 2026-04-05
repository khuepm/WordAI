/**
 * exportService - Legacy Export module for WordAI
 *
 * Handles exporting documents to .md / .docx and importing from legacy files.
 * This module is intentionally separate from AuraBrain sync — export is an
 * explicit user action with a Native_File_Dialog; it does NOT change AuraBrain
 * state or update the Dirty_Bit.
 *
 * Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 7.1, 7.5, 8.1, 8.9, 8.10
 */

import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResult {
  document: Document;
  /** UUID if the file contains an Aura_Tag pointing to an existing Intent */
  auraIntentId?: string;
  /** List of Unsupported_Element types encountered during import */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Dialog abstraction
// Wraps @tauri-apps/plugin-dialog so the rest of the service stays testable.
// In the Tauri runtime the real plugin is used; in tests this can be replaced.
// ---------------------------------------------------------------------------

type DialogFilter = { name: string; extensions: string[] };

type SaveDialogOptions = {
  defaultPath?: string;
  filters?: DialogFilter[];
};

type OpenDialogOptions = {
  defaultPath?: string;
  filters?: DialogFilter[];
  multiple?: boolean;
};

/**
 * Opens a native save-file dialog.
 * Returns the chosen path string, or null if the user cancelled.
 *
 * Uses @tauri-apps/plugin-dialog at runtime. Falls back to null in
 * non-Tauri environments (browser dev mode, tests).
 */
async function openSaveDialog(options: SaveDialogOptions): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dialog = await (Function('return import("@tauri-apps/plugin-dialog")')() as Promise<any>);
    const result: string | null = await dialog.save(options);
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Opens a native open-file dialog.
 * Returns the chosen path string, or null if the user cancelled.
 */
async function openOpenDialog(options: OpenDialogOptions): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dialog = await (Function('return import("@tauri-apps/plugin-dialog")')() as Promise<any>);
    const result: string | string[] | null = await dialog.open({ ...options, multiple: false });
    if (Array.isArray(result)) return result[0] ?? null;
    return result ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Preferences helper
// ---------------------------------------------------------------------------

/**
 * Reads the defaultExportPath preference.
 * Returns empty string if preferences cannot be loaded.
 */
async function getDefaultExportPath(): Promise<string> {
  try {
    const { loadPreferences } = await import('./preferencesService');
    const prefs = await loadPreferences('default');
    // Cast to access the new field — will be properly typed once task 15.1 lands
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prefs.general as any).defaultExportPath ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Export to Markdown
// Requirements: 6.1, 6.2, 6.5, 6.6, 6.7
// ---------------------------------------------------------------------------

/**
 * Opens a Native_File_Dialog for the user to choose a save path, then calls
 * the IPC command `export_markdown` to write the file.
 *
 * Does NOT modify AuraBrain state or the Dirty_Bit after export.
 */
export async function exportMarkdown(document: Document): Promise<void> {
  const defaultPath = await getDefaultExportPath();

  const path = await openSaveDialog({
    defaultPath: defaultPath || undefined,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  // Requirement 6.7: user cancelled — do nothing
  if (!path) return;

  // Requirement 6.3, 6.5: call IPC; throws on failure so caller can notify user
  await invoke('export_markdown', { path, document });

  // Requirement 6.5: AuraBrain state is NOT changed here — intentionally no
  // auraBrainManager calls after this point.
}

// ---------------------------------------------------------------------------
// Export to DOCX
// Requirements: 7.1, 7.5
// ---------------------------------------------------------------------------

/**
 * Opens a Native_File_Dialog for the user to choose a save path, then calls
 * the IPC command `export_docx` (runs in a Background_Worker on the Rust side).
 *
 * Does NOT modify AuraBrain state or the Dirty_Bit after export.
 */
export async function exportDocx(document: Document): Promise<void> {
  const defaultPath = await getDefaultExportPath();

  const path = await openSaveDialog({
    defaultPath: defaultPath || undefined,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  // User cancelled — do nothing
  if (!path) return;

  // Requirement 7.2, 7.5: call IPC; throws on failure so caller can notify user
  await invoke('export_docx', { path, document });

  // Requirement 7.5: AuraBrain state is NOT changed here.
}

// ---------------------------------------------------------------------------
// Import from legacy file
// Requirements: 8.1, 8.9, 8.10
// ---------------------------------------------------------------------------

/**
 * Opens a Native_File_Dialog filtered to .md and .docx, calls IPC
 * `import_file`, and returns the ImportResult for the caller to handle.
 *
 * - If the user cancels the dialog, returns null.
 * - If the file cannot be read/parsed, the IPC throws and the error propagates
 *   to the caller (Requirement 8.9).
 * - If warnings are present (Unsupported_Elements), they are logged and
 *   included in the returned ImportResult (Requirement 8.10).
 *   Full ReplaceConfirmationDialog integration is handled in task 14.
 */
export async function importFile(): Promise<ImportResult | null> {
  const path = await openOpenDialog({
    filters: [
      { name: 'Supported Files', extensions: ['md', 'docx'] },
    ],
  });

  // Requirement 8.1: user cancelled — do nothing
  if (!path) return null;

  // Requirement 8.9: throws if file cannot be read or parsed
  const result = await invoke<ImportResult>('import_file', { path });

  // Requirement 8.10: surface warnings about Unsupported_Elements
  if (result.warnings.length > 0) {
    console.warn(
      '[exportService] Import warnings — unsupported elements encountered:',
      result.warnings,
    );
  }

  return result;
}
