/**
 * Property 9: AuraSphere Partial Failure Resilience
 *
 * Chỉ variant parse thành công được thêm, variant lỗi bị bỏ qua.
 * Khi AuraSphere trả về suggestion với mix valid/invalid variants,
 * operation không fail entirely — valid variants vẫn được đặt vào slots.
 *
 * Invalid variants:
 * - Empty label (label rỗng hoặc chỉ whitespace)
 * - Empty markdown (markdown rỗng hoặc chỉ whitespace)
 *
 * **Validates: Requirements 10.8**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePrismState } from '../usePrismState';
import { auraBundleService, setIO } from '../../../services/auraBundleService';
import type { AuraSphereSuggestion } from '../types';

// --- Mock I/O to avoid Tauri dependency ---

const fileStore = new Map<string, string>();

const mockIO = {
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

// --- Arbitraries ---

/** Generate a valid non-empty label */
const validLabelArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => s.trim().length > 0
);

/** Generate a valid non-empty markdown string */
const validMarkdownArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
  validLabelArb.map((text) => `# ${text}`),
  validLabelArb.map((text) => `- ${text}`)
);

/** Generate a valid promptRef */
const promptRefArb = fc.uuid();

/** Generate an invalid label (empty or whitespace-only) */
const invalidLabelArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant(' \t '),
  fc.constant('\n')
);

/** Generate an invalid markdown (empty or whitespace-only) */
const invalidMarkdownArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant(' \t '),
  fc.constant('\n')
);

/** A valid variant entry in AuraSphereSuggestion */
const validSuggestionVariantArb = fc.tuple(validLabelArb, validMarkdownArb, promptRefArb).map(
  ([label, markdown, promptRef]) => ({ label, markdown, promptRef, isValid: true as const })
);

/** An invalid variant entry — either empty label or empty markdown */
const invalidSuggestionVariantArb = fc.oneof(
  // Invalid label, valid markdown
  fc.tuple(invalidLabelArb, validMarkdownArb, promptRefArb).map(
    ([label, markdown, promptRef]) => ({ label, markdown, promptRef, isValid: false as const })
  ),
  // Valid label, invalid markdown
  fc.tuple(validLabelArb, invalidMarkdownArb, promptRefArb).map(
    ([label, markdown, promptRef]) => ({ label, markdown, promptRef, isValid: false as const })
  ),
  // Both invalid
  fc.tuple(invalidLabelArb, invalidMarkdownArb, promptRefArb).map(
    ([label, markdown, promptRef]) => ({ label, markdown, promptRef, isValid: false as const })
  )
);

/** Tagged variant for tracking validity */
type TaggedVariant = {
  label: string;
  markdown: string;
  promptRef: string;
  isValid: boolean;
};

/**
 * Generate a mixed suggestion with at least 1 valid and at least 1 invalid variant.
 * Total variants between 2 and 3.
 */
const mixedSuggestionArb = fc.tuple(
  fc.array(validSuggestionVariantArb, { minLength: 1, maxLength: 2 }),
  fc.array(invalidSuggestionVariantArb, { minLength: 1, maxLength: 2 })
).filter(([valid, invalid]) => valid.length + invalid.length >= 2 && valid.length + invalid.length <= 3)
  .chain(([valid, invalid]) => {
    const all = [...valid, ...invalid];
    // Shuffle the array to randomize order
    return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
  });

/**
 * Generate a suggestion where ALL variants are invalid.
 */
const allInvalidSuggestionArb = fc.array(invalidSuggestionVariantArb, {
  minLength: 1,
  maxLength: 3,
});

// --- Test ---

