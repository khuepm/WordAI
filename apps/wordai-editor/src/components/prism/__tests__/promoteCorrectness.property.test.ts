/**
 * Property 3: Promote Correctness
 *
 * Sau promote: promotedVariantId đúng, markdown đúng, state về 1 slot active
 * (trừ khi có slot pinned — slot pinned được giữ nguyên).
 *
 * **Validates: Requirements 7.1, 7.2, 7.4**
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePrismState } from '../usePrismState';
import type { PrismSlotIndex } from '../types';
import { blockToMarkdown } from '../../../utils/blockToMarkdown';

// Mock auraBundleService to avoid Tauri I/O and capture saved bundles
vi.mock('../../../services/auraBundleService', () => ({
  auraBundleService: {
    loadBundle: vi.fn(() => null),
    loadBundleAsync: vi.fn(async () => null),
    preloadBundle: vi.fn(async () => {}),
    saveBundle: vi.fn(async () => {}),
    clearCache: vi.fn(),
  },
}));

// --- Generators ---

/**
 * Generate a valid block content JSON string with random paragraphs.
 * Produces 1-3 paragraph blocks with random text.
 */
const blockContentArb = fc
  .array(
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    { minLength: 1, maxLength: 3 }
  )
  .map((texts) =>
    JSON.stringify(
      texts.map((text, i) => ({
        id: `block-${i}`,
        type: 'paragraph',
        text,
      }))
    )
  );

/**
 * Generate a slot configuration: 1-3 variants with random content.
 * Returns an array of operations to set up the state, plus the slotIndex to promote.
 */
interface SlotSetup {
  /** Content for slot 0 (always present) */
  slot0Content: string;
  /** Whether to add variant at slot 1 */
  addSlot1: boolean;
  /** Content for slot 1 (if added) */
  slot1Content: string;
  /** Whether to add variant at slot 2 */
  addSlot2: boolean;
  /** Content for slot 2 (if added) */
  slot2Content: string;
  /** Which non-null slot to promote (0, 1, or 2) */
  promoteSlotIndex: number;
}

const slotSetupArb: fc.Arbitrary<SlotSetup> = fc.record({
  slot0Content: blockContentArb,
  addSlot1: fc.boolean(),
  slot1Content: blockContentArb,
  addSlot2: fc.boolean(),
  slot2Content: blockContentArb,
  promoteSlotIndex: fc.nat({ max: 2 }),
});

// --- Property test ---

