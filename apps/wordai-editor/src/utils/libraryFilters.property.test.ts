/**
 * Property-based tests for library filter utilities.
 *
 * Feature: library-tab, Property 4: Search and filter chip composition is idempotent and correct
 * **Validates: Requirements 8.2, 8.3, 8.6**
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import type { AuraIntentSummary } from '../types/auraDocument';
import { applyFilters, type LibraryFilter } from './libraryFilters';

// ---------------------------------------------------------------------------
// Arbitrary generators
// ---------------------------------------------------------------------------

function arbitraryAuraIntentSummary(): fc.Arbitrary<AuraIntentSummary> {
  return fc.record({
    id: fc.uuid(),
    intent_name: fc.string({ minLength: 1, maxLength: 100 }),
    created_at: fc.integer({ min: 0, max: Date.now() }),
    updated_at: fc.integer({ min: 0, max: Date.now() }),
    version: fc.integer({ min: 1, max: 100 }),
  });
}

// ---------------------------------------------------------------------------
// Helper: check if a summary matches the filter chip predicate
// ---------------------------------------------------------------------------

function matchesFilter(summary: AuraIntentSummary, filter: LibraryFilter): boolean {
  if (filter === 'ai-ready') return summary.version >= 2;
  // 'all' and 'documents' return everything
  return true;
}

// ---------------------------------------------------------------------------
// Property 4: Search and filter chip composition is idempotent and correct
// Validates: Requirements 8.2, 8.3, 8.6
// ---------------------------------------------------------------------------

describe('Property 4: Search and filter chip composition is idempotent and correct', () => {
  it('applying filters twice produces the same result (idempotence)', () => {
    // Feature: library-tab, Property 4: Search and filter chip composition is idempotent and correct
    // **Validates: Requirements 8.2, 8.3, 8.6**
    fc.assert(
      fc.property(
        fc.array(arbitraryAuraIntentSummary(), { minLength: 0, maxLength: 20 }),
        fc.string(),
        fc.constantFrom('all' as LibraryFilter, 'documents' as LibraryFilter, 'ai-ready' as LibraryFilter),
        (summaries, query, filter) => {
          const result1 = applyFilters(summaries, query, filter);
          const result2 = applyFilters(result1, query, filter);

          // Idempotence: applying the same filters to the already-filtered result
          // produces the same set (since all items already satisfy both predicates,
          // and sorting is stable on the same data)
          if (result1.length !== result2.length) return false;
          for (let i = 0; i < result1.length; i++) {
            if (result1[i].id !== result2[i].id) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all results satisfy both the search predicate and the filter predicate', () => {
    // Feature: library-tab, Property 4: Search and filter chip composition is idempotent and correct
    // **Validates: Requirements 8.2, 8.3, 8.6**
    fc.assert(
      fc.property(
        fc.array(arbitraryAuraIntentSummary(), { minLength: 0, maxLength: 20 }),
        fc.string(),
        fc.constantFrom('all' as LibraryFilter, 'documents' as LibraryFilter, 'ai-ready' as LibraryFilter),
        (summaries, query, filter) => {
          const result = applyFilters(summaries, query, filter);

          // Correctness: every item in the result satisfies both predicates
          return result.every(
            (s) =>
              s.intent_name.toLowerCase().includes(query.toLowerCase()) &&
              matchesFilter(s, filter),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
