/**
 * Property 5: Archive Idempotency
 *
 * Variant đã archived không bị thay đổi archivedAt khi promote lại.
 * Chỉ variant active không pinned mới bị archive.
 *
 * This tests the bundle-level behavior: when a variant already has archivedAt set,
 * promoting again should NOT change that archivedAt value. We test the promoteVariant
 * algorithm directly via the hook, using a pre-populated bundle cache.
 *
 * **Validates: Requirements 7.3**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePrismState } from '../usePrismState';
import { auraBundleService, setIO, resetIO } from '../../../services/auraBundleService';
import type { AuraBundle, AuraVariantEntry, PrismSlotIndex } from '../types';

// --- Mock I/O to avoid Tauri dependency ---

let fileStore: Map<string, string>;

function createMockIO() {
  return {
    async readFile(path: string): Promise<string> {
      const content = fileStore.get(path);
      if (!content) throw new Error(`File not found: ${path}`);
      return content;
    },
    async writeFile(path: string, content: string): Promise<void> {
      fileStore.set(path, content);
    },
    async exists(path: string): Promise<boolean> {
      return fileStore.has(path);
    },
    async mkdir(_path: string): Promise<void> {
      // no-op
    },
    async getAppDataDir(): Promise<string> {
      return '/mock/appdata';
    },
  };
}

// --- Arbitraries ---

/** Generate a valid ISO 8601 timestamp in the past using integer milliseconds */
const pastISOArb = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2024-01-01T00:00:00Z').getTime(),
}).map((ms) => new Date(ms).toISOString());

/** Generate a valid variant label */
const labelArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/);

/** Generate simple block content (JSON array with paragraph blocks) */
function makeBlockContent(text: string): string {
  return JSON.stringify([{ type: 'paragraph', text }]);
}

/** Generate an archived variant entry (has archivedAt set) */
const archivedVariantEntryArb = fc.tuple(
  fc.uuid(),
  labelArb,
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,15}$/),
  pastISOArb, // createdAt
  pastISOArb  // archivedAt
).map(([id, label, text, createdAt, archivedAt]): AuraVariantEntry => ({
  id,
  label,
  markdown: text,
  createdBy: 'user',
  createdAt,
  archivedAt,
}));

/** Generate an active variant entry (no archivedAt) */
const activeVariantEntryArb = fc.tuple(
  fc.uuid(),
  labelArb,
  fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,15}$/),
  pastISOArb // createdAt
).map(([id, label, text, createdAt]): AuraVariantEntry => ({
  id,
  label,
  markdown: text,
  createdBy: 'user',
  createdAt,
}));

/**
 * Generate a test scenario: a bundle with 1-4 already-archived variants
 * and 2 active variants (so we can promote one and verify the archived ones stay unchanged).
 */
const scenarioArb = fc.tuple(
  fc.array(archivedVariantEntryArb, { minLength: 1, maxLength: 4 }),
  activeVariantEntryArb,
  activeVariantEntryArb
).map(([archivedEntries, active1, active2]) => {
  // Ensure all IDs are unique
  const ids = new Set<string>();
  const uniqueArchived: AuraVariantEntry[] = [];
  for (const v of archivedEntries) {
    if (!ids.has(v.id)) {
      ids.add(v.id);
      uniqueArchived.push(v);
    }
  }

  // Ensure active variants have unique IDs
  let a1 = active1;
  let a2 = active2;
  if (ids.has(a1.id)) {
    a1 = { ...a1, id: crypto.randomUUID() };
  }
  ids.add(a1.id);
  if (ids.has(a2.id)) {
    a2 = { ...a2, id: crypto.randomUUID() };
  }
  ids.add(a2.id);

  return {
    archivedEntries: uniqueArchived,
    activeEntries: [a1, a2] as [AuraVariantEntry, AuraVariantEntry],
  };
});

// --- Test ---

describe('Property 5: Archive Idempotency', () => {
  beforeEach(() => {
    fileStore = new Map();
    auraBundleService.clearCache();
    setIO(createMockIO());
  });

  afterEach(() => {
    resetIO();
  });

  it('already-archived variants preserve their archivedAt timestamp after promote', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ archivedEntries, activeEntries }) => {
        // Reset state for each run
        fileStore.clear();
        auraBundleService.clearCache();

        const intentId = 'test-archive-idempotency';
        const mainContent = makeBlockContent('Main content');

        // Build a bundle with both archived and active variants
        const allVariants: AuraVariantEntry[] = [...activeEntries, ...archivedEntries];

        const bundle: AuraBundle = {
          $schema: 'https://wordai.app/schemas/aura/v1.json',
          version: 1,
          intentId,
          canonical: 'markdown',
          markdown: activeEntries[0].markdown,
          variants: allVariants,
          promotedVariantId: null,
          lastModified: new Date().toISOString(),
        };

        // Store bundle on disk and preload into cache
        const bundlePath = `/mock/appdata/aura/${intentId}.aura.json`;
        fileStore.set(bundlePath, JSON.stringify(bundle));
        await auraBundleService.preloadBundle(intentId);

        // Record the archivedAt values before promote
        const archivedBefore = archivedEntries.map((v) => ({
          id: v.id,
          archivedAt: v.archivedAt,
        }));

        // Render the hook
        const { result, unmount } = renderHook(() =>
          usePrismState(intentId, mainContent)
        );

        // Add a variant to slot 1 with the second active entry's ID
        act(() => {
          result.current.addVariant({
            id: activeEntries[1].id,
            label: activeEntries[1].label,
            blockContent: mainContent,
          });
        });

        // Verify slot 1 exists before promoting
        expect(result.current.state.slots[1]).not.toBeNull();

        // Promote slot 1
        act(() => {
          result.current.promoteVariant(1 as PrismSlotIndex);
        });

        // Wait for async saveBundle to complete
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });

        // Read the saved bundle from the file store
        const savedContent = fileStore.get(bundlePath);
        expect(savedContent).toBeDefined();

        const savedBundle: AuraBundle = JSON.parse(savedContent!);

        // PROPERTY: all previously-archived variants still have the SAME archivedAt
        for (const { id, archivedAt } of archivedBefore) {
          const savedVariant = savedBundle.variants.find((v) => v.id === id);
          // The archived variant should still exist in the bundle
          expect(savedVariant).toBeDefined();
          // Its archivedAt should be unchanged (idempotent)
          expect(savedVariant!.archivedAt).toBe(archivedAt);
        }

        // Cleanup
        unmount();
      }),
      { numRuns: 50 }
    );
  }, 30000); // 30s timeout for property test
});
