/**
 * Property-based tests for QuickSearchPopup filter logic
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import { filterSettings } from './QuickSearchPopup';
import { SETTING_REGISTRY } from '../data/settingRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a diverse set of non-empty query strings to exercise the filter */
function nonEmptyQueries(): string[] {
  return [
    // Single characters
    'a', 'e', 'f', 't', 's',
    // Common words that appear in labels/descriptions/keywords
    'theme', 'font', 'save', 'ai', 'privacy', 'language',
    // Uppercase variants (case-insensitivity check)
    'THEME', 'Font', 'AI', 'PRIVACY',
    // Partial matches
    'auto', 'crea', 'local', 'crash',
    // Keyword-only matches
    'dark mode', 'zen mode', 'turbo', 'telemetry',
    // Strings that match nothing (edge case — still non-empty)
    'zzzzzzzzz', '12345678',
  ];
}

// ---------------------------------------------------------------------------
// Property 3: For any non-empty query, every result contains the query
//             in label, description, or at least one keyword (case-insensitive)
// ---------------------------------------------------------------------------

describe('Property 3: Every result matches the query (case-insensitive)', () => {
  for (const query of nonEmptyQueries()) {
    it(`query "${query}" — all results contain the query`, () => {
      const results = filterSettings(query);
      const q = query.toLowerCase();

      for (const entry of results) {
        const matchesLabel = entry.label.toLowerCase().includes(q);
        const matchesDescription = entry.description.toLowerCase().includes(q);
        const matchesKeyword = entry.keywords.some((kw) => kw.toLowerCase().includes(q));

        expect(
          matchesLabel || matchesDescription || matchesKeyword,
          `Entry "${entry.id}" does not match query "${query}"`
        ).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Property 4: When query is empty, result count equals SETTING_REGISTRY length
// ---------------------------------------------------------------------------

describe('Property 4: Empty query returns the full registry', () => {
  it('empty string returns all entries', () => {
    expect(filterSettings('').length).toBe(SETTING_REGISTRY.length);
  });

  it('whitespace-only string returns all entries', () => {
    expect(filterSettings('   ').length).toBe(SETTING_REGISTRY.length);
  });
});
