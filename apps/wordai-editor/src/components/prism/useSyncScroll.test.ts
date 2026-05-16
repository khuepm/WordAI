/**
 * Unit tests for useSyncScroll hook.
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncScroll, getScrollPercentage, setScrollPercentage } from './useSyncScroll';

// Helper to create a mock scrollable element
function createMockScrollElement(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
      Object.defineProperty(el, 'scrollTop', {
        get: () => scrollTop,
        set: (v2: number) => {
          scrollTop = v2;
        },
        configurable: true,
      });
    },
    configurable: true,
  });
  Object.defineProperty(el, 'scrollHeight', {
    get: () => scrollHeight,
    configurable: true,
  });
  Object.defineProperty(el, 'clientHeight', {
    get: () => clientHeight,
    configurable: true,
  });
  return el;
}

describe('getScrollPercentage', () => {
  it('returns 0 when element is not scrollable', () => {
    const el = createMockScrollElement(0, 100, 100);
    expect(getScrollPercentage(el)).toBe(0);
  });

  it('returns 0 when scrollTop is 0', () => {
    const el = createMockScrollElement(0, 500, 100);
    expect(getScrollPercentage(el)).toBe(0);
  });

  it('returns 1 when scrolled to bottom', () => {
    const el = createMockScrollElement(400, 500, 100);
    expect(getScrollPercentage(el)).toBe(1);
  });

  it('returns 0.5 when scrolled to middle', () => {
    const el = createMockScrollElement(200, 500, 100);
    expect(getScrollPercentage(el)).toBe(0.5);
  });
});

describe('setScrollPercentage', () => {
  it('sets scrollTop to 0 for percentage 0', () => {
    const el = createMockScrollElement(100, 500, 100);
    setScrollPercentage(el, 0);
    expect(el.scrollTop).toBe(0);
  });

  it('sets scrollTop to max for percentage 1', () => {
    const el = createMockScrollElement(0, 500, 100);
    setScrollPercentage(el, 1);
    expect(el.scrollTop).toBe(400);
  });

  it('sets scrollTop to middle for percentage 0.5', () => {
    const el = createMockScrollElement(0, 500, 100);
    setScrollPercentage(el, 0.5);
    expect(el.scrollTop).toBe(200);
  });

  it('does nothing when element is not scrollable', () => {
    const el = createMockScrollElement(0, 100, 100);
    setScrollPercentage(el, 0.5);
    expect(el.scrollTop).toBe(0);
  });
});

describe('useSyncScroll', () => {
  let rafCallbacks: (() => void)[];
  let originalRaf: typeof requestAnimationFrame;
  let originalCancelRaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    // Mock requestAnimationFrame to execute synchronously for testing
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(() => cb(0));
      return rafCallbacks.length;
    }) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks[id - 1] = () => {};
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  function flushRaf() {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    cbs.forEach((cb) => cb());
  }

  it('returns registerPane and handlePaneScroll functions', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 })
    );
    expect(typeof result.current.registerPane).toBe('function');
    expect(typeof result.current.handlePaneScroll).toBe('function');
  });

  it('does not sync when syncScroll is disabled', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: false, focusedSlot: 0, activePaneCount: 2 })
    );

    const el0 = createMockScrollElement(200, 500, 100);
    const el1 = createMockScrollElement(0, 500, 100);

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // el1 should NOT be synced because syncScroll is off
    expect(el1.scrollTop).toBe(0);
  });

  it('does not sync when only 1 pane is active (Req 9.5)', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 1 })
    );

    const el0 = createMockScrollElement(200, 500, 100);

    act(() => {
      result.current.registerPane(0, el0);
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // No error, no sync needed
  });

  it('syncs other panes to same scroll percentage when syncScroll is on (Req 9.1)', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 })
    );

    // el0 is scrolled to 50%, el1 is at 0%
    const el0 = createMockScrollElement(200, 500, 100);
    const el1 = createMockScrollElement(0, 800, 100);

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });

    // Flush the first RAF (sync operation)
    flushRaf();

    // el1 should be synced to 50% of its own max scroll (800-100=700 * 0.5 = 350)
    expect(el1.scrollTop).toBe(350);
  });

  it('syncs all panes to focusedSlot when syncScroll toggles on (Req 9.2)', () => {
    const el0 = createMockScrollElement(200, 500, 100); // 50%
    const el1 = createMockScrollElement(0, 800, 100);

    const { result, rerender } = renderHook(
      (props) => useSyncScroll(props),
      { initialProps: { syncScroll: false, focusedSlot: 0, activePaneCount: 2 } }
    );

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Toggle syncScroll on
    rerender({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 });

    // el1 should be synced to el0's percentage (50%)
    // 700 * 0.5 = 350
    expect(el1.scrollTop).toBe(350);
  });

  it('syncs to the focused slot when toggle on (not slot 0)', () => {
    const el0 = createMockScrollElement(0, 500, 100); // 0%
    const el1 = createMockScrollElement(350, 800, 100); // 50%

    const { result, rerender } = renderHook(
      (props) => useSyncScroll(props),
      { initialProps: { syncScroll: false, focusedSlot: 1, activePaneCount: 2 } }
    );

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Toggle syncScroll on with focusedSlot = 1
    rerender({ syncScroll: true, focusedSlot: 1, activePaneCount: 2 });

    // el0 should be synced to el1's percentage (50%)
    // 400 * 0.5 = 200
    expect(el0.scrollTop).toBe(200);
  });

  it('unregisters pane when null is passed', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 })
    );

    const el0 = createMockScrollElement(200, 500, 100);
    const el1 = createMockScrollElement(0, 800, 100);

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Unregister el1
    act(() => {
      result.current.registerPane(1, null);
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // el1 should not be affected since it's unregistered
    expect(el1.scrollTop).toBe(0);
  });

  it('works with 3 panes (Req 9.4)', () => {
    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 3 })
    );

    const el0 = createMockScrollElement(200, 500, 100); // 50%
    const el1 = createMockScrollElement(0, 800, 100);
    const el2 = createMockScrollElement(0, 1000, 100);

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
      result.current.registerPane(2, el2);
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // el1: 700 * 0.5 = 350
    expect(el1.scrollTop).toBe(350);
    // el2: 900 * 0.5 = 450
    expect(el2.scrollTop).toBe(450);
  });
});
