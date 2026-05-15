/**
 * exportService - Legacy Export module for WordAI
 *
 * Handles exporting documents to .md / .docx and importing from legacy files.
 * This module is intentionally separate from AuraBrain sync — export is an
 * explicit user action with a Native_File_Dialog; it does NOT change AuraBrain
 * state or update the Dirty_Bit.
 *
 * Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 7.1, 7.5, 8.1, 8.4, 8.5, 8.6,
 *               8.7, 8.8, 8.9, 8.10
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import type {
  AuraImportResult,
  AuraIntentDocument,
} from "../types/auraDocument";
import type { ImportProgressEvent, PDFExportOptions } from "../types/export";
import type { Document } from "../types/document";
import {
  auraIntentToDocument,
  documentToAuraIntent,
} from "./auraDocumentAdapter";
import { syncDocument } from "./auraBrainManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportResult =
  | { status: "cancelled" }
  | { status: "success"; path: string }
  | { status: "error"; message: string };

export type ImportFlowResult =
  | { status: "cancelled" }
  | { status: "opened"; document: Document; warnings: string[] }
  | { status: "error"; message: string };

/**
 * Callback invoked when an imported file's Aura_Tag matches an existing Intent.
 * The caller (UI layer) must present a ReplaceConfirmationDialog and resolve
 * with the user's choice.
 *
 * Requirements: 8.4, 8.5, 8.6
 */
export type ConflictResolutionCallback = (
  intentName: string,
  auraIntentId: string,
) => Promise<"update" | "create_new" | "cancel">;

/**
 * Callback invoked when the selected file is between 20-100MB.
 * The caller (UI layer) must present a FileSizeWarningDialog and resolve
 * with the user's choice: true to proceed, false to cancel.
 *
 * Requirements: 25.2, 25.4
 */
export type FileSizeWarningCallback = (
  fileSizeMB: number,
  estimatedSeconds: number,
) => Promise<boolean>;

/**
 * Options for importFile — allows the caller to inject conflict resolution UI,
 * file size warning UI, and an optional callback to open the imported intent
 * in the editor.
 *
 * Requirements: 8.4, 8.8, 25.1, 25.2, 26.6
 */
