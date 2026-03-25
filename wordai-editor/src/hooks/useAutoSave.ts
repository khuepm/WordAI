/**
 * useAutoSave - Auto-save hook with debounce logic
 * Requirements: 2.1, 2.2, 2.4
 */

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';
import type { IPCError } from '../types/ipc';

const DEBOUNCE_DELAY_MS = 2000;

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
}

/**
 * Debounced auto-save hook that persists document changes via Tauri IPC.
 *
 * @param document    - The current document to save
 * @param filePath    - File path to save the document to
 * @param onSaveSuccess - Called with the updated document (new lastModified) on success
 * @param onSaveError   - Called with the IPCError on failure
 * @returns `{ isSaving, lastSaved }` state
 */
export function useAutoSave(
  document: Document,
  filePath: string,
  onSaveSuccess: (doc: Document) => void,
  onSaveError: (err: IPCError) => void
): AutoSaveState {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Keep stable refs to callbacks so the effect doesn't re-run when they change
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => { onSaveSuccessRef.current = onSaveSuccess; }, [onSaveSuccess]);
  useEffect(() => { onSaveErrorRef.current = onSaveError; }, [onSaveError]);

  useEffect(() => {
    if (!filePath) return;

    const timerId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await invoke('save_document', { path: filePath, document });
        const savedAt = new Date();
        const updatedDoc: Document = { ...document, lastModified: savedAt };
        setLastSaved(savedAt);
        onSaveSuccessRef.current(updatedDoc);
      } catch (err) {
        onSaveErrorRef.current(err as IPCError);
      } finally {
        setIsSaving(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerId);
    // Re-run only when document content or filePath changes (Req 2.1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.content, filePath]);

  return { isSaving, lastSaved };
}
