import { invoke } from '@tauri-apps/api/core';
import type { AuraIntentDocument } from '../types/auraDocument';
import type { Document } from '../types/document';
import { documentToAuraIntent } from './auraDocumentAdapter';

export interface SyncEntry {
  document: Document;
  reason: SyncReason;
  enqueuedAt: number;
}

export type SyncReason = 'manual' | 'auto' | 'blur' | 'import' | 'startup';

export interface SyncResult {
  success: boolean;
  version?: number;
  error?: string;
  queued?: boolean;
}

export interface AuraBrainState {
  activeDocumentId: string | null;
  isSyncing: boolean;
  syncQueue: SyncEntry | null;
  lastSyncedHashByDocumentId: Record<string, string>;
  lastSyncedAtByDocumentId: Record<string, number>;
  lastErrorByDocumentId: Record<string, string | null>;
  lastSyncedHash: string | null;
  lastSyncedAt: number | null;
}

const state: AuraBrainState = {
  activeDocumentId: null,
  isSyncing: false,
  syncQueue: null,
  lastSyncedHashByDocumentId: {},
  lastSyncedAtByDocumentId: {},
  lastErrorByDocumentId: {},
  lastSyncedHash: null,
  lastSyncedAt: null,
};

const listeners = new Set<() => void>();
let snapshotCache: Readonly<AuraBrainState> = createSnapshot();

function syncLegacyDerivedFields(documentId: string | null): void {
  const activeId = documentId ?? state.activeDocumentId;
  state.lastSyncedHash = activeId ? state.lastSyncedHashByDocumentId[activeId] ?? null : null;
  state.lastSyncedAt = activeId ? state.lastSyncedAtByDocumentId[activeId] ?? null : null;
}

function createSnapshot(): Readonly<AuraBrainState> {
  return {
    ...state,
    lastSyncedHashByDocumentId: { ...state.lastSyncedHashByDocumentId },
    lastSyncedAtByDocumentId: { ...state.lastSyncedAtByDocumentId },
    lastErrorByDocumentId: { ...state.lastErrorByDocumentId },
  };
}

function notify(): void {
  snapshotCache = createSnapshot();
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Readonly<AuraBrainState> {
  return snapshotCache;
}

export function getState(): Readonly<AuraBrainState> {
  return getSnapshot();
}

export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function setActiveDocument(documentId: string | null): void {
  state.activeDocumentId = documentId;
  syncLegacyDerivedFields(documentId);
  notify();
}

export async function initializeSyncedBaseline(document: Document): Promise<void> {
  const hash = await computeContentHash(document.content);
  state.activeDocumentId = document.id;
  state.lastSyncedHashByDocumentId[document.id] = hash;
  state.lastSyncedAtByDocumentId[document.id] = Date.now();
  state.lastErrorByDocumentId[document.id] = null;
  syncLegacyDerivedFields(document.id);
  notify();
}

export function resetForNewDocument(documentId: string): void {
  state.activeDocumentId = documentId;
  delete state.lastSyncedHashByDocumentId[documentId];
  delete state.lastSyncedAtByDocumentId[documentId];
  state.lastErrorByDocumentId[documentId] = null;
  syncLegacyDerivedFields(documentId);
  notify();
}

export function isDirty(currentHash: string): boolean {
  if (state.lastSyncedHash === null) return false;
  return currentHash !== state.lastSyncedHash;
}

export async function isDocumentDirty(document: Document): Promise<boolean> {
  const baseline = state.lastSyncedHashByDocumentId[document.id];
  const current = await computeContentHash(document.content);
  if (!baseline) return document.content.trim().length > 0;
  return current !== baseline;
}

async function executeSyncIPC(document: Document): Promise<SyncResult> {
  const { value: auraDocument } = documentToAuraIntent(document);
  try {
    const payload: AuraIntentDocument = auraDocument;
    const version = await invoke<number>('sync_intent', { document: payload });
    const newHash = await computeContentHash(document.content);
    state.activeDocumentId = document.id;
    state.lastSyncedHashByDocumentId[document.id] = newHash;
    state.lastSyncedAtByDocumentId[document.id] = Date.now();
    state.lastErrorByDocumentId[document.id] = null;
    syncLegacyDerivedFields(document.id);
    notify();
    return { success: true, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.activeDocumentId = document.id;
    state.lastErrorByDocumentId[document.id] = message;
    syncLegacyDerivedFields(document.id);
    notify();
    return { success: false, error: message };
  }
}

export async function sync(document: Document, reason: SyncReason = 'manual'): Promise<SyncResult> {
  return syncDocument(document, reason);
}

export async function syncDocument(document: Document, reason: SyncReason = 'manual'): Promise<SyncResult> {
  if (state.isSyncing) {
    state.syncQueue = { document, reason, enqueuedAt: Date.now() };
    notify();
    return { success: true, queued: true };
  }

  state.isSyncing = true;
  state.activeDocumentId = document.id;
  notify();

  let result = await executeSyncIPC(document);

  while (state.syncQueue !== null) {
    const queued = state.syncQueue;
    state.syncQueue = null;
    notify();
    result = await executeSyncIPC(queued.document);
  }

  state.isSyncing = false;
  syncLegacyDerivedFields(state.activeDocumentId);
  notify();
  return result;
}

export function getDocumentSyncSnapshot(documentId: string | null | undefined) {
  if (!documentId) {
    return { isSyncing: state.isSyncing, isDirty: false, lastSyncedAt: null, syncError: null };
  }
  return {
    isSyncing: state.isSyncing && state.activeDocumentId === documentId,
    isDirty: false,
    lastSyncedAt: state.lastSyncedAtByDocumentId[documentId] ?? null,
    syncError: state.lastErrorByDocumentId[documentId] ?? null,
  };
}

export function _resetStateForTesting(): void {
  state.activeDocumentId = null;
  state.isSyncing = false;
  state.syncQueue = null;
  state.lastSyncedHashByDocumentId = {};
  state.lastSyncedAtByDocumentId = {};
  state.lastErrorByDocumentId = {};
  state.lastSyncedHash = null;
  state.lastSyncedAt = null;
  notify();
}
