/**
 * useAutoSave - Auto-save hook with debounce logic
 * Requirements: 2.1, 2.2, 2.4, 2.5, 17.2, 17.3
 */

import { useState, useEffect, useRef } from 'react';
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
  onSaveError: (err: IPCError) => void
): AutoSaveState {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<IPCError | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep stable refs to callbacks so the effect doesn't re-run when they change
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => { onSaveSuccessRef.current = onSaveSuccess; }, [onSaveSuccess]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);

  // Mark unsaved changes whenever content changes (Req 17.2)
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [document.content]);

  useEffect(() => {
    if (!filePath) return;

    const timerId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await invoke('save_document', { path: filePath, document });
        const savedAt = new Date();
        const updatedDoc: Document = { ...document, lastModified: savedAt };
        setLastSaved(savedAt);
        setSaveError(null);
        setHasUnsavedChanges(false); // Req 17.3
        onSaveSuccessRef.current(updatedDoc);
      } catch (err) {
        const ipcErr = err as IPCError;
        setSaveError(ipcErr); // Req 2.5
        onSaveErrorRef.current(ipcErr);
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerId);
    // Re-run only when document content or filePath changes (Req 2.1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.content, filePath]);

  // Retry after 5 seconds on error (Req 2.5)
  useEffect(() => {
    if (!saveError || !filePath) return;

    const retryId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await invoke('save_document', { path: filePath, document });
        const savedAt = new Date();
        const updatedDoc: Document = { ...document, lastModified: savedAt };
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
    }, RETRY_DELAY_MS);

    return () => clearTimeout(retryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError, filePath]);

  return { isSaving, lastSaved, saveError, hasUnsavedChanges };
}
