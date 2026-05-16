/**
 * Property 4: Pin/Protected Slot Invariant
 *
 * Slot có pinned=true không bao giờ bị ghi đè bởi addAuraSphereVariants
 * hoặc bị archive bởi promoteVariant. Đồng thời, slot 0 có content không bị
 * ghi đè bởi AuraSphere, và slot dirty không bị ghi đè.
 *
 * **Validates: Requirements 7.3, 7.5, 8.2, 8.3, 8.4**
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePrismState } from '../usePrismState';
import type { PrismSlotIndex, PrismVariant, AuraSphereSuggestion } from '../types';

// Mock auraBundleService to avoid Tauri I/O in tests
vi.mock('../../../services/auraBundleService', () => ({
  auraBundleService: {
    loadBundle: () => null,
    loadBundleAsync: async () => null,
    saveBundle: async () => {},
    clearCache: () => {},
  },
}));

const INITIAL_CONTENT = '[]';

// --- Arbitraries ---

/**
 * Generate a valid markdown string that markdownToBlock can parse.
 * Uses simple paragraphs to avoid parse failures.
 */
const validMarkdownArb = fc
  .array(fc.lorem({ maxCount: 5 }), { minLength: 1, maxLength: 3 })
  .map((lines) => lines.join('\n\n'));

/**
 * Generate an AuraSphereSuggestion with 1-3 valid variants.
 */
const auraSuggestionArb: fc.Arbitrary<AuraSphereSuggestion> = fc
  .array(
    fc.record({
      label: fc.lorem({ maxCount: 3 }).filter((s) => s.trim().length > 0),
      markdown: validMarkdownArb,
      promptRef: fc.uuid(),
    }),
    { minLength: 1, maxLength: 3 }
  )
  .map((variants) => ({ variants }));

/**
 * Generate a slot index for pinning (0, 1, or 2).
 */
const slotIndexArb = fc.constantFrom<PrismSlotIndex>(0, 1, 2);

/**
 * Generate which slots to pin (subset of occupied slots).
 */
const pinConfigArb = fc.subarray([0, 1, 2] as PrismSlotIndex[], {
  minLength: 1,
  maxLength: 3,
});

