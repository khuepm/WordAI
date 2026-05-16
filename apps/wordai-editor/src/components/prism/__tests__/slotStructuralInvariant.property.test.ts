/**
 * Property 2: Slot Structural Invariant
 *
 * Sau mọi operation (addVariant, discardVariant, updateVariantContent,
 * setViewMode, setCodeSubTab, setFocus, toggleSyncScroll), mảng slots
 * luôn có length === 3, slot 0 luôn không null, và số slot active
 * nằm trong khoảng [1, 3].
 *
 * **Validates: Requirements 1.2, 1.3**
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePrismState } from '../usePrismState';
import type { PrismSlotIndex, PrismViewMode, PrismCodeSubTab } from '../types';

// --- Arbitraries for operations ---

const slotIndexArb = fc.constantFrom<PrismSlotIndex>(0, 1, 2);
const viewModeArb = fc.constantFrom<PrismViewMode>('preview', 'code');
const codeSubTabArb = fc.constantFrom<PrismCodeSubTab>('markdown', 'aura', 'ooxml', 'html');
const blockContentArb = fc.string({ minLength: 0, maxLength: 100 });

type PrismOperation =
  | { type: 'addVariant' }
  | { type: 'discardVariant'; slotIndex: PrismSlotIndex }
  | { type: 'updateVariantContent'; slotIndex: PrismSlotIndex; content: string }
  | { type: 'setViewMode'; slotIndex: PrismSlotIndex; mode: PrismViewMode }
  | { type: 'setCodeSubTab'; slotIndex: PrismSlotIndex; tab: PrismCodeSubTab }
  | { type: 'setFocus'; slotIndex: PrismSlotIndex }
  | { type: 'toggleSyncScroll' };

const operationArb: fc.Arbitrary<PrismOperation> = fc.oneof(
  fc.constant({ type: 'addVariant' as const }),
  slotIndexArb.map((slotIndex) => ({ type: 'discardVariant' as const, slotIndex })),
  fc.tuple(slotIndexArb, blockContentArb).map(([slotIndex, content]) => ({
    type: 'updateVariantContent' as const,
    slotIndex,
    content,
  })),
  fc.tuple(slotIndexArb, viewModeArb).map(([slotIndex, mode]) => ({
    type: 'setViewMode' as const,
    slotIndex,
    mode,
  })),
  fc.tuple(slotIndexArb, codeSubTabArb).map(([slotIndex, tab]) => ({
    type: 'setCodeSubTab' as const,
    slotIndex,
    tab,
  })),
  slotIndexArb.map((slotIndex) => ({ type: 'setFocus' as const, slotIndex })),
  fc.constant({ type: 'toggleSyncScroll' as const })
);

const operationsArb = fc.array(operationArb, { minLength: 1, maxLength: 30 });

// --- Helper to apply an operation ---

function applyOperation(
  hookResult: ReturnType<typeof usePrismState>,
  op: PrismOperation
): void {
  switch (op.type) {
    case 'addVariant':
      hookResult.addVariant();
      break;
    case 'discardVariant':
      hookResult.discardVariant(op.slotIndex);
      break;
    case 'updateVariantContent':
      hookResult.updateVariantContent(op.slotIndex, op.content);
      break;
    case 'setViewMode':
      hookResult.setViewMode(op.slotIndex, op.mode);
      break;
    case 'setCodeSubTab':
      hookResult.setCodeSubTab(op.slotIndex, op.tab);
      break;
    case 'setFocus':
      hookResult.setFocus(op.slotIndex);
      break;
    case 'toggleSyncScroll':
      hookResult.toggleSyncScroll();
      break;
  }
}

// --- Invariant checker ---

function assertSlotStructuralInvariant(state: { slots: (unknown | null)[] }): void {
  // slots.length === 3
  expect(state.slots).toHaveLength(3);

  // slot 0 !== null
  expect(state.slots[0]).not.toBeNull();

  // active count ∈ [1, 3]
  const activeCount = state.slots.filter((s) => s !== null).length;
  expect(activeCount).toBeGreaterThanOrEqual(1);
  expect(activeCount).toBeLessThanOrEqual(3);
}

// --- Property test ---

describe('Property 2: Slot Structural Invariant', () => {
  it('after any sequence of operations, slots.length === 3, slot 0 !== null, active count ∈ [1,3]', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        const { result } = renderHook(() => usePrismState('test-intent', '[]'));

        // Check invariant holds on initial state
        assertSlotStructuralInvariant(result.current.state);

        // Apply each operation and check invariant after each
        for (const op of operations) {
          act(() => {
            applyOperation(result.current, op);
          });
          assertSlotStructuralInvariant(result.current.state);
        }
      }),
      { numRuns: 200 }
    );
  });
});
