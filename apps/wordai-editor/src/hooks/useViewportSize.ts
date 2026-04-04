/**
 * useViewportSize - Reactive viewport size hook with debounce
 * Requirements: 3.4
 */

import { useState, useEffect } from 'react';

export interface ViewportSize {
  width: number;
  height: number;
}

/** Breakpoints used by the responsive modal system */
export const MODAL_BREAKPOINTS = {
  COLLAPSE_SIDEBAR: 720, // px — sidebar collapses to icon-only
  STACK_LAYOUT: 480,     // px — layout switches to single-column
} as const;

const SSR_FALLBACK: ViewportSize = { width: 1024, height: 768 };

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return SSR_FALLBACK;
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Returns the current viewport size and re-renders on resize.
 * Debounced to ~16ms (one animation frame) to avoid excessive re-renders.
 * Falls back to `{ width: 1024, height: 768 }` in SSR environments.
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(getViewportSize);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timerId !== null) clearTimeout(timerId);
      timerId = setTimeout(() => {
        setSize(getViewportSize());
      }, 16);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  return size;
}