describe('Property 3: Promote Correctness', () => {
  it('after promote: promotedVariantId is correct, markdown is correct, state has correct active count', () => {
    fc.assert(
      fc.property(slotSetupArb, (setup) => {
        const { result } = renderHook(() =>
          usePrismState('test-intent', setup.slot0Content)
        );

        // Set up slots: add variants to slot 1 and/or slot 2
        if (setup.addSlot1) {
          act(() => {
            result.current.addVariant();
          });
          // Update slot 1 content
          act(() => {
            result.current.updateVariantContent(1 as PrismSlotIndex, setup.slot1Content);
          });
        }

        if (setup.addSlot2 && setup.addSlot1) {
          // Can only add slot 2 if slot 1 exists (lowest-index placement)
          act(() => {
            result.current.addVariant();
          });
          // Update slot 2 content
          act(() => {
            result.current.updateVariantContent(2 as PrismSlotIndex, setup.slot2Content);
          });
        }

        // Determine which slots are active
        const activeSlotIndices: number[] = [];
        for (let i = 0; i < 3; i++) {
          if (result.current.state.slots[i] !== null) {
            activeSlotIndices.push(i);
          }
        }

        // Pick a valid non-null slot to promote
        const promoteIdx = activeSlotIndices[setup.promoteSlotIndex % activeSlotIndices.length];
        const slotToPromote = result.current.state.slots[promoteIdx]!;
        const expectedId = slotToPromote.id;
        const expectedMarkdown = blockToMarkdown(slotToPromote.blockContent);

        // Perform promote
        act(() => {
          result.current.promoteVariant(promoteIdx as PrismSlotIndex);
        });

        const stateAfter = result.current.state;

        // Verify: slot 0 contains the promoted variant
        expect(stateAfter.slots[0]).not.toBeNull();
        expect(stateAfter.slots[0]!.id).toBe(expectedId);

        // Verify: blockToMarkdown of promoted slot matches expected markdown
        const actualMarkdown = blockToMarkdown(stateAfter.slots[0]!.blockContent);
        expect(actualMarkdown).toBe(expectedMarkdown);

        // Verify: non-pinned slots (other than slot 0) are cleared
        // Since no slots are pinned in this test, slots 1 and 2 should be null
        for (let i = 1; i < 3; i++) {
          const slot = stateAfter.slots[i];
          if (slot !== null) {
            // Only pinned slots should remain
            expect(slot.pinned).toBe(true);
          }
        }

        // Verify: state has correct active count (1 slot active when no pinned)
        const activeCount = stateAfter.slots.filter((s) => s !== null).length;
        expect(activeCount).toBe(1);

        // Verify: structural invariant still holds
        expect(stateAfter.slots).toHaveLength(3);
        expect(stateAfter.slots[0]).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('after promote with pinned slots: pinned slots are preserved, state has correct active count', () => {
    fc.assert(
      fc.property(
        fc.record({
          slot0Content: blockContentArb,
          slot1Content: blockContentArb,
          slot2Content: blockContentArb,
          pinSlot1: fc.boolean(),
          pinSlot2: fc.boolean(),
          // Promote slot 1 or 2 (not 0, to test non-trivial promote)
          promoteSlot: fc.constantFrom(1 as PrismSlotIndex, 2 as PrismSlotIndex),
        }),
        (setup) => {
          const { result } = renderHook(() =>
            usePrismState('test-intent', setup.slot0Content)
          );

          // Add slot 1
          act(() => {
            result.current.addVariant();
          });
          act(() => {
            result.current.updateVariantContent(1 as PrismSlotIndex, setup.slot1Content);
          });

          // Add slot 2
          act(() => {
            result.current.addVariant();
          });
          act(() => {
            result.current.updateVariantContent(2 as PrismSlotIndex, setup.slot2Content);
          });

          // Pin slots as configured
          if (setup.pinSlot1) {
            act(() => {
              result.current.pinVariant(1 as PrismSlotIndex);
            });
          }
          if (setup.pinSlot2) {
            act(() => {
              result.current.pinVariant(2 as PrismSlotIndex);
            });
          }

          // Capture state before promote
          const slotToPromote = result.current.state.slots[setup.promoteSlot]!;
          const expectedId = slotToPromote.id;
          const expectedMarkdown = blockToMarkdown(slotToPromote.blockContent);

          // Count pinned slots that are NOT the promoted slot
          const pinnedOtherCount = result.current.state.slots.filter(
            (s, i) => s !== null && s.pinned && s.id !== expectedId && i !== setup.promoteSlot
          ).length;

          // Perform promote
          act(() => {
            result.current.promoteVariant(setup.promoteSlot);
          });

          const stateAfter = result.current.state;

          // Verify: slot 0 contains promoted variant
          expect(stateAfter.slots[0]).not.toBeNull();
          expect(stateAfter.slots[0]!.id).toBe(expectedId);

          // Verify: markdown is correct
          const actualMarkdown = blockToMarkdown(stateAfter.slots[0]!.blockContent);
          expect(actualMarkdown).toBe(expectedMarkdown);

          // Verify: pinned slots (other than promoted) are preserved
          const activeCount = stateAfter.slots.filter((s) => s !== null).length;
          // Active count = 1 (promoted) + pinned others
          expect(activeCount).toBe(1 + pinnedOtherCount);

          // Verify: structural invariant
          expect(stateAfter.slots).toHaveLength(3);
          expect(stateAfter.slots[0]).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
