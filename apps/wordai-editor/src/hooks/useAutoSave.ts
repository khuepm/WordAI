/**
 * useAutoSave - Auto-save hook with debounce logic and manual save support
 * Requirements: 2.1, 2.2, 2.4, 2.5, 17.2, 17.3, 21.2
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';
import type { IPCError } from '../types/ipc';

const DEBOUNCE_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: IPCError | null;
  hasUnsavedChanges: boolean;
  /** Trigger an immediate save (e.g. from Cmd+S). Req 21.2 */
  triggerSave: () => Promise<void>;
}

/**
 * Debounced auto-save hook that persists document changes via Tauri IPC.
 *
 * @param document    - The current document to save
 * @param filePath    - File path to save the document to
 * @param onSaveSuccess - Called with the updated document (new lastModified) on success
 * @param onSaveError   - Called with the IPCError on failure
 * @returns `{ isSaving, lastSaved, saveError, hasUnsavedChanges }` state
 */
export function useAutoSave(
  document: Document,
  filePath: string,
  onSaveSuccess: (doc: Document) => void,
  onSaveError: (err: IPCError) => void,
  enabled = true
): AutoSaveState {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<IPCError | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep stable refs to callbacks and latest document/path so triggerSave is always fresh
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const onSaveErrorRef = useRef(onSaveError);
  const documentRef = useRef(document);
  const filePathRef = useRef(filePath);
  useEffect(() => { onSaveSuccessRef.current = onSaveSuccess; }, [onSaveSuccess]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);
  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { filePathRef.current = filePath; }, [filePath]);

  /** Shared save logic used by both auto-save and manual save (Req 21.2) */
  const performSave = useCallback(async (doc: Document, path: string) => {
    if (!path) return;
    setIsSaving(true);
    try {
      await invoke('save_document', { path, document: doc });
      const savedAt = new Date();
      const updatedDoc: Document = { ...doc, lastModified: savedAt };
      setLastSaved(savedAt);
      setSaveError(null);
      setHasUnsavedChanges(false);
      onSaveSuccessRef.current(updatedDoc);
    } catch (err) {
      const ipcErr = err as IPCError;
      setSaveError(ipcErr);
      onSaveErrorRef.current(ipcErr);
    } finally {
      setIsSaving(false);
    }
  }, []);

  /** Immediately save the current document — for Cmd+S (Req 21.2) */
  const triggerSave = useCallback(async () => {
    await performSave(documentRef.current, filePathRef.current);
  }, [performSave]);

  // Mark unsaved changes whenever content changes (Req 17.2)
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [document.content]);

  // Debounced auto-save (Req 2.1, 2.2, 2.4)
  useEffect(() => {
    if (!filePath || !enabled) return;
    const timerId = setTimeout(() => performSave(document, filePath), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.content, filePath, performSave, enabled]);

  // Retry after 5 seconds on error (Req 2.5)
  useEffect(() => {
    if (!saveError || !filePath || !enabled) return;
    const retryId = setTimeout(() => performSave(document, filePath), RETRY_DELAY_MS);
    return () => clearTimeout(retryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError, filePath, performSave, enabled]);

  return { isSaving, lastSaved, saveError, hasUnsavedChanges, triggerSave };
}
