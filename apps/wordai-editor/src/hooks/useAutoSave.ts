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

  // Reset saveError when disabled (e.g. file not yet persisted)
  useEffect(() => {
    if (!enabled) setSaveError(null);
  }, [enabled]);
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

// ---------------------------------------------------------------------------
// useAutoSync — AuraBrain auto-sync hook
// Requirements: 2.1, 2.2, 2.3, 2.6, 2.7
// ---------------------------------------------------------------------------

import { getState, isDocumentDirty, syncDocument } from '../services/auraBrainManager';
import { notificationDispatcher } from '../services/notificationDispatcher';

const BLUR_DEBOUNCE_MS = 2000;

export interface UseAutoSyncOptions {
  document: Document | null;
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // seconds, range [5, 60]
}

/**
 * Sets up periodic auto-sync and blur-triggered sync for AuraBrain.
 *
 * - Interval timer calls auraBrainManager.sync() every `autoSyncInterval` seconds
 * - Window blur event triggers sync immediately (with debounce)
 * - Debounce: skip blur-triggered sync if Date.now() - lastSyncedAt < 2000ms
 * - Skip if isSyncing = true
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7
 */
export function useAutoSync(options: UseAutoSyncOptions): void {
  const { document, autoSyncEnabled, autoSyncInterval: rawInterval } = options;

  // Clamp autoSyncInterval to valid range [5, 60] seconds
  const autoSyncInterval = Math.max(5, Math.min(60, rawInterval));

  const documentRef = useRef(document);
  useEffect(() => { documentRef.current = document; }, [document]);

  // Interval-based sync (Req 2.1)
  // Track remaining seconds for countdown notification (Req 7.5)
  const remainingRef = useRef(autoSyncInterval);

  useEffect(() => {
    if (!autoSyncEnabled) return;

    // Reset remaining seconds when interval changes
    remainingRef.current = autoSyncInterval;

    // Countdown threshold: start showing countdown 60s before sync (or full interval if < 60s)
    const countdownThreshold = Math.min(60, autoSyncInterval);

    // Tick every second to emit countdown events
    const tickId = setInterval(() => {
      remainingRef.current -= 1;

      // Emit countdown when within threshold
      if (remainingRef.current <= countdownThreshold && remainingRef.current > 0) {
        notificationDispatcher.dispatch({
          sourceKey: 'autoSync.countdown',
          trigger: 'onEvent',
          data: { remainingSeconds: remainingRef.current },
          timestamp: Date.now(),
        });
      }
    }, 1000);

    // Actual sync at the full interval
    const intervalMs = autoSyncInterval * 1000;
    const syncId = setInterval(() => {
      const doc = documentRef.current;
      if (!doc) return;

      // Reset countdown
      remainingRef.current = autoSyncInterval;

      // Emit autoSync.tick each interval (Req 7.5)
      notificationDispatcher.dispatch({
        sourceKey: 'autoSync.tick',
        trigger: 'onEvent',
        data: { remainingSeconds: remainingRef.current },
        timestamp: Date.now(),
      });

      const state = getState();
      if (state.isSyncing) {
        // Emit autoSync.skip when skipping due to syncing (Req 7.5)
        notificationDispatcher.dispatch({
          sourceKey: 'autoSync.skip',
          trigger: 'onEvent',
          data: { reason: 'syncing' },
          timestamp: Date.now(),
        });
        return; // Req 2.7
      }
      void isDocumentDirty(doc).then((dirty) => {
        if (!dirty) {
          // Emit autoSync.skip when skipping due to clean document (Req 7.5)
          notificationDispatcher.dispatch({
            sourceKey: 'autoSync.skip',
            trigger: 'onEvent',
            data: { reason: 'clean' },
            timestamp: Date.now(),
          });
        } else {
          void syncDocument(doc, 'auto');
        }
      });
    }, intervalMs);

    return () => { clearInterval(tickId); clearInterval(syncId); };
  }, [autoSyncEnabled, autoSyncInterval]);

  // Blur-triggered sync with debounce (Req 2.2, 2.6)
  useEffect(() => {
    if (!autoSyncEnabled) return;

    const handleBlur = () => {
      const doc = documentRef.current;
      if (!doc) return;
      const state = getState();
      if (state.isSyncing) return; // Req 2.7
      // Debounce: skip if last sync was within 2000ms (Req 2.6)
      if (state.lastSyncedAt !== null && Date.now() - state.lastSyncedAt < BLUR_DEBOUNCE_MS) return;
      void isDocumentDirty(doc).then((dirty) => {
        if (dirty) void syncDocument(doc, 'blur');
      });
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [autoSyncEnabled]);
}
