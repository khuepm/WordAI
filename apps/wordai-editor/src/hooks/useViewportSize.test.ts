/**
 * Unit tests for useViewportSize hook
 * Requirements: 3.4
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useViewportSize, MODAL_BREAKPOINTS } from './useViewportSize';

describe('MODAL_BREAKPOINTS', () => {
  it('exports COLLAPSE_SIDEBAR = 720', () => {
    expect(MODAL_BREAKPOINTS.COLLAPSE_SIDEBAR).toBe(720);
  });

  it('exports STACK_LAYOUT = 480', () => {
    expect(MODAL_BREAKPOINTS.STACK_LAYOUT).toBe(480);
  });
});

describe('useViewportSize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current window dimensions on mount', () => {
    const { result } = renderHook(() => useViewportSize());
    expect(result.current.width).toBe(1280);
    expect(result.current.height).toBe(800);
  });

  it('updates size after resize event (debounced ~16ms)', () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 600 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
    });

    // Before debounce fires, size should be unchanged
    expect(result.current.width).toBe(1280);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current.width).toBe(600);
    expect(result.current.height).toBe(400);
  });

  it('debounces rapid resize events — only updates once after last event', () => {
    const { result } = renderHook(() => useViewportSize());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(8);

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(8);

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 300 });
      window.dispatchEvent(new Event('resize'));
    });

    // Still at original value
    expect(result.current.width).toBe(1280);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    // Only the last resize value
    expect(result.current.width).toBe(300);
  });

  it('removes resize listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useViewportSize());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('cancels pending debounce timer on unmount', () => {
    const { result, unmount } = renderHook(() => useViewportSize());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
      window.dispatchEvent(new Event('resize'));
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(16);
    });

    // Size should not have updated after unmount
    expect(result.current.width).toBe(1280);
  });
});
