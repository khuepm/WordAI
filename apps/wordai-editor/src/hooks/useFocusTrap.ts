/**
 * useFocusTrap - Traps keyboard focus within a container element
 * Requirements: 7.1, 7.5, 7.6, 7.8, 14.2, 14.3
 */

import { useEffect, useCallback } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container element while active.
 *
 * - Moves focus to the first focusable element when activated
 * - Tab/Shift+Tab cycles within the container only
 * - Escape key triggers the onClose callback
 * - Returns focus to the trigger element on deactivation
 *
 * @param containerRef - Ref to the container element that traps focus
 * @param isActive - Whether the focus trap is currently active
 * @param triggerRef - Ref to the element that triggered the trap (receives focus on close)
 * @param onClose - Callback invoked when Escape is pressed
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean,
  triggerRef: React.RefObject<HTMLElement>,
  onClose?: () => void
): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [containerRef, onClose]
  );

  // Move initial focus when activated
  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Small delay to ensure the container is rendered and focusable elements are available
    const timerId = setTimeout(() => {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }, 0);

    return () => clearTimeout(timerId);
  }, [isActive, containerRef]);

  // Attach/detach keydown listener
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, handleKeyDown]);

  // Return focus to trigger element on deactivation
  useEffect(() => {
    if (isActive) return;

    // This effect runs when isActive transitions to false.
    // We use a ref-based approach: the cleanup of the "active" phase returns focus.
    return undefined;
  }, [isActive]);

  // Cleanup: return focus to trigger on unmount or deactivation
  useEffect(() => {
    if (!isActive) return;

    return () => {
      // Return focus to the trigger element when the trap deactivates
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    };
  }, [isActive, triggerRef]);
}