describe('Property 9: AuraSphere Partial Failure Resilience', () => {
  beforeEach(() => {
    fileStore.clear();
    auraBundleService.clearCache();
    setIO(mockIO);
  });

  it('only valid variants are placed in slots, invalid ones are skipped', () => {
    fc.assert(
      fc.property(mixedSuggestionArb, (taggedVariants: TaggedVariant[]) => {
        // Clear state for each run
        fileStore.clear();
        auraBundleService.clearCache();

        const { result } = renderHook(() =>
          usePrismState('test-intent', '[]')
        );

        // Build the AuraSphereSuggestion (strip isValid tag)
        const suggestion: AuraSphereSuggestion = {
          variants: taggedVariants.map(({ label, markdown, promptRef }) => ({
            label,
            markdown,
            promptRef,
          })),
        };

        // Count expected valid variants
        const expectedValidCount = taggedVariants.filter((v) => v.isValid).length;

        // Record state before
        const slotsBefore = result.current.state.slots.map((s) =>
          s !== null ? s.id : null
        );

        // Apply the suggestion
        act(() => {
          result.current.addAuraSphereVariants(suggestion);
        });

        const slotsAfter = result.current.state.slots;

        // Count how many new variants were added (slots that were null before and are now filled)
        let addedCount = 0;
        for (let i = 0; i < 3; i++) {
          if (slotsBefore[i] === null && slotsAfter[i] !== null) {
            addedCount++;
          }
        }

        // The number of added variants should equal the number of valid variants
        // (limited by available slots — slot 0 is occupied, so max 2 can be added)
        const availableSlots = slotsBefore.filter((s, i) => i > 0 && s === null).length;
        const expectedAdded = Math.min(expectedValidCount, availableSlots);
        expect(addedCount).toBe(expectedAdded);

        // Slot 0 should remain unchanged (not overwritten by AuraSphere)
        expect(slotsAfter[0]).not.toBeNull();
        expect(slotsAfter[0]!.id).toBe(slotsBefore[0]);

        // Structural invariant still holds
        expect(slotsAfter).toHaveLength(3);
      }),
      { numRuns: 200 }
    );
  });

  it('operation does not fail entirely when all variants are invalid', () => {
    fc.assert(
      fc.property(allInvalidSuggestionArb, (taggedVariants: TaggedVariant[]) => {
        // Clear state for each run
        fileStore.clear();
        auraBundleService.clearCache();

        const { result } = renderHook(() =>
          usePrismState('test-intent', '[]')
        );

        const suggestion: AuraSphereSuggestion = {
          variants: taggedVariants.map(({ label, markdown, promptRef }) => ({
            label,
            markdown,
            promptRef,
          })),
        };

        // Record state before
        const slotsBefore = result.current.state.slots.map((s) =>
          s !== null ? s.id : null
        );

        // Should not throw — operation completes gracefully
        act(() => {
          result.current.addAuraSphereVariants(suggestion);
        });

        const slotsAfter = result.current.state.slots;

        // No new variants should be added
        for (let i = 1; i < 3; i++) {
          if (slotsBefore[i] === null) {
            expect(slotsAfter[i]).toBeNull();
          }
        }

        // Slot 0 remains unchanged
        expect(slotsAfter[0]).not.toBeNull();
        expect(slotsAfter[0]!.id).toBe(slotsBefore[0]);

        // Structural invariant still holds
        expect(slotsAfter).toHaveLength(3);
      }),
      { numRuns: 100 }
    );
  });

  it('valid variants in a mixed suggestion have correct labels from the suggestion', () => {
    fc.assert(
      fc.property(mixedSuggestionArb, (taggedVariants: TaggedVariant[]) => {
        // Clear state for each run
        fileStore.clear();
        auraBundleService.clearCache();

        const { result } = renderHook(() =>
          usePrismState('test-intent', '[]')
        );

        const suggestion: AuraSphereSuggestion = {
          variants: taggedVariants.map(({ label, markdown, promptRef }) => ({
            label,
            markdown,
            promptRef,
          })),
        };

        // Get the valid variant labels in order
        const validLabels = taggedVariants
          .filter((v) => v.isValid)
          .map((v) => v.label);

        act(() => {
          result.current.addAuraSphereVariants(suggestion);
        });

        const slotsAfter = result.current.state.slots;

        // Collect labels of newly added variants (slots 1 and 2)
        const addedLabels: string[] = [];
        for (let i = 1; i < 3; i++) {
          if (slotsAfter[i] !== null) {
            addedLabels.push(slotsAfter[i]!.label);
          }
        }

        // Each added label should come from the valid variants (in order)
        for (let i = 0; i < addedLabels.length; i++) {
          expect(addedLabels[i]).toBe(validLabels[i]);
        }
      }),
      { numRuns: 200 }
    );
  });
});
