/**
 * Unit tests for useFocusTrap hook
 * Requirements: 7.1, 7.5, 7.6, 7.8, 14.2, 14.3
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  const btn1 = document.createElement('button');
  btn1.textContent = 'First';
  const btn2 = document.createElement('button');
  btn2.textContent = 'Second';
  const btn3 = document.createElement('button');
  btn3.textContent = 'Third';
  container.appendChild(btn1);
  container.appendChild(btn2);
  container.appendChild(btn3);
  document.body.appendChild(container);
  return container;
}

function createTrigger(): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.textContent = 'Trigger';
  document.body.appendChild(trigger);
  return trigger;
}

describe('useFocusTrap', () => {
  let container: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let containerRef: { current: HTMLElement | null };
  let triggerRef: { current: HTMLElement | null };

  beforeEach(() => {
    vi.useFakeTimers();
    container = createContainer();
    trigger = createTrigger();
    containerRef = { current: container };
    triggerRef = { current: trigger };
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('moves focus to first focusable element when activated', () => {
    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const buttons = container.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('does not move focus when inactive', () => {
    trigger.focus();

    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, false, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(document.activeElement).toBe(trigger);
  });

  it('wraps focus from last to first on Tab', () => {
    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const buttons = container.querySelectorAll('button');
    // Focus the last button
    act(() => {
      buttons[2].focus();
    });

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      document.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const buttons = container.querySelectorAll('button');
    // Focus should already be on first button
    expect(document.activeElement).toBe(buttons[0]);

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      document.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();

    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>, onClose)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to trigger element on deactivation', () => {
    const { rerender } = renderHook(
      ({ isActive }) =>
        useFocusTrap(containerRef as React.RefObject<HTMLElement>, isActive, triggerRef as React.RefObject<HTMLElement>),
      { initialProps: { isActive: true } }
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Focus should be inside container
    const buttons = container.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);

    // Deactivate the trap
    rerender({ isActive: false });

    expect(document.activeElement).toBe(trigger);
  });

  it('does not trap focus when Tab is pressed in the middle of focusable elements', () => {
    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const buttons = container.querySelectorAll('button');
    // Focus the middle button
    act(() => {
      buttons[1].focus();
    });

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      document.dispatchEvent(event);
    });

    // Should NOT prevent default — browser handles normal tab
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('skips disabled elements when determining focusable boundaries', () => {
    // Add a disabled button at the end
    const disabledBtn = document.createElement('button');
    disabledBtn.textContent = 'Disabled';
    disabledBtn.setAttribute('disabled', '');
    container.appendChild(disabledBtn);

    renderHook(() =>
      useFocusTrap(containerRef as React.RefObject<HTMLElement>, true, triggerRef as React.RefObject<HTMLElement>)
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    // The third button (index 2) is the last enabled one — "Third"
    const buttons = container.querySelectorAll('button:not([disabled])');
    const lastEnabled = buttons[buttons.length - 1];

    // Focus the last enabled button
    act(() => {
      (lastEnabled as HTMLElement).focus();
    });
    expect(document.activeElement).toBe(lastEnabled);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      document.dispatchEvent(event);
    });

    // Should wrap to first since the disabled button is excluded from the focusable list
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[0]);
  });
});
