/**
 * Property-based test for addVariant lowest-index placement
 *
 * Property 10: Add Variant Lowest-Index Placement
 * addVariant đặt variant vào slot trống có index thấp nhất
 *
 * Validates: Requirements 1.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { usePrismState } from '../usePrismState';

const INITIAL_CONTENT = '[]';

/**
 * Arbitrary that generates a sequence of add/discard operations to produce
 * various slot configurations before testing addVariant placement.
 *
 * Operations:
 * - 'add': call addVariant()
 * - 'discard1': call discardVariant(1)
 * - 'discard2': call discardVariant(2)
 */
const operationArb = fc.array(
  fc.oneof(
    fc.constant('add' as const),
    fc.constant('discard1' as const),
    fc.constant('discard2' as const)
  ),
  { minLength: 0, maxLength: 6 }
);

describe('Property 10: Add Variant Lowest-Index Placement', () => {
  it('addVariant always places the new variant in the empty slot with the lowest index', () => {
    fc.assert(
      fc.property(operationArb, (operations) => {
        const { result } = renderHook(() =>
          usePrismState('test-intent', INITIAL_CONTENT)
        );

        // Apply operations to reach a varied state
        for (const op of operations) {
          act(() => {
            switch (op) {
              case 'add':
                result.current.addVariant();
                break;
              case 'discard1':
                result.current.discardVariant(1);
                break;
              case 'discard2':
                result.current.discardVariant(2);
                break;
            }
          });
        }

        // Capture state before addVariant
        const slotsBefore = result.current.state.slots.map((s) =>
          s !== null ? s.id : null
        );

        // Find the expected lowest-index empty slot (only slots 1 and 2 are candidates)
        const expectedIndex = slotsBefore.findIndex(
          (s, i) => i > 0 && s === null
        );

        // Call addVariant
        act(() => {
          result.current.addVariant();
        });

        const slotsAfter = result.current.state.slots;

        if (expectedIndex === -1) {
          // No empty slot available — state should not change
          const slotsAfterIds = slotsAfter.map((s) =>
            s !== null ? s.id : null
          );
          expect(slotsAfterIds).toEqual(slotsBefore);
        } else {
          // The new variant should be placed at expectedIndex
          expect(slotsAfter[expectedIndex]).not.toBeNull();

          // The new variant should not have existed before
          expect(slotsBefore[expectedIndex]).toBeNull();

          // All other slots should remain unchanged
          for (let i = 0; i < 3; i++) {
            if (i !== expectedIndex) {
              const beforeId = slotsBefore[i];
              const afterId =
                slotsAfter[i] !== null ? slotsAfter[i]!.id : null;
              expect(afterId).toBe(beforeId);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('addVariant fills slot 1 before slot 2 when both are empty', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { result } = renderHook(() =>
          usePrismState('test-intent', INITIAL_CONTENT)
        );

        // Initial state: slot 0 occupied, slots 1 and 2 empty
        expect(result.current.state.slots[1]).toBeNull();
        expect(result.current.state.slots[2]).toBeNull();

        act(() => {
          result.current.addVariant();
        });

        // Should fill slot 1 (lowest index)
        expect(result.current.state.slots[1]).not.toBeNull();
        expect(result.current.state.slots[2]).toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  it('addVariant fills slot 1 when slot 2 is occupied and slot 1 is empty', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { result } = renderHook(() =>
          usePrismState('test-intent', INITIAL_CONTENT)
        );

        // Fill slot 1, then slot 2, then discard slot 1
        act(() => {
          result.current.addVariant(); // fills slot 1
        });
        act(() => {
          result.current.addVariant(); // fills slot 2
        });
        act(() => {
          result.current.discardVariant(1); // slot 1 becomes null
        });

        // State: slot 0 occupied, slot 1 null, slot 2 occupied
        expect(result.current.state.slots[0]).not.toBeNull();
        expect(result.current.state.slots[1]).toBeNull();
        expect(result.current.state.slots[2]).not.toBeNull();

        const slot2IdBefore = result.current.state.slots[2]!.id;

        act(() => {
          result.current.addVariant();
        });

        // Should fill slot 1 (lowest empty index), not replace slot 2
        expect(result.current.state.slots[1]).not.toBeNull();
        expect(result.current.state.slots[2]!.id).toBe(slot2IdBefore);
      }),
      { numRuns: 10 }
    );
  });
});
