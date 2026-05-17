/**
 * archiveFilters — Pure filter, sort, and display utilities for the Archive view.
 *
 * Extracted as standalone functions so they can be tested independently
 * of the React component (Property 2, Property 3, Property 4).
 *
 * Requirements: 3.3, 3.6, 3.7, 5.3, 8.3
 */

import type {
  ArchivedIntentSummary,
  ArchivedVersion,
  ArchiveFilters,
} from '../types/archiveTypes';

/**
 * Map from user-facing filter type names to the internal `archive_type` values.
 */
const TYPE_MAP: Record<ArchiveFilters['types'][number], ArchivedIntentSummary['archive_type']> = {
  suggestions: 'draft',
  versions: 'version',
  paused_projects: 'project_doc',
};

/**
 * Map from date range filter values to the number of days to look back.
 */
const DAYS_MAP: Record<Exclude<ArchiveFilters['dateRange'], 'all'>, number> = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
};

/**
 * Apply text search, type filter, and date range filter to a list of archived items,
 * then sort by `archived_at` descending.
 *
 * - Text search: case-insensitive substring match on `intent_name` or `archive_reason`
 * - Type filter: maps user-facing types to internal `archive_type` values
 * - Date range filter: keeps items archived within the specified number of days
 *
 * Property 2: Archive filter correctness.
 * Validates: Requirements 3.3, 3.6, 3.7
 */
export function applyArchiveFilters(
  items: ArchivedIntentSummary[],
  query: string,
  filters: ArchiveFilters,
): ArchivedIntentSummary[] {
  let result = items;

  // Step 1: Text search (case-insensitive substring)
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 0) {
    const q = trimmedQuery.toLowerCase();
    result = result.filter(
      (item) =>
        item.intent_name.toLowerCase().includes(q) ||
        item.archive_reason.toLowerCase().includes(q),
    );
  }

  // Step 2: Type filter
  if (filters.types.length > 0) {
    const allowed = new Set(filters.types.map((t) => TYPE_MAP[t]));
    result = result.filter((item) => allowed.has(item.archive_type));
  }

  // Step 3: Date range filter
  if (filters.dateRange !== 'all') {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - DAYS_MAP[filters.dateRange] * 86400;
    result = result.filter((item) => item.archived_at >= cutoff);
  }

  // Step 4: Sort by archived_at descending
  result = [...result].sort((a, b) => b.archived_at - a.archived_at);

  return result;
}

/**
 * Sort archived versions by `archived_at` descending.
 *
 * For any adjacent pair (a, b) in the result: `a.archived_at >= b.archived_at`.
 *
 * Property 3: Version list sorting invariant.
 * Validates: Requirement 5.3
 */
export function sortVersionsByDate(versions: ArchivedVersion[]): ArchivedVersion[] {
  return [...versions].sort((a, b) => b.archived_at - a.archived_at);
}

/**
 * Truncate an archive reason string for display.
 *
 * - If reason is null, undefined, or empty → returns placeholder text
 * - If reason.length ≤ maxLength (default 200) → returns reason unchanged
 * - If reason.length > maxLength → returns first maxLength chars + "…"
 *
 * Property 4: Archive reason truncation correctness.
 * Validates: Requirement 8.3
 */
export function truncateReason(
  reason: string | null | undefined,
  maxLength: number = 200,
  placeholder: string = 'No reason provided',
): string {
  if (reason == null || reason.length === 0) {
    return placeholder;
  }
  if (reason.length <= maxLength) {
    return reason;
  }
  return reason.slice(0, maxLength) + '…';
}