export interface ImportOptions {
  /**
   * Called when the imported file has an Aura_Tag that matches an existing
   * Intent. Must return the user's choice.
   */
  onConflict?: ConflictResolutionCallback;
  /**
   * Called when the selected file is between 20-100MB. Must return true to
   * proceed with import or false to cancel.
   * Requirements: 25.2, 25.4
   */
  onFileSizeWarning?: FileSizeWarningCallback;
  /**
   * Called after a successful "Cập nhật Intent" so the editor can open the
   * updated intent and clear the Unsaved_Indicator.
   * Requirements: 8.8
   */
  onOpenIntent?: (document: Document) => void;
  /**
   * Called when import progress events are received from the Rust backend.
   * The backend emits `import-progress` events during large file imports.
   * Requirements: 26.6
   */
  onProgress?: (progress: ImportProgressEvent) => void;
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
 * Uses @tauri-apps/plugin-dialog at runtime. Falls back to null when the
 * dialog plugin is unavailable (browser dev mode, tests).
 */
async function openSaveDialog(
  options: SaveDialogOptions,
): Promise<string | null> {
  try {
    const result = await saveDialog(options);
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Opens a native open-file dialog.
 * Returns the chosen path string, or null if the user cancelled.
 */
async function openOpenDialog(
  options: OpenDialogOptions,
): Promise<string | null> {
  try {
    const result = await openDialog({ ...options, multiple: false });
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
    const { loadPreferences } = await import("./preferencesService");
    const prefs = await loadPreferences("default");
    // Cast to access the new field — will be properly typed once task 15.1 lands
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prefs.general as any).defaultExportPath ?? "";
  } catch {
    return "";
  }
}

function ensureExtension(
  path: string,
  extension: "md" | "docx" | "pdf",
): string {
  const expected = `.${extension}`;
  return path.toLowerCase().endsWith(expected) ? path : `${path}${expected}`;
}

/**
 * Converts a document title into a safe filename stem.
 * e.g. "My Great Article!" → "My Great Article"
 *      "Hello / World"     → "Hello - World"
 */
function titleToFilename(title: string): string {
  return title
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-') // replace path-unsafe chars with dash
    .replace(/-{2,}/g, '-')         // collapse consecutive dashes
    .replace(/^-+|-+$/g, '')        // trim leading/trailing dashes
    || 'Untitled Intent';
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
export async function exportMarkdown(
  document: Document,
): Promise<ExportResult> {
  const defaultPath = await getDefaultExportPath();
  const filename = titleToFilename(document.title) + '.md';
  const suggestedPath = defaultPath ? `${defaultPath}/${filename}` : filename;

  const selectedPath = await openSaveDialog({
    defaultPath: suggestedPath,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  // Requirement 6.7: user cancelled — do nothing
  if (!selectedPath) return { status: "cancelled" };

  try {
    const path = ensureExtension(selectedPath, "md");
    const { value: auraDocument } = documentToAuraIntent(document);
    await invoke("export_markdown", { path, document: auraDocument });
    return { status: "success", path };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

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
export async function exportDocx(document: Document): Promise<ExportResult> {
  const defaultPath = await getDefaultExportPath();
  const filename = titleToFilename(document.title) + '.docx';
  const suggestedPath = defaultPath ? `${defaultPath}/${filename}` : filename;

  const selectedPath = await openSaveDialog({
    defaultPath: suggestedPath,
    filters: [{ name: "Word Document", extensions: ["docx"] }],
  });

  // User cancelled — do nothing
  if (!selectedPath) return { status: "cancelled" };

  try {
    const path = ensureExtension(selectedPath, "docx");
    const { value: auraDocument } = documentToAuraIntent(document);
    await invoke("export_docx", { path, document: auraDocument });
    return { status: "success", path };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Requirement 7.5: AuraBrain state is NOT changed here.
}

// ---------------------------------------------------------------------------
// Export to PDF
// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
// ---------------------------------------------------------------------------

/**
 * Opens a Native_File_Dialog for the user to choose a save path, then calls
 * the IPC command `export_to_pdf` to generate and write the PDF file.
 *
 * Flattens the nested `margins` object into the flat shape expected by the
 * Rust PDFExportOptions struct (snake_case fields, no nesting).
 *
 * Does NOT modify AuraBrain state or the Dirty_Bit after export.
 */
export async function exportPdf(
  document: Document,
  pdfOptions: PDFExportOptions,
): Promise<ExportResult> {
  const defaultPath = await getDefaultExportPath();
  const filename = titleToFilename(document.title) + '.pdf';
  const suggestedPath = defaultPath ? `${defaultPath}/${filename}` : filename;

  const selectedPath = await openSaveDialog({
    defaultPath: suggestedPath,
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });

  if (!selectedPath) return { status: "cancelled" };

  try {
    const path = ensureExtension(selectedPath, "pdf");
    await invoke("export_to_pdf", {
      content: document.content,
      outputPath: path,
      options: {
        page_size: pdfOptions.pageSize,
        margin_top: pdfOptions.margins.top,
        margin_bottom: pdfOptions.margins.bottom,
        margin_left: pdfOptions.margins.left,
        margin_right: pdfOptions.margins.right,
        font_size: pdfOptions.fontSize,
      },
    });
    return { status: "success", path };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Import from legacy file
// Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10
// ---------------------------------------------------------------------------

/**
 * Opens a Native_File_Dialog filtered to .md and .docx, calls IPC
 * `import_file`, resolves any Aura_Tag conflict via the provided callback,
 * and syncs the resulting document into AuraBrain.
 *
 * Flow:
 *  1. Open file dialog (Req 8.1)
 *  1b. Check file size via `get_file_size` (Req 25.1, 25.7)
 *      - > 100MB → error, return early (Req 25.3)
 *      - 20-100MB → show FileSizeWarningDialog, wait for confirmation (Req 25.2)
 *      - < 20MB → proceed normally
 *  2. Call IPC `import_file` — throws on parse error (Req 8.9)
 *  3. Surface Unsupported_Element warnings (Req 8.10)
 *  4. If `auraIntentId` present → check AuraBrain for existing intent (Req 8.4)
 *     a. Exists → call `onConflict` callback → user picks update / create_new / cancel
 *        - "update"     → sync with original id, call onOpenIntent (Req 8.5, 8.8)
 *        - "create_new" → sync with new UUID (Req 8.6)
 *        - "cancel"     → abort, no side effects
 *     b. Not found → create new intent with filename as name (Req 8.7)
 *  5. If no `auraIntentId` → create new intent (Req 8.7)
 *
 * Returns the final Document that was synced, or null if the user cancelled.
 */
export async function importFile(
  options: ImportOptions = {},
): Promise<ImportFlowResult> {
  const { onConflict, onFileSizeWarning, onOpenIntent, onProgress } = options;

  const path = await openOpenDialog({
    filters: [{ name: "Supported Files", extensions: ["md", "docx"] }],
  });

  // Requirement 8.1: user cancelled dialog — do nothing
  if (!path) return { status: "cancelled" };

  // ── File size validation (Requirements 25.1 – 25.4, 25.7) ─────────────────
  let fileSizeBytes: number;
  try {
    fileSizeBytes = await invoke<number>("get_file_size", { path });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  // Requirement 25.3: file > 100MB — reject immediately
  if (fileSizeMB > 100) {
    return {
      status: "error",
      message: `File quá lớn (${fileSizeMB.toFixed(1)} MB). Giới hạn tối đa là 100 MB.`,
    };
  }

  // Requirement 25.2: file 20-100MB — show warning dialog, wait for confirmation
  if (fileSizeMB >= 20) {
    const estimatedSeconds = Math.ceil(fileSizeMB / 5);
    if (onFileSizeWarning) {
      const confirmed = await onFileSizeWarning(fileSizeMB, estimatedSeconds);
      // Requirement 25.4: user cancelled — do not read file
      if (!confirmed) return { status: "cancelled" };
    }
  }

  // ── Set up progress listener (Requirement 26.6) ────────────────────────────
  // Listen to `import-progress` events emitted by the Rust backend during import.
  // The listener is cleaned up (unlisten) when import completes, errors, or is cancelled.
  let unlisten: UnlistenFn | null = null;
  if (onProgress) {
    try {
      unlisten = await listen<ImportProgressEvent>(
        "import-progress",
        (event) => {
          onProgress(event.payload);
        },
      );
    } catch {
      // If listen fails (e.g. in test environment), proceed without progress tracking
      unlisten = null;
    }
  }

  // ── Proceed with import ────────────────────────────────────────────────────
  let result: AuraImportResult;
  try {
    result = await invoke<AuraImportResult>("import_file", { path });
  } catch (err) {
    // Unlisten on error
    unlisten?.();
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Requirement 8.10: surface warnings about Unsupported_Elements
  if (result.warnings.length > 0) {
    console.warn(
      "[exportService] Import warnings — unsupported elements encountered:",
      result.warnings,
    );
  }

  const importedDocument = auraIntentToDocument(result.document).value;
  const auraIntentId = result.aura_intent_id ?? null;

  // ── Aura_Tag conflict detection (Requirements 8.4 – 8.8) ──────────────────
  if (auraIntentId) {
    // Check whether this intent already exists in AuraBrain
    let existingIntent: AuraIntentDocument | null = null;
    try {
      existingIntent = await invoke<AuraIntentDocument | null>("get_intent", {
        id: auraIntentId,
      });
    } catch {
      // If the IPC call fails we treat it as "not found" and create a new intent
      existingIntent = null;
    }

    if (existingIntent) {
      // Requirement 8.4: conflict — ask the user what to do
      const choice = onConflict
        ? await onConflict(
            existingIntent.intent_name || "Untitled Intent",
            auraIntentId,
          )
        : "create_new"; // safe default when no UI callback is provided

      if (choice === "cancel") {
        unlisten?.();
        return { status: "cancelled" };
      }

      if (choice === "update") {
        // Requirement 8.5: keep original id and created_at, bump version
        const updatedDoc: Document = {
          ...importedDocument,
          id: auraIntentId,
          metadata: importedDocument.metadata,
          lastModified: new Date(),
        };
        await syncDocument(updatedDoc, "import");
        // Requirement 8.8: open the intent in the editor, clear Unsaved_Indicator
        onOpenIntent?.(updatedDoc);
        // Unlisten after successful import
        unlisten?.();
        return {
          status: "opened",
          document: updatedDoc,
          warnings: result.warnings,
        };
      }

      // choice === 'create_new' — fall through to new-intent creation below
    }
  }

  // Requirement 8.6 / 8.7: no conflict or user chose "create new" — new UUID
  const newDoc: Document = {
    ...importedDocument,
    id: crypto.randomUUID(),
    lastModified: new Date(),
  };
  await syncDocument(newDoc, "import");
  onOpenIntent?.(newDoc);
  // Unlisten after successful import
  unlisten?.();
  return { status: "opened", document: newDoc, warnings: result.warnings };
}
