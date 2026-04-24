/**
 * Browser mock for @tauri-apps/api/core
 * Used when running `pnpm dev` outside of Tauri webview.
 * Simulates IPC commands with in-memory / localStorage storage.
 */

import type { Document, DocumentSnapshot } from '../types/document';
import type { AuraIntentDocument, AuraIntentSummary } from '../types/auraDocument';
import { defaultPreferences } from '../types/preferences';
import type { Preferences } from '../types/preferences';

// In-memory version history store
const versionHistory: Record<string, DocumentSnapshot[]> = {};

// In-memory preferences store keyed by userId
const preferencesStore: Record<string, Preferences> = {};
const auraStore: Record<string, AuraIntentDocument> = {};

// In-memory document store (backed by localStorage for persistence)
function storageKey(path: string) {
  return `mock_doc:${path}`;
}

function now() {
  return new Date().toISOString();
}

function makeDoc(id: string, title: string, timestamp: string): Document {
  return {
    id,
    title,
    content: '',
    metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
    version: 1,
    lastModified: new Date(timestamp),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, (args: any) => unknown> = {
  create_document({ id, title, path }: { id: string; title: string; path: string }) {
    const ts = now();
    const doc = makeDoc(id, title, ts);
    // Serialize to match RawDocument shape expected by deserializeDocument
    const raw = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      metadata: {
        word_count: 0,
        reading_time: 0,
        status: 'draft',
        tags: [],
      },
      version: doc.version,
      last_modified: ts,
    };
    localStorage.setItem(storageKey(path), JSON.stringify(raw));
    return raw;
  },

  load_document({ path }: { path: string }) {
    const stored = localStorage.getItem(storageKey(path));
    if (!stored) {
      throw new Error(`FILE_NOT_FOUND: ${path}`);
    }
    return JSON.parse(stored);
  },

  save_document({ path, document }: { path: string; document: Document }) {
    const id = document.id;
    // Push snapshot
    if (!versionHistory[id]) versionHistory[id] = [];
    versionHistory[id].push({
      version: document.version,
      content: document.content,
      timestamp: now(),
    });
    if (versionHistory[id].length > 10) versionHistory[id].shift();

    const raw = {
      id: document.id,
      title: document.title,
      content: document.content,
      metadata: {
        word_count: document.metadata.wordCount,
        reading_time: document.metadata.readingTime,
        status: document.metadata.status,
        tags: document.metadata.tags,
      },
      version: document.version + 1,
      last_modified: now(),
    };
    localStorage.setItem(storageKey(path), JSON.stringify(raw));
    return null;
  },

  sync_intent({ document }: { document: AuraIntentDocument }) {
    const existing = auraStore[document.id];
    const now = Date.now();
    const version = (existing?.version ?? 0) + 1;
    auraStore[document.id] = {
      ...document,
      version,
      created_at: existing?.created_at ?? document.created_at ?? now,
      updated_at: now,
    };
    return version;
  },

  get_intent({ id }: { id: string }) {
    return auraStore[id] ?? null;
  },

  list_intents() {
    return Object.values(auraStore)
      .map((doc): AuraIntentSummary => ({
        id: doc.id,
        intent_name: doc.intent_name,
        created_at: doc.created_at ?? Date.now(),
        updated_at: doc.updated_at ?? Date.now(),
        version: doc.version ?? 1,
      }))
      .sort((a, b) => b.updated_at - a.updated_at);
  },

  export_markdown() {
    return null;
  },

  export_docx() {
    return null;
  },

  import_file() {
    throw new Error('[mock] import_file requires Tauri runtime or a test mock');
  },

  reveal_in_file_manager() {
    return null;
  },

  get_aurabrain_storage_path() {
    return '/tmp/WordAI/AuraBrain';
  },

  get_version_history({ doc_id }: { doc_id: string }) {
    return versionHistory[doc_id] ?? [];
  },

  check_ai_health() {
    return false;
  },

  request_ai_suggestion() {
    return [];
  },

  send_chat_message() {
    return 'Mock AI response (browser dev mode)';
  },

  export_to_pdf() {
    console.warn('[mock] export_to_pdf is a no-op in browser dev mode');
    return null;
  },

  load_preferences({ userId }: { userId: string }) {
    return JSON.parse(JSON.stringify(preferencesStore[userId] ?? defaultPreferences));
  },

  save_preferences({ userId, preferences }: { userId: string; preferences: Preferences }) {
    preferencesStore[userId] = JSON.parse(JSON.stringify(preferences));
    return null;
  },

  reset_preferences({ userId }: { userId: string }) {
    delete preferencesStore[userId];
    return JSON.parse(JSON.stringify(defaultPreferences));
  },
};

export async function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  const handler = handlers[cmd];
  if (!handler) {
    throw new Error(`[tauri mock] Unknown command: ${cmd}`);
  }
  // Simulate async IPC
  await new Promise((r) => setTimeout(r, 0));
  return handler(args ?? {}) as T;
}
