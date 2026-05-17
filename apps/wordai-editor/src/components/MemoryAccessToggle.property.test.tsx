/**
 * Property-based tests for MemoryAccessToggle state revert on persistence failure
 *
 * Property 6: Toggle state revert on persistence failure
 * Validates: Requirements 10.7
 *
 * For any initial toggle state (enabled or disabled) and any toggle action that
 * results in a persistence failure, the toggle's displayed state SHALL revert to
 * the initial state prior to the failed toggle action.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { MemoryAccessToggle } from './MemoryAccessToggle';

describe('Property 6: Toggle state revert on persistence failure', () => {
  /**
   * **Validates: Requirements 10.7**
   *
   * The MemoryAccessToggle is a controlled component — the parent manages state.
   * On persistence failure, the parent reverts `enabled` to the original value and
   * sets an `error` message. This test verifies that for ANY initial state and ANY
   * error message, the component displays the original `enabled` state (aria-checked)
   * alongside the error, confirming the revert is visible to the user.
   */
  it('for any initial enabled state and any error message, the toggle displays the original state when error is present', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // initial enabled state
        fc.string({ minLength: 1, maxLength: 200 }), // error message from persistence failure
        (initialEnabled, errorMessage) => {
          const { unmount } = render(
            <MemoryAccessToggle
              enabled={initialEnabled}
              isUpdating={false}
              error={errorMessage}
              onChange={() => { }}
            />
          );

          // The toggle should display the original (reverted) state
          const toggle = screen.getByRole('switch');
          expect(toggle).toHaveAttribute('aria-checked', String(initialEnabled));

          // The error message should be visible to indicate persistence failure
          const alert = screen.getByRole('alert');
          expect(alert).toBeInTheDocument();
          expect(alert.textContent).toContain(errorMessage);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.7**
   *
   * Simulates the full revert cycle: component starts with initial state (no error),
   * then re-renders with the same `enabled` value plus an error — modeling what
   * happens when the parent catches a persistence failure and reverts.
   */
  it('after a failed toggle action, re-rendering with original state and error shows reverted state', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // initial enabled state
        fc.string({ minLength: 1, maxLength: 200 }), // error message
        (initialEnabled, errorMessage) => {
          // Step 1: Render in the "optimistic" toggled state (simulating the brief
          // moment after the user toggled but before the failure is detected)
          const optimisticState = !initialEnabled;
          const { unmount, rerender } = render(
            <MemoryAccessToggle
              enabled={optimisticState}
              isUpdating={true}
              error={null}
              onChange={() => { }}
            />
          );

          // During optimistic update, toggle shows the new state
          const toggleDuringUpdate = screen.getByRole('switch');
          expect(toggleDuringUpdate).toHaveAttribute('aria-checked', String(optimisticState));
          // No error should be shown yet
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          // Step 2: Persistence fails — parent reverts to original state with error
          rerender(
            <MemoryAccessToggle
              enabled={initialEnabled}
              isUpdating={false}
              error={errorMessage}
              onChange={() => { }}
            />
          );

          // The toggle should now show the reverted (original) state
          const toggleAfterRevert = screen.getByRole('switch');
          expect(toggleAfterRevert).toHaveAttribute('aria-checked', String(initialEnabled));

          // Error message should be displayed
          const alert = screen.getByRole('alert');
          expect(alert).toBeInTheDocument();
          expect(alert.textContent).toContain(errorMessage);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
