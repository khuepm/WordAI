/**
 * documentService - Tauri IPC wrappers for document operations
 * Requirements: 1.1, 13.2, 14.1, 14.2, 15.1
 */

import { invoke } from '@tauri-apps/api/core';
import type { Document, DocumentMetadata } from '../types/document';

/** Derive a consistent file path from a document ID */
export function getDocumentPath(id: string): string {
  return `documents/${id}.json`;
}

/** Raw shape returned by Rust serde (snake_case) */
interface RawDocument {
  id: string;
  title: string;
  content: string;
  metadata: {
    word_count: number;
    reading_time: number;
    status: 'draft' | 'archived' | 'published';
    tags: string[];
  };
  version: number;
  last_modified: string;
}

/** Convert the snake_case Rust response to the camelCase TypeScript Document */
export function deserializeDocument(raw: unknown): Document {
  const r = raw as RawDocument;
  const metadata: DocumentMetadata = {
    wordCount: r.metadata.word_count,
    readingTime: r.metadata.reading_time,
    status: r.metadata.status,
    tags: r.metadata.tags,
  };
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    metadata,
    version: r.version,
    lastModified: new Date(r.last_modified),
  };
}

/**
 * Create a new document via Tauri IPC.
 * Requirements: 1.1, 14.1
 */
export async function createDocument(title = 'Untitled'): Promise<Document> {
  const id = crypto.randomUUID();
  const path = getDocumentPath(id);
  const raw = await invoke('create_document', { id, title, path });
  return deserializeDocument(raw);
}

/**
 * Load an existing document from the given path via Tauri IPC.
 * Requirements: 13.2, 14.2
 */
export async function loadDocument(path: string): Promise<Document> {
  const raw = await invoke('load_document', { path });
  return deserializeDocument(raw);
}

/**
 * Save a document to a file path via Tauri IPC.
 * The Rust side increments the version and snapshots history.
 */
export async function saveDocument(path: string, document: Document): Promise<void> {
  await invoke('save_document', { path, document });
}
