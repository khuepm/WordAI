/**
 * useSyncScroll — Hook quản lý đồng bộ scroll giữa các PrismVariantPane.
 *
 * Khi syncScroll bật:
 * - Scroll 1 pane → cập nhật tất cả pane khác theo % scrollTop (Req 9.1)
 * - Đồng bộ trong vòng 100ms (sử dụng requestAnimationFrame + throttle)
 * - Hoạt động cho cả Preview và Code view (Req 9.4)
 *
 * Khi toggle bật:
 * - Đồng bộ tất cả pane về % scrollTop của focusedSlot (Req 9.2)
 *
 * Nếu chỉ có 1 pane hiển thị → không đồng bộ (Req 9.5)
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

import { useCallback, useRef, useEffect } from 'react';

export interface UseSyncScrollOptions {
  /** Whether sync scroll is enabled */
  syncScroll: boolean;
  /** The currently focused slot index */
  focusedSlot: number;
  /** Number of active panes (slots that are not null) */
  activePaneCount: number;
}

export interface UseSyncScrollReturn {
  /**
   * Register a scrollable DOM element for a given slot index.
   * Call this as a ref callback on the scrollable container of each pane.
   */
  registerPane: (slotIndex: number, element: HTMLElement | null) => void;

  /**
   * Scroll event handler to be attached to each pane's scrollable container.
   * When called, it syncs all other registered panes to the same scroll percentage.
   */
  handlePaneScroll: (slotIndex: number) => void;
}

/**
 * Calculates the scroll percentage (0–1) of an element.
 * Returns 0 if the element is not scrollable.
 */
export function getScrollPercentage(element: HTMLElement): number {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) return 0;
  return element.scrollTop / maxScroll;
}

/**
 * Sets the scroll position of an element based on a percentage (0–1).
 */
export function setScrollPercentage(element: HTMLElement, percentage: number): void {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) return;
  element.scrollTop = percentage * maxScroll;
}

export function useSyncScroll({
  syncScroll,
  focusedSlot,
  activePaneCount,
}: UseSyncScrollOptions): UseSyncScrollReturn {
  // Store refs to registered pane elements (indexed by slot)
  const paneRefsMap = useRef<Map<number, HTMLElement>>(new Map());

  // Throttle flag — prevents re-entrant scroll events
  const isSyncingRef = useRef(false);

  // Track the last RAF id for cleanup
  const rafIdRef = useRef<number | null>(null);

  // Track previous syncScroll value to detect toggle on
  const prevSyncScrollRef = useRef(syncScroll);

  /**
   * Register a scrollable element for a slot index.
   * Pass null to unregister (e.g., when pane unmounts).
   */
  const registerPane = useCallback((slotIndex: number, element: HTMLElement | null) => {
    if (element) {
      paneRefsMap.current.set(slotIndex, element);
    } else {
      paneRefsMap.current.delete(slotIndex);
    }
  }, []);

  /**
   * Handle scroll event from a specific pane.
   * Syncs all other registered panes to the same scroll percentage.
   * Uses requestAnimationFrame for throttling (ensures within 100ms / ~16ms per frame).
   */
  const handlePaneScroll = useCallback((slotIndex: number) => {
    // Don't sync if disabled, only 1 pane, or already syncing (prevent loops)
    if (!syncScroll || activePaneCount <= 1 || isSyncingRef.current) {
      return;
    }

    const sourceElement = paneRefsMap.current.get(slotIndex);
    if (!sourceElement) return;

    // Cancel any pending RAF to throttle
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      isSyncingRef.current = true;

      const percentage = getScrollPercentage(sourceElement);

      // Apply to all other registered panes
      paneRefsMap.current.forEach((element, idx) => {
        if (idx !== slotIndex) {
          setScrollPercentage(element, percentage);
        }
      });

      // Release the syncing lock after a microtask to allow the browser
      // to process the scroll events we just triggered before we listen again
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    });
  }, [syncScroll, activePaneCount]);

  /**
   * When syncScroll toggles from off to on, sync all panes to focusedSlot's position.
   * (Req 9.2)
   */
  useEffect(() => {
    const wasOff = !prevSyncScrollRef.current;
    const isNowOn = syncScroll;
    prevSyncScrollRef.current = syncScroll;

    if (wasOff && isNowOn && activePaneCount > 1) {
      // Sync all panes to the focused slot's scroll percentage
      const focusedElement = paneRefsMap.current.get(focusedSlot);
      if (!focusedElement) return;

      const percentage = getScrollPercentage(focusedElement);

      paneRefsMap.current.forEach((element, idx) => {
        if (idx !== focusedSlot) {
          setScrollPercentage(element, percentage);
        }
      });
    }
  }, [syncScroll, focusedSlot, activePaneCount]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    registerPane,
    handlePaneScroll,
  };
}
