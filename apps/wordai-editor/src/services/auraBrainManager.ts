/**
 * auraBrainManager - AuraBrain sync service for WordAI Intent Engine
 *
 * Manages syncing documents into the local AuraBrain SQLite database.
 * Cmd+S means "sync intent to AuraBrain", not "save file".
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 4.1, 4.2, 4.6,
 *               9.1, 9.2, 9.3, 9.4, 9.5
 */

import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncEntry {
  document: Document;
  enqueuedAt: number;
}

export interface SyncResult {
  success: boolean;
  version?: number;
  error?: string;
}

export interface AuraBrainState {
  isSyncing: boolean;
  syncQueue: SyncEntry | null; // max 1 entry — last-write-wins
  lastSyncedHash: string | null; // SHA-256 hex of content at last successful sync
  lastSyncedAt: number | null; // Date.now() of last successful sync
}

// ---------------------------------------------------------------------------
// Internal mutable state
// ---------------------------------------------------------------------------

const state: AuraBrainState = {
  isSyncing: false,
  syncQueue: null,
  lastSyncedHash: null,
  lastSyncedAt: null,
};

// ---------------------------------------------------------------------------
// Hash utility
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a string using the Web Crypto API.
 * Returns a lowercase hex string.
 * Requirements: 1.3, 4.1
 */
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Dirty-bit check
// ---------------------------------------------------------------------------

/**
 * Returns true when the current content differs from the last synced snapshot.
 * Comparison is done via pre-computed hash stored in state.
 *
 * NOTE: This is a synchronous check against the cached hash.
 * Call computeContentHash + compare manually if you need an async fresh check.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export function isDirty(currentHash: string): boolean {
  if (state.lastSyncedHash === null) return false; // new doc, no content yet
  return currentHash !== state.lastSyncedHash;
}

// ---------------------------------------------------------------------------
// Core sync
// ---------------------------------------------------------------------------

/**
 * Execute a single sync IPC call and update state on completion.
 * This is the inner function — callers must manage isSyncing flag.
 */
async function executeSyncIPC(document: Document): Promise<SyncResult> {
  try {
    const version = await invoke<number>('sync_intent', { document });
    const newHash = await computeContentHash(document.content);
    state.lastSyncedHash = newHash;
    state.lastSyncedAt = Date.now();
    return { success: true, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Sync a document into AuraBrain SQLite.
 *
 * - If isSyncing = false: execute immediately, then drain queue if present.
 * - If isSyncing = true: enqueue (last-write-wins — replaces any pending entry).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5
 */
export async function sync(document: Document): Promise<SyncResult> {
  if (state.isSyncing) {
    // Last-write-wins: replace any existing queued entry
    state.syncQueue = { document, enqueuedAt: Date.now() };
    return { success: true }; // queued, not yet persisted
  }

  state.isSyncing = true;
  const result = await executeSyncIPC(document);
  state.isSyncing = false;

  // Drain queue after current sync completes (Requirements 1.6, 9.5)
  if (state.syncQueue !== null) {
    const queued = state.syncQueue;
    state.syncQueue = null;
    // Fire-and-forget: recursive call handles its own isSyncing lifecycle
    void sync(queued.document);
  }

  return result;
}

// ---------------------------------------------------------------------------
// State accessors (read-only snapshot)
// ---------------------------------------------------------------------------

/** Returns a shallow copy of the current AuraBrain state. */
export function getState(): Readonly<AuraBrainState> {
  return { ...state };
}

/** Reset state — intended for testing only. */
export function _resetStateForTesting(): void {
  state.isSyncing = false;
  state.syncQueue = null;
  state.lastSyncedHash = null;
  state.lastSyncedAt = null;
}
