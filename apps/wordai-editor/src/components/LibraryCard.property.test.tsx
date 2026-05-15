/**
 * Property-based tests for LibraryCard component
 * Feature: library-tab, Property 8: Library_Card always renders all required metadata fields
 * Validates: Requirements 2.6
 */

import { describe, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { LibraryCard } from './LibraryCard';
import type { AuraIntentSummary } from '../types/auraDocument';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? JSON.stringify(opts) : key,
  }),
}));

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
// Property 8: Library_Card always renders all required metadata fields
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('Property 8: Library_Card always renders all required metadata fields', () => {
  it('for any valid AuraIntentSummary, the card renders intent_name, a non-empty timestamp, and a version badge', () => {
    // Feature: library-tab, Property 8: Library_Card always renders all required metadata fields
    // Validates: Requirements 2.6
    fc.assert(
      fc.property(arbitraryAuraIntentSummary(), (summary) => {
        const { unmount } = render(
          <LibraryCard
            summary={summary}
            isLoading={false}
            hasError={false}
            onOpen={vi.fn()}
            onDelete={vi.fn()}
          />
        );

        // Assert intent_name is present in the document
        const card = screen.getByTestId('library-card');
        const titleEl = card.querySelector('p');
        if (titleEl) {
          // The title element should contain the intent_name text
          const titleText = titleEl.textContent ?? '';
          if (titleText !== summary.intent_name) {
            unmount();
            return false;
          }
        }

        // Assert a non-empty timestamp string is present
        const timestampEl = screen.getByTestId('library-card-timestamp');
        const timestampText = timestampEl.textContent ?? '';
        if (timestampText.trim().length === 0) {
          unmount();
          return false;
        }

        // Assert version is present
        const versionEl = screen.getByTestId('library-card-version');
        const versionText = versionEl.textContent ?? '';
        if (versionText.trim().length === 0) {
          unmount();
          return false;
        }

        unmount();
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
