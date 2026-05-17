/**
 * Property-based tests for archiveFilters utilities
 *
 * Property 2: Archive filter correctness
 * Validates: Requirements 3.3, 3.6, 3.7
 *
 * Property 4: Archive reason truncation correctness
 * Validates: Requirements 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyArchiveFilters, truncateReason } from './archiveFilters';
import type { ArchivedIntentSummary, ArchiveFilters } from '../types/archive';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const archiveTypeArb = fc.constantFrom('draft', 'version', 'project_doc') as fc.Arbitrary<
  ArchivedIntentSummary['archive_type']
>;

const archivedIntentSummaryArb: fc.Arbitrary<ArchivedIntentSummary> = fc.record({
  id: fc.uuid(),
  intent_name: fc.string({ minLength: 0, maxLength: 50 }),
  archived_at: fc.integer({ min: 0, max: 2_000_000_000 }),
  archive_reason: fc.string({ minLength: 0, maxLength: 100 }),
  archive_type: archiveTypeArb,
  related_current_id: fc.option(fc.uuid(), { nil: null }),
  memory_access_enabled: fc.boolean(),
  created_at: fc.integer({ min: 0, max: 2_000_000_000 }),
  updated_at: fc.integer({ min: 0, max: 2_000_000_000 }),
  version: fc.integer({ min: 1, max: 100 }),
  project_id: fc.option(fc.uuid(), { nil: null }),
});

const filterTypesArb = fc.subarray(
  ['suggestions', 'versions', 'paused_projects'] as const,
  { minLength: 0, maxLength: 3 },
) as fc.Arbitrary<ArchiveFilters['types']>;

const dateRangeArb = fc.constantFrom(
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'all',
) as fc.Arbitrary<ArchiveFilters['dateRange']>;

const archiveFiltersArb: fc.Arbitrary<ArchiveFilters> = fc.record({
  types: filterTypesArb,
  dateRange: dateRangeArb,
});

const queryArb = fc.string({ minLength: 0, maxLength: 30 });

// ---------------------------------------------------------------------------
// Type mapping (mirrors the implementation's TYPE_MAP)
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<ArchiveFilters['types'][number], ArchivedIntentSummary['archive_type']> = {
  suggestions: 'draft',
  versions: 'version',
  paused_projects: 'project_doc',
};

const DAYS_MAP: Record<Exclude<ArchiveFilters['dateRange'], 'all'>, number> = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
};

// ---------------------------------------------------------------------------
// Property 2: Archive filter correctness
// Validates: Requirements 3.3, 3.6, 3.7
// ---------------------------------------------------------------------------

describe('Property 2: Archive filter correctness', () => {
  it('returns exactly the items satisfying ALL filter criteria simultaneously', () => {
    fc.assert(
      fc.property(
        fc.array(archivedIntentSummaryArb, { minLength: 0, maxLength: 20 }),
        queryArb,
        archiveFiltersArb,
        (items, query, filters) => {
          const result = applyArchiveFilters(items, query, filters);

          const trimmedQuery = query.trim().toLowerCase();
          const now = Math.floor(Date.now() / 1000);

          // Compute expected set using an independent reference implementation
          const expected = items.filter((item) => {
            // Text search criterion
            if (trimmedQuery.length > 0) {
              const matchesName = item.intent_name.toLowerCase().includes(trimmedQuery);
              const matchesReason = item.archive_reason.toLowerCase().includes(trimmedQuery);
              if (!matchesName && !matchesReason) return false;
            }

            // Type filter criterion
            if (filters.types.length > 0) {
              const allowed = new Set(filters.types.map((t) => TYPE_MAP[t]));
              if (!allowed.has(item.archive_type)) return false;
            }

            // Date range criterion
            if (filters.dateRange !== 'all') {
              const cutoff = now - DAYS_MAP[filters.dateRange] * 86400;
              if (item.archived_at < cutoff) return false;
            }

            return true;
          });

          // Same set of items (by id)
          const resultIds = new Set(result.map((r) => r.id));
          const expectedIds = new Set(expected.map((e) => e.id));
          expect(resultIds).toEqual(expectedIds);

          // Same count
          expect(result.length).toBe(expected.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result is sorted by archived_at in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(archivedIntentSummaryArb, { minLength: 0, maxLength: 20 }),
        queryArb,
        archiveFiltersArb,
        (items, query, filters) => {
          const result = applyArchiveFilters(items, query, filters);

          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].archived_at).toBeGreaterThanOrEqual(result[i].archived_at);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result is always a subset of the input', () => {
    fc.assert(
      fc.property(
        fc.array(archivedIntentSummaryArb, { minLength: 0, maxLength: 20 }),
        queryArb,
        archiveFiltersArb,
        (items, query, filters) => {
          const result = applyArchiveFilters(items, query, filters);
          const inputIds = new Set(items.map((i) => i.id));

          for (const item of result) {
            expect(inputIds.has(item.id)).toBe(true);
          }

          expect(result.length).toBeLessThanOrEqual(items.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty query + empty types + all dateRange returns all items (sorted)', () => {
    fc.assert(
      fc.property(
        fc.array(archivedIntentSummaryArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const result = applyArchiveFilters(items, '', { types: [], dateRange: 'all' });

          expect(result.length).toBe(items.length);

          // Verify sorted descending
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].archived_at).toBeGreaterThanOrEqual(result[i].archived_at);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 4: Archive reason truncation correctness
// Validates: Requirements 8.3
// ---------------------------------------------------------------------------

describe('Property 4: Archive reason truncation correctness', () => {
  /**
   * **Validates: Requirements 8.3**
   */

  it('returns input unchanged when length is ≤ 200 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (reason) => {
          const result = truncateReason(reason);
          expect(result).toBe(reason);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('truncates to first 200 characters followed by "…" when length > 200', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 1000 }),
        (reason) => {
          const result = truncateReason(reason);
          expect(result).toBe(reason.slice(0, 200) + '…');
          expect(result.length).toBe(201); // 200 chars + 1 ellipsis char
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns placeholder text for null, undefined, or empty string input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        (reason) => {
          const result = truncateReason(reason as string | null | undefined);
          expect(result).toBe('No reason provided');
        },
      ),
      { numRuns: 10 },
    );
  });

  it('returns custom placeholder when reason is null/undefined/empty and placeholder is provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        fc.string({ minLength: 1, maxLength: 100 }),
        (reason, placeholder) => {
          const result = truncateReason(reason as string | null | undefined, 200, placeholder);
          expect(result).toBe(placeholder);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('output length never exceeds 201 characters (200 + ellipsis)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 2000 }),
        (reason) => {
          const result = truncateReason(reason);
          // If input is empty, result is placeholder (19 chars for default)
          // If input ≤ 200, result = input (≤ 200 chars)
          // If input > 200, result = 200 chars + "…" = 201 chars
          expect(result.length).toBeLessThanOrEqual(201);
        },
      ),
      { numRuns: 200 },
    );
  });
});
