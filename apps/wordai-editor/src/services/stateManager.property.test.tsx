/**
 * Property-based test for stateManager
 *
 * Property 1: Document state preservation across tab switches
 * Validates: Requirements 1.6
 *
 * For any document with any content and any unsaved-changes state, switching
 * the active tab from 'editor' to 'archive' and back to 'editor' SHALL produce
 * a document state identical to the original (same id, title, content, version,
 * and metadata).
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { AppStateProvider, useAppState } from './stateManager';
import type { Document, DocumentMetadata } from '../types/document';
import type { ReactNode } from 'react';

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

// ─── Generators ───────────────────────────────────────────────────────────────

const documentStatusArb = fc.constantFrom('draft', 'archived', 'published') as fc.Arbitrary<
  DocumentMetadata['status']
>;

const documentMetadataArb: fc.Arbitrary<DocumentMetadata> = fc.record({
  wordCount: fc.nat({ max: 100_000 }),
  readingTime: fc.nat({ max: 1000 }),
  status: documentStatusArb,
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
});

const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 0, maxLength: 200 }),
  content: fc.string({ minLength: 0, maxLength: 5000 }),
  metadata: documentMetadataArb,
  version: fc.integer({ min: 1, max: 1000 }),
  lastModified: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
});

const filePathArb = fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/path/to/${s}`);

// ─── Property 1: Document state preservation across tab switches ──────────────
// **Validates: Requirements 1.6**

describe('Property 1: Document state preservation across tab switches', () => {
  it('switching from editor to archive and back preserves document state identically', () => {
    fc.assert(
      fc.property(
        documentArb,
        filePathArb,
        fc.boolean(), // hasUnsavedChanges
        (doc, filePath, hasUnsavedChanges) => {
          const { result } = renderHook(() => useAppState(), { wrapper });

          // Step 1: Set a document with arbitrary content
          act(() => {
            result.current.setDocument(doc, filePath);
          });

          // Optionally mark as having unsaved changes
          if (hasUnsavedChanges) {
            act(() => {
              result.current.updateDocument(doc);
            });
          }

          // Capture the document state before tab switch
          const stateBefore = result.current.state;
          const docBefore = stateBefore.document;
          const hasUnsavedBefore = stateBefore.hasUnsavedChanges;

          // Step 2: Switch tab to 'archive'
          act(() => {
            result.current.setActiveTab('archive');
          });

          expect(result.current.state.activeTab).toBe('archive');

          // Step 3: Switch tab back to 'editor'
          act(() => {
            result.current.setActiveTab('editor');
          });

          expect(result.current.state.activeTab).toBe('editor');

          // Step 4: Verify the document state is identical
          const stateAfter = result.current.state;
          const docAfter = stateAfter.document;

          // Document must not be null
          expect(docAfter).not.toBeNull();

          // All document fields must be preserved
          expect(docAfter!.id).toBe(docBefore!.id);
          expect(docAfter!.title).toBe(docBefore!.title);
          expect(docAfter!.content).toBe(docBefore!.content);
          expect(docAfter!.version).toBe(docBefore!.version);
          expect(docAfter!.metadata).toEqual(docBefore!.metadata);
          expect(docAfter!.lastModified).toEqual(docBefore!.lastModified);

          // Unsaved changes flag must be preserved
          expect(stateAfter.hasUnsavedChanges).toBe(hasUnsavedBefore);

          // File path must be preserved
          expect(stateAfter.filePath).toBe(filePath);
        },
      ),
      { numRuns: 100 },
    );
  });
});