describe('Property 4: Pin/Protected Slot Invariant', () => {
  it('pinned slots are never overwritten by addAuraSphereVariants', () => {
    fc.assert(
      fc.property(
        pinConfigArb,
        auraSuggestionArb,
        (slotsToPinIndices, suggestion) => {
          const { result } = renderHook(() =>
            usePrismState('test-intent-pin', INITIAL_CONTENT)
          );

          // Fill all slots first
          act(() => {
            result.current.addVariant();
          });
          act(() => {
            result.current.addVariant();
          });

          // Pin the specified slots
          for (const idx of slotsToPinIndices) {
            if (result.current.state.slots[idx] !== null) {
              act(() => {
                result.current.pinVariant(idx);
              });
            }
          }

          // Capture pinned variant IDs and content before AuraSphere push
          const pinnedBefore = result.current.state.slots
            .map((slot, i) => ({ slot, index: i }))
            .filter(({ slot }) => slot !== null && slot.pinned)
            .map(({ slot, index }) => ({
              id: slot!.id,
              index,
              blockContent: slot!.blockContent,
            }));

          // Apply AuraSphere suggestion
          act(() => {
            result.current.addAuraSphereVariants(suggestion);
          });

          // Verify pinned variants are preserved
          const pinnedAfter = result.current.state.slots
            .map((slot, i) => ({ slot, index: i }))
            .filter(({ slot }) => slot !== null && slot.pinned)
            .map(({ slot, index }) => ({
              id: slot!.id,
              index,
              blockContent: slot!.blockContent,
            }));

          // All pinned variants from before must still exist with same ID and content
          for (const before of pinnedBefore) {
            const after = pinnedAfter.find((a) => a.id === before.id);
            expect(after).toBeDefined();
            expect(after!.blockContent).toBe(before.blockContent);
            expect(after!.index).toBe(before.index);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('slot 0 with content is never overwritten by addAuraSphereVariants', () => {
    fc.assert(
      fc.property(auraSuggestionArb, (suggestion) => {
        const { result } = renderHook(() =>
          usePrismState('test-intent-slot0', INITIAL_CONTENT)
        );

        // Slot 0 always has content (initial variant)
        const slot0Before = result.current.state.slots[0]!;
        const idBefore = slot0Before.id;
        const contentBefore = slot0Before.blockContent;

        // Apply AuraSphere suggestion
        act(() => {
          result.current.addAuraSphereVariants(suggestion);
        });

        // Slot 0 must remain unchanged
        const slot0After = result.current.state.slots[0]!;
        expect(slot0After.id).toBe(idBefore);
        expect(slot0After.blockContent).toBe(contentBefore);
      }),
      { numRuns: 100 }
    );
  });

  it('dirty slots are never overwritten by addAuraSphereVariants', () => {
    fc.assert(
      fc.property(auraSuggestionArb, (suggestion) => {
        const { result } = renderHook(() =>
          usePrismState('test-intent-dirty', INITIAL_CONTENT)
        );

        // Add variant to slot 1 and make it dirty
        act(() => {
          result.current.addVariant();
        });
        act(() => {
          result.current.updateVariantContent(1, '["dirty content"]');
        });

        const slot1Before = result.current.state.slots[1]!;
        expect(slot1Before.dirty).toBe(true);
        const idBefore = slot1Before.id;

        // Apply AuraSphere suggestion
        act(() => {
          result.current.addAuraSphereVariants(suggestion);
        });

        // Dirty slot 1 must remain unchanged
        const slot1After = result.current.state.slots[1]!;
        expect(slot1After.id).toBe(idBefore);
        expect(slot1After.dirty).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it('pinned variants are never archived by promoteVariant', () => {
    fc.assert(
      fc.property(
        slotIndexArb.filter((idx) => idx !== 0),
        (promoteSlot) => {
          const { result } = renderHook(() =>
            usePrismState('test-intent-promote', INITIAL_CONTENT)
          );

          // Fill all slots
          act(() => {
            result.current.addVariant();
          });
          act(() => {
            result.current.addVariant();
          });

          // Pin a slot that is NOT the one being promoted
          const pinSlot: PrismSlotIndex = promoteSlot === 1 ? 2 : 1;
          act(() => {
            result.current.pinVariant(pinSlot);
          });

          const pinnedVariantId = result.current.state.slots[pinSlot]!.id;
          const pinnedVariantContent =
            result.current.state.slots[pinSlot]!.blockContent;

          // Promote a different slot
          act(() => {
            result.current.promoteVariant(promoteSlot);
          });

          // The pinned variant must still be present in slots (not archived/removed)
          const slotsAfter = result.current.state.slots;
          const pinnedStillPresent = slotsAfter.some(
            (slot) =>
              slot !== null &&
              slot.id === pinnedVariantId &&
              slot.blockContent === pinnedVariantContent
          );
          expect(pinnedStillPresent).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('number of pinned slots never decreases after addAuraSphereVariants', () => {
    fc.assert(
      fc.property(
        pinConfigArb,
        auraSuggestionArb,
        (slotsToPinIndices, suggestion) => {
          const { result } = renderHook(() =>
            usePrismState('test-intent-count', INITIAL_CONTENT)
          );

          // Fill all slots
          act(() => {
            result.current.addVariant();
          });
          act(() => {
            result.current.addVariant();
          });

          // Pin specified slots
          for (const idx of slotsToPinIndices) {
            if (result.current.state.slots[idx] !== null) {
              act(() => {
                result.current.pinVariant(idx);
              });
            }
          }

          const pinnedCountBefore = result.current.state.slots.filter(
            (s) => s !== null && s.pinned
          ).length;

          // Apply AuraSphere suggestion
          act(() => {
            result.current.addAuraSphereVariants(suggestion);
          });

          const pinnedCountAfter = result.current.state.slots.filter(
            (s) => s !== null && s.pinned
          ).length;

          // Pinned count must not decrease
          expect(pinnedCountAfter).toBeGreaterThanOrEqual(pinnedCountBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
