/**
 * Property-based tests for LibraryView component
 * Feature: library-tab
 */

import { describe, it, vi, beforeEach, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryView } from './LibraryView';
import type { AuraIntentDocument, AuraIntentSummary } from '../types/auraDocument';
import type { ImportOptions, ImportFlowResult } from '../services/exportService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));

const mockImportFile = vi.fn<(options?: ImportOptions) => Promise<ImportFlowResult>>();
vi.mock('../services/exportService', () => ({
  importFile: (options?: ImportOptions) => mockImportFile(options),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('./ReplaceConfirmationDialog', () => ({
  ReplaceConfirmationDialog: () => null,
}));

// ─── Arbitraries ──────────────────────────────────────────────────────────────

function arbitraryAuraIntentSummary(): fc.Arbitrary<AuraIntentSummary> {
  return fc.record({
    id: fc.uuid(),
    intent_name: fc.string({ minLength: 1, maxLength: 100 }),
    created_at: fc.integer({ min: 0, max: Date.now() }),
    updated_at: fc.integer({ min: 0, max: Date.now() }),
    version: fc.integer({ min: 1, max: 100 }),
  });
}

function arbitraryAuraIntentDocument(): fc.Arbitrary<AuraIntentDocument> {
  return fc.record({
    id: fc.uuid(),
    intent_name: fc.string({ minLength: 1, maxLength: 100 }),
    content: fc.array(
      fc.record({
        type: fc.constant('paragraph' as const),
        text: fc.string(),
        inline: fc.constant([]),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    version: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
    created_at: fc.option(fc.integer({ min: 0, max: Date.now() }), { nil: undefined }),
    updated_at: fc.option(fc.integer({ min: 0, max: Date.now() }), { nil: undefined }),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderLibraryView(props: {
  onOpenDocument?: ReturnType<typeof vi.fn>;
  onTabChange?: ReturnType<typeof vi.fn>;
  currentDocumentId?: string | null;
}) {
  const onOpenDocument = props.onOpenDocument ?? vi.fn();
  const onTabChange = props.onTabChange ?? vi.fn();
  const currentDocumentId = props.currentDocumentId ?? null;

  return render(
    <LibraryView
      onOpenDocument={onOpenDocument}
      onTabChange={onTabChange}
      currentDocumentId={currentDocumentId}
    />
  );
}

// ─── Property 1: Document list renders cards sorted by recency ────────────────
// Validates: Requirements 2.2

describe('Property 1: Document list renders cards sorted by recency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('for any non-empty array of AuraIntentSummary records, card count equals array length and cards appear in descending updated_at order', async () => {
    // Feature: library-tab, Property 1: Document list renders cards sorted by recency
    // **Validates: Requirements 2.2**
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryAuraIntentSummary(), { minLength: 1, maxLength: 20 }),
        async (summaries) => {
          vi.clearAllMocks();

          // Mock list_intents to return the generated summaries
          mockInvoke.mockResolvedValue(summaries);

          const { unmount } = renderLibraryView({});

          // Wait for loading to finish and the grid to appear
          await waitFor(() => {
            expect(screen.getByTestId('library-grid')).toBeInTheDocument();
          });

          // Get all rendered cards
          const cards = screen.getAllByTestId('library-card');

          // Assert card count equals array length
          if (cards.length !== summaries.length) {
            unmount();
            return false;
          }

          // The expected order is descending by updated_at
          const sortedSummaries = [...summaries].sort(
            (a, b) => b.updated_at - a.updated_at
          );

          // Assert cards appear in descending updated_at order by checking
          // that each card's title matches the expected sorted order
          for (let i = 0; i < sortedSummaries.length; i++) {
            const cardTitle = cards[i].querySelector('p')?.textContent ?? '';
            if (cardTitle !== sortedSummaries[i].intent_name) {
              unmount();
              return false;
            }
          }

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Opening a document from the library always switches to the editor tab ───
// Validates: Requirements 4.2, 4.3, 4.4

describe('Property 2: Opening a document from the library always switches to the editor tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('for any valid AuraIntentDocument, clicking its card calls onTabChange("editor") and stores id in localStorage', async () => {
    // Feature: library-tab, Property 2: Opening a document always switches to editor tab
    // **Validates: Requirements 4.2, 4.3, 4.4**
    await fc.assert(
      fc.asyncProperty(arbitraryAuraIntentDocument(), async (doc) => {
        vi.clearAllMocks();
        localStorage.clear();

        // Create a summary that corresponds to this document so it appears in the grid
        const summary: AuraIntentSummary = {
          id: doc.id,
          intent_name: doc.intent_name,
          created_at: doc.created_at ?? Date.now(),
          updated_at: doc.updated_at ?? Date.now(),
          version: doc.version ?? 1,
        };

        // Mock list_intents to return the summary
        mockInvoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
          if (cmd === 'list_intents') return [summary];
          if (cmd === 'get_intent') {
            expect(args).toBeDefined();
            return doc;
          }
          return null;
        });

        const onTabChange = vi.fn();
        const onOpenDocument = vi.fn();

        const { unmount } = renderLibraryView({ onOpenDocument, onTabChange });

        // Wait for the grid to render with the card
        await waitFor(() => {
          expect(screen.getByTestId('library-grid')).toBeInTheDocument();
        });

        // Click the card to open the document
        const card = screen.getByTestId('library-card');
        await act(async () => {
          await userEvent.click(card);
        });

        // Wait for the async get_intent call to complete
        await waitFor(() => {
          expect(onTabChange).toHaveBeenCalledWith('editor');
        });

        // Assert localStorage contains the document's id
        const storedId = localStorage.getItem('wordai_last_intent_id');

        unmount();

        if (storedId !== doc.id) {
          return false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Successful import always opens the document in the editor ───
// Validates: Requirements 6.2, 6.3, 6.4

describe('Property 5: Successful import always opens the document in the editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('for any AuraIntentDocument returned by a successful import, onTabChange is called with "editor"', async () => {
    // Feature: library-tab, Property 5: Successful import always opens the document in the editor
    // **Validates: Requirements 6.2, 6.3, 6.4**
    await fc.assert(
      fc.asyncProperty(arbitraryAuraIntentDocument(), async (doc) => {
        vi.clearAllMocks();

        // Mock list_intents to return an empty list (so we get past loading state)
        mockInvoke.mockResolvedValue([]);

        // Mock importFile to invoke onOpenIntent with the generated document
        mockImportFile.mockImplementation(async (options?: ImportOptions) => {
          // Simulate the import service calling onOpenIntent with the document
          // after a successful import (this is what exportService does internally)
          const importedDoc = {
            id: doc.id,
            title: doc.intent_name,
            content: '',
            metadata: { wordCount: 0, readingTime: 0, status: 'draft' as const, tags: [] },
            version: doc.version ?? 1,
            lastModified: new Date(),
          };
          options?.onOpenIntent?.(importedDoc);
          return { status: 'opened' as const, document: importedDoc, warnings: [] };
        });

        const onTabChange = vi.fn();
        const onOpenDocument = vi.fn();

        const { unmount } = renderLibraryView({ onOpenDocument, onTabChange });

        // Wait for loading to finish
        await waitFor(() => {
          expect(screen.getByTestId('library-view')).toBeInTheDocument();
        });

        // Click the "Open File" button to trigger import
        const openFileButton = screen.getByTestId('library-open-file-button');
        await act(async () => {
          await userEvent.click(openFileButton);
        });

        // Assert onTabChange was called with 'editor'
        const tabChangeCalled = onTabChange.mock.calls.some(
          (call) => call[0] === 'editor'
        );

        unmount();

        if (!tabChangeCalled) {
          return false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});


// ─── Property 6: Delete confirmation calls delete_intent with the correct id and removes the card ───
// Validates: Requirements 9.3, 9.4

describe('Property 6: Delete confirmation calls delete_intent with the correct id and removes the card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('for any non-empty array of summaries and a target index, confirming delete calls delete_intent with the target id and removes the card', async () => {
    // Feature: library-tab, Property 6: Delete confirmation calls delete_intent with the correct id and removes the card
    // **Validates: Requirements 9.3, 9.4**
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryAuraIntentSummary(), { minLength: 1, maxLength: 10 }),
        fc.nat(),
        async (summaries, indexSeed) => {
          vi.clearAllMocks();

          // Deduplicate summaries by id to avoid rendering issues
          const uniqueSummaries = summaries.filter(
            (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
          );
          if (uniqueSummaries.length === 0) return true;

          const targetIndex = indexSeed % uniqueSummaries.length;
          const target = uniqueSummaries[targetIndex];

          // Mock list_intents to return the summaries
          mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
            if (cmd === 'list_intents') return uniqueSummaries;
            if (cmd === 'delete_intent') return null;
            return null;
          });

          const onOpenDocument = vi.fn();
          const onTabChange = vi.fn();

          const { unmount } = renderLibraryView({ onOpenDocument, onTabChange });

          // Wait for loading to finish and cards to render
          await waitFor(() => {
            expect(screen.getAllByTestId('library-card').length).toBeGreaterThan(0);
          });

          // Find all cards and click delete on the target card
          const cards = screen.getAllByTestId('library-card');

          // Cards are sorted by updated_at descending, so find the target card's position
          const sortedSummaries = [...uniqueSummaries].sort(
            (a, b) => b.updated_at - a.updated_at
          );
          const sortedTargetIndex = sortedSummaries.findIndex(
            (s) => s.id === target.id
          );

          const targetCard = cards[sortedTargetIndex];
          const deleteButton = within(targetCard).getByTestId('library-card-delete');

          // Click the delete button
          await act(async () => {
            await userEvent.click(deleteButton);
          });

          // The ConfirmationDialog should now be visible
          const confirmDialog = screen.getByTestId('confirmation-dialog');
          expect(confirmDialog).toBeInTheDocument();

          // Click the confirm button
          const confirmButton = within(confirmDialog).getByTestId('confirmation-dialog-confirm');
          await act(async () => {
            await userEvent.click(confirmButton);
          });

          // Wait for the delete to complete
          await waitFor(() => {
            // Assert delete_intent was called exactly once with the target id
            const deleteIntentCalls = mockInvoke.mock.calls.filter(
              (call) => call[0] === 'delete_intent'
            );
            expect(deleteIntentCalls).toHaveLength(1);
            expect(deleteIntentCalls[0][1]).toEqual({ id: target.id });
          });

          // Assert the card is no longer in the rendered output
          const remainingCards = screen.queryAllByTestId('library-card');
          const remainingCardCount = uniqueSummaries.length - 1;
          expect(remainingCards).toHaveLength(remainingCardCount);

          unmount();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
