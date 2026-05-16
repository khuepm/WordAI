/**
 * Integration tests for keyboard shortcuts and sync scroll in Prism Multi-Variant Editor.
 *
 * Tests the interaction between:
 * - useKeyboardShortcuts + usePrismState (Cmd+1/2/3 switches focus)
 * - useSyncScroll + toggleSyncScroll (sync scroll toggle → scroll đồng bộ)
 * - View toggle preserves scroll position (scroll % saved/restored across mode switch)
 *
 * Requirements: 9.1, 9.2, 11.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useSyncScroll, getScrollPercentage } from './useSyncScroll';
import type { PrismState, PrismVariant, PrismSlotIndex } from './types';

// --- Helpers ---

function createVariant(overrides: Partial<PrismVariant> = {}): PrismVariant {
  return {
    id: crypto.randomUUID(),
    label: 'Test',
    blockContent: '[]',
    source: { kind: 'markdown' },
    pinned: false,
    dirty: false,
    ...overrides,
  };
}

function createState(overrides: Partial<PrismState> = {}): PrismState {
  return {
    slots: [createVariant(), null, null],
    modes: ['preview', 'preview', 'preview'],
    codeSubTabs: ['markdown', 'markdown', 'markdown'],
    focusedSlot: 0,
    syncScroll: false,
    ...overrides,
  };
}

function fireKeydown(key: string, metaKey = true) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

function createMockScrollElement(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): HTMLElement {
  const el = document.createElement('div');
  let _scrollTop = scrollTop;
  Object.defineProperty(el, 'scrollTop', {
    get: () => _scrollTop,
    set: (v: number) => { _scrollTop = v; },
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

// --- Integration Tests ---

describe('Integration: Keyboard shortcuts + focus switching (Req 11.1)', () => {
  let state: PrismState;
  let setFocus: ReturnType<typeof vi.fn>;
  let addVariant: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setFocus = vi.fn();
    addVariant = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Cmd+1/2/3 switches focus between all 3 active slots sequentially', () => {
    state = createState({
      slots: [createVariant(), createVariant(), createVariant()],
      focusedSlot: 0,
    });

    renderHook(() =>
      useKeyboardShortcuts({ state, setFocus, addVariant })
    );

    // Switch to slot 1
    fireKeydown('2');
    expect(setFocus).toHaveBeenCalledWith(1);

    // Switch to slot 2
    fireKeydown('3');
    expect(setFocus).toHaveBeenCalledWith(2);

    // Switch back to slot 0
    fireKeydown('1');
    expect(setFocus).toHaveBeenCalledWith(0);

    expect(setFocus).toHaveBeenCalledTimes(3);
  });

  it('Cmd+2 does not switch focus when only slot 0 is active (integration with state)', () => {
    state = createState({
      slots: [createVariant(), null, null],
      focusedSlot: 0,
    });

    renderHook(() =>
      useKeyboardShortcuts({ state, setFocus, addVariant })
    );

    fireKeydown('2');
    fireKeydown('3');

    expect(setFocus).not.toHaveBeenCalled();
  });

  it('Cmd+Enter adds variant then Cmd+2 can switch to new slot', () => {
    // Start with 1 slot
    const variant0 = createVariant();
    state = createState({
      slots: [variant0, null, null],
      focusedSlot: 0,
    });

    const { rerender } = renderHook(
      (props) => useKeyboardShortcuts(props),
      { initialProps: { state, setFocus, addVariant } }
    );

    // Add variant via Cmd+Enter
    fireKeydown('Enter');
    expect(addVariant).toHaveBeenCalledTimes(1);

    // Simulate state update after addVariant (slot 1 now has a variant)
    const updatedState = createState({
      slots: [variant0, createVariant(), null],
      focusedSlot: 0,
    });

    rerender({ state: updatedState, setFocus, addVariant });

    // Now Cmd+2 should work
    fireKeydown('2');
    expect(setFocus).toHaveBeenCalledWith(1);
  });

  it('focus switch respects slot availability after discard (slot becomes null)', () => {
    const variant0 = createVariant();
    const variant1 = createVariant();
    const variant2 = createVariant();

    state = createState({
      slots: [variant0, variant1, variant2],
      focusedSlot: 0,
    });

    const { rerender } = renderHook(
      (props) => useKeyboardShortcuts(props),
      { initialProps: { state, setFocus, addVariant } }
    );

    // Cmd+3 works initially
    fireKeydown('3');
    expect(setFocus).toHaveBeenCalledWith(2);

    // Simulate discard of slot 2 (becomes null)
    const stateAfterDiscard = createState({
      slots: [variant0, variant1, null],
      focusedSlot: 0,
    });

    rerender({ state: stateAfterDiscard, setFocus, addVariant });
    setFocus.mockClear();

    // Cmd+3 should no longer work
    fireKeydown('3');
    expect(setFocus).not.toHaveBeenCalled();

    // Cmd+2 still works
    fireKeydown('2');
    expect(setFocus).toHaveBeenCalledWith(1);
  });
});

describe('Integration: Sync scroll toggle → scroll đồng bộ (Req 9.1, 9.2)', () => {
  let rafCallbacks: (() => void)[];
  let originalRaf: typeof requestAnimationFrame;
  let originalCancelRaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(() => cb(0));
      return rafCallbacks.length;
    }) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      if (rafCallbacks[id - 1]) rafCallbacks[id - 1] = () => {};
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

  it('toggling syncScroll on syncs all panes to focused slot scroll position', () => {
    // Slot 0 at 50%, slot 1 at 0%, slot 2 at 75%
    const el0 = createMockScrollElement(200, 500, 100); // 50%
    const el1 = createMockScrollElement(0, 800, 100);   // 0%
    const el2 = createMockScrollElement(675, 1000, 100); // 75%

    const { result, rerender } = renderHook(
      (props) => useSyncScroll(props),
      {
        initialProps: {
          syncScroll: false,
          focusedSlot: 0,
          activePaneCount: 3,
        },
      }
    );

    // Register all 3 panes
    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
      result.current.registerPane(2, el2);
    });

    // Toggle syncScroll on — should sync all to slot 0's 50%
    rerender({ syncScroll: true, focusedSlot: 0, activePaneCount: 3 });

    // el1: (800-100) * 0.5 = 350
    expect(el1.scrollTop).toBe(350);
    // el2: (1000-100) * 0.5 = 450
    expect(el2.scrollTop).toBe(450);
  });

  it('after toggle on, scrolling one pane syncs all others', () => {
    const el0 = createMockScrollElement(0, 500, 100);
    const el1 = createMockScrollElement(0, 800, 100);

    const { result } = renderHook(() =>
      useSyncScroll({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 })
    );

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Simulate scrolling el0 to 60%
    Object.defineProperty(el0, 'scrollTop', {
      get: () => 240, // 240 / (500-100) = 60%
      set: () => {},
      configurable: true,
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // el1 should be at 60%: (800-100) * 0.6 = 420
    expect(el1.scrollTop).toBe(420);
  });

  it('toggling syncScroll off then scrolling does not sync other panes', () => {
    const el0 = createMockScrollElement(200, 500, 100); // 50%
    const el1 = createMockScrollElement(0, 800, 100);

    // Start with syncScroll off, then toggle on (to sync), then toggle off
    const { result, rerender } = renderHook(
      (props) => useSyncScroll(props),
      {
        initialProps: { syncScroll: false, focusedSlot: 0, activePaneCount: 2 },
      }
    );

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Toggle on — syncs el1 to el0's 50%: (800-100) * 0.5 = 350
    rerender({ syncScroll: true, focusedSlot: 0, activePaneCount: 2 });
    expect(el1.scrollTop).toBe(350);

    // Toggle off
    rerender({ syncScroll: false, focusedSlot: 0, activePaneCount: 2 });

    // Scroll el0 to a different position — should NOT sync el1
    Object.defineProperty(el0, 'scrollTop', {
      get: () => 400, // 100% of (500-100)
      set: () => {},
      configurable: true,
    });

    act(() => {
      result.current.handlePaneScroll(0);
    });
    flushRaf();

    // el1 should remain at 350 (from the toggle-on sync), not updated to 100%
    expect(el1.scrollTop).toBe(350);
  });

  it('sync scroll with focused slot change syncs to new focused slot on re-toggle', () => {
    const el0 = createMockScrollElement(100, 500, 100); // 25%
    const el1 = createMockScrollElement(350, 800, 100); // 50%

    const { result, rerender } = renderHook(
      (props) => useSyncScroll(props),
      {
        initialProps: { syncScroll: false, focusedSlot: 1, activePaneCount: 2 },
      }
    );

    act(() => {
      result.current.registerPane(0, el0);
      result.current.registerPane(1, el1);
    });

    // Toggle on with focusedSlot = 1 → sync all to slot 1's 50%
    rerender({ syncScroll: true, focusedSlot: 1, activePaneCount: 2 });

    // el0: (500-100) * 0.5 = 200
    expect(el0.scrollTop).toBe(200);
  });
});

describe('Integration: View toggle preserves scroll position (Req 2.4)', () => {
  it('scroll percentage is preserved across preview→code→preview toggle', () => {
    // This tests the scroll preservation logic used in PrismVariantPane.
    // The component saves scrollPercentage before switching and restores after.
    // We simulate this pattern directly.

    const container = createMockScrollElement(300, 700, 100); // 50% (300/600)

    // Save scroll percentage before switching (simulates handleTabClick)
    const scrollableHeight = 700 - 100; // scrollHeight - clientHeight
    const savedPercent = container.scrollTop / scrollableHeight;
    expect(savedPercent).toBe(0.5);

    // Simulate switching to code view — new container with different content height
    const codeContainer = createMockScrollElement(0, 1000, 100); // starts at 0

    // Restore scroll percentage (simulates the useEffect after viewMode change)
    const codeScrollableHeight = 1000 - 100;
    codeContainer.scrollTop = savedPercent * codeScrollableHeight;

    // Code container should be at 50% of its own height
    expect(codeContainer.scrollTop).toBe(450); // 0.5 * 900 = 450

    // Verify the percentage is preserved within 5% tolerance (Req 2.4)
    const restoredPercent = getScrollPercentage(codeContainer);
    expect(Math.abs(restoredPercent - savedPercent)).toBeLessThanOrEqual(0.05);
  });

  it('scroll percentage 0 (top) is preserved correctly', () => {
    const container = createMockScrollElement(0, 700, 100);
    const scrollableHeight = 700 - 100;
    const savedPercent = scrollableHeight > 0 ? container.scrollTop / scrollableHeight : 0;

    expect(savedPercent).toBe(0);

    // After switching view, restore at top
    const newContainer = createMockScrollElement(0, 1200, 100);
    const newScrollableHeight = 1200 - 100;
    newContainer.scrollTop = savedPercent * newScrollableHeight;

    expect(newContainer.scrollTop).toBe(0);
  });

  it('scroll percentage 1 (bottom) is preserved correctly', () => {
    const container = createMockScrollElement(600, 700, 100); // 100%
    const scrollableHeight = 700 - 100;
    const savedPercent = container.scrollTop / scrollableHeight;

    expect(savedPercent).toBe(1);

    // After switching view, restore at bottom
    const newContainer = createMockScrollElement(0, 500, 100);
    const newScrollableHeight = 500 - 100;
    newContainer.scrollTop = savedPercent * newScrollableHeight;

    expect(newContainer.scrollTop).toBe(400); // 1.0 * 400 = 400
    expect(getScrollPercentage(newContainer)).toBe(1);
  });

  it('scroll position is preserved independently per pane when sync scroll is off', () => {
    // Two panes with different scroll positions
    const pane0 = createMockScrollElement(200, 600, 100); // 40%
    const pane1 = createMockScrollElement(450, 1000, 100); // 50%

    const pane0Percent = pane0.scrollTop / (600 - 100); // 0.4
    const pane1Percent = pane1.scrollTop / (1000 - 100); // 0.5

    expect(pane0Percent).toBeCloseTo(0.4);
    expect(pane1Percent).toBeCloseTo(0.5);

    // Simulate view toggle on pane 0 only — pane 1 should not be affected
    const newPane0 = createMockScrollElement(0, 800, 100);
    newPane0.scrollTop = pane0Percent * (800 - 100); // 0.4 * 700 = 280

    expect(newPane0.scrollTop).toBe(280);
    expect(getScrollPercentage(newPane0)).toBeCloseTo(0.4);

    // pane1 remains unchanged
    expect(pane1.scrollTop).toBe(450);
  });
});
