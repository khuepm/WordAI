/**
 * Archive Management types
 * Requirements: 3.5, 3.6, 4.1, 4.2, 5.3, 6.3, 7.9, 10.3
 */

import type { AuraDocumentBlock } from './auraDocument';

/** Summary of an archived item for list display */
export interface ArchivedIntentSummary {
  id: string;
  intent_name: string;
  archived_at: number;
  archive_reason: string;
  archive_type: 'draft' | 'version' | 'project_doc';
  related_current_id: string | null;
  memory_access_enabled: boolean;
  created_at: number;
  updated_at: number;
  version: number;
}

/** Full archived document with content */
export interface ArchivedIntentDocument extends ArchivedIntentSummary {
  content: AuraDocumentBlock[];
  description: string;
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
  document_ids: string[];
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

/** Filter state for archive search */
export interface ArchiveFilters {
  types: Array<'suggestions' | 'versions' | 'paused_projects'>;
  dateRange: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'all';
}

/** Archive sidebar category */
export type ArchiveCategory = 'drafts' | 'projects' | 'versions' | 'trash';

/** AI Summary loading state */
export interface AISummaryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  text: string | null;
  retryCount: number;
  maxRetries: number;
}
