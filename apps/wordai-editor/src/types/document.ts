/**
 * Core document types for WordAI Text Editor
 * Requirements: 1.1, 14.3
 */

export interface Document {
  id: string;
  title: string;
  content: string; // Rich text format (Markdown or custom)
  metadata: DocumentMetadata;
  version: number;
  lastModified: Date;
}

export interface DocumentMetadata {
  wordCount: number;
  readingTime: number; // in minutes
  status: 'draft' | 'archived' | 'published';
  tags: string[];
}

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export interface DocumentVersion {
  version: number;
  content: string;
  timestamp: Date;
  metadata: DocumentMetadata;
}

/** Matches the Rust DocumentSnapshot model returned by get_version_history */
export interface DocumentSnapshot {
  version: number;
  content: string;
  timestamp: string; // ISO 8601
}
