/**
 * Property-based tests for QuickSearchPopup filter logic and responsive constraints
 * Validates: Requirements 1.3, 2.2, 2.3, 2.4
 */

// Feature: responsive-modal-system, Property 2: QuickSearchPopup width constraint

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QuickSearchPopup } from './QuickSearchPopup';
import { filterSettings } from './QuickSearchPopup';
import { SETTING_REGISTRY } from '../data/settingRegistry';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ---------------------------------------------------------------------------
// Property 2: QuickSearchPopup width constraint
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------

describe('Property 2: QuickSearchPopup width constraint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dialog maxWidth style uses the correct CSS variable for any viewport width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 2560 }),
        (vw) => {
          // Mock window.innerWidth
          vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(vw);

          const { unmount } = render(
            createElement(QuickSearchPopup, {
              isOpen: true,
              onClose: () => {},
              onSelect: () => {},
            })
          );

          const dialog = screen.getByRole('dialog');
          const maxWidth = dialog.style.maxWidth;

          unmount();

          // jsdom does not evaluate CSS variables, so we verify the CSS variable reference is present
          expect(maxWidth).toContain('var(--modal-max-width-popup, min(560px, calc(100vw - 32px)))');
        }
      ),
      { numRuns: 25 }
    );
  });
});

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

// ---------------------------------------------------------------------------
// Property 6: QuickSearchPopup results list height constraint
// Feature: responsive-modal-system, Property 6: QuickSearchPopup results list height constraint
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 6: QuickSearchPopup results list height constraint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('results container maxHeight style uses min(512px, calc(100vh - 200px)) for any viewport height', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 1440 }),
        (vh) => {
          vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(vh);

          const { unmount } = render(
            createElement(QuickSearchPopup, {
              isOpen: true,
              onClose: () => {},
              onSelect: () => {},
            })
          );

          // Find the results container div (the div wrapping the results list with maxHeight style)
          const dialog = screen.getByRole('dialog');
          const resultsContainer = dialog.querySelector<HTMLElement>('[style*="maxHeight"], [style*="max-height"]');

          const maxHeight = resultsContainer?.style.maxHeight ?? '';

          unmount();

          // jsdom does not evaluate CSS, so verify the exact style string
          expect(maxHeight).toBe('min(512px, calc(100vh - 200px))');
        }
      ),
      { numRuns: 25 }
    );
  });
});
