/**
 * libraryFilters — Pure filter utilities for the Library view.
 *
 * Extracted as standalone functions so they can be tested independently
 * of the React component (Property 3, Property 4).
 *
 * Requirements: 7.2, 7.3, 8.2, 8.3, 8.6
 */

import type { AuraIntentSummary } from '../types/auraDocument';

export type LibraryFilter = 'all' | 'documents' | 'ai-ready' | 'templates' | 'research' | 'references' | 'reports' | 'verified';

/**
 * Case-insensitive substring match on `intent_name`.
 * Empty query returns all intents unchanged.
 *
 * Property 3: Search filter is a correct case-insensitive substring match.
 * Validates: Requirements 7.2, 7.3
 */
export function applySearchFilter(
  intents: AuraIntentSummary[],
  query: string,
): AuraIntentSummary[] {
  if (!query) return intents;
  const lower = query.toLowerCase();
  return intents.filter((intent) =>
    intent.intent_name.toLowerCase().includes(lower),
  );
}

/**
 * Filter by chip category.
 * - 'all'        → all intents
 * - 'documents'  → all intents (reserved for future sub-type tagging)
 * - 'ai-ready'   → intents with version >= 2
 * - 'templates'  → reserved for future template tagging
 * - 'research'   → reserved for future research tagging
 * - 'references' → reserved for future reference tagging
 * - 'reports'    → reserved for future report tagging
 * - 'verified'   → intents with version >= 3
 *
 * Requirements: 8.2, 8.3
 */
export function applyFilterChip(
  intents: AuraIntentSummary[],
  filter: LibraryFilter,
): AuraIntentSummary[] {
  if (filter === 'ai-ready') {
    return intents.filter((intent) => intent.version >= 2);
  }
  if (filter === 'verified') {
    return intents.filter((intent) => intent.version >= 3);
  }
  // 'all', 'documents', 'templates', 'research', 'references', 'reports' all return everything
  // (reserved for future sub-type tagging)
  return intents;
}

/**
 * Compose search filter and chip filter, then sort by updated_at descending.
 *
 * Property 4: Search and filter chip composition is idempotent and correct.
 * Validates: Requirements 8.2, 8.3, 8.6
 */
export function applyFilters(
  intents: AuraIntentSummary[],
  query: string,
  filter: LibraryFilter,
): AuraIntentSummary[] {
  const afterSearch = applySearchFilter(intents, query);
  const afterFilter = applyFilterChip(afterSearch, filter);
  return [...afterFilter].sort((a, b) => b.updated_at - a.updated_at);
}
