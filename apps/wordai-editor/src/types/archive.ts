/**
 * Archive Management types
 * Requirements: 2.1, 3.5, 4.1, 5.1, 6.1, 7.1
 */

import type { AuraDocumentBlock } from './auraDocument';

/** Summary of an archived item for list display */
export interface ArchivedIntentSummary {
  id: string;
  intent_name: string;
  archived_at: number; // Unix timestamp (seconds)
  archive_reason: string;
  archive_type: 'draft' | 'version' | 'project_doc';
  related_current_id: string | null;
  memory_access_enabled: boolean;
  created_at: number;
  updated_at: number;
  version: number;
  project_id: string | null;
}

/** Full archived document with content */
export interface ArchivedIntentDocument extends ArchivedIntentSummary {
  content: AuraDocumentBlock[];
}

/** AI suggestion for review */
export interface ArchiveSuggestion {
  id: string;
  archive_item_id: string;
  category: 'unused_concept' | 'referenced_work' | 'outdated_draft' | 'related_research';
  title: string;
  description: string;
  archived_at: number;
  relevance_score: number;
}

/** Paused project folder */
export interface PausedProject {
  id: string;
  name: string;
  description: string;
  document_count: number;
  paused_at: number;
}

/** Archived version of a specific document */
export interface ArchivedVersion {
  id: string;
  intent_name: string;
  version: number;
  archived_at: number;
  archive_reason: string;
  related_current_id: string | null;
}

/** Filter state */
export interface ArchiveFilters {
  types: Array<'suggestions' | 'versions' | 'paused_projects'>;
  dateRange: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all';
}

/** AI Summary loading state */
export interface AISummaryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  text: string | null;
  retryCount: number;
}

/** Archive sidebar category */
export type ArchiveCategory = 'drafts' | 'projects' | 'versions' | 'trash';
