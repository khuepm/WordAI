/**
 * Unit tests for useFocusTrap hook
 * Requirements: 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function createContainer(...elements: HTMLElement[]): HTMLDivElement {
  const container = document.createElement('div');
  elements.forEach((el) => container.appendChild(el));
  document.body.appendChild(container);
  return container;
}

function createButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  return btn;
}

function createInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  input.placeholder = placeholder;
  return input;
}

describe('useFocusTrap', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // -------------------------------------------------------------------------
  // Tab wraps from last to first focusable element (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Tab key wraps focus from last to first element', () => {
    it('wraps focus to first element when Tab is pressed on last element', () => {
      const btn1 = createButton('First');
      const btn2 = createButton('Second');
      const btn3 = createButton('Third');
      container = createContainer(btn1, btn2, btn3);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      // Focus the last element
      btn3.focus();
      expect(document.activeElement).toBe(btn3);

      // Press Tab
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(btn1);
    });
  });

  // -------------------------------------------------------------------------
  // Shift+Tab wraps from first to last focusable element (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Shift+Tab wraps focus from first to last element', () => {
    it('wraps focus to last element when Shift+Tab is pressed on first element', () => {
      const btn1 = createButton('First');
      const btn2 = createButton('Second');
      const btn3 = createButton('Third');
      container = createContainer(btn1, btn2, btn3);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      // Focus the first element
      btn1.focus();
      expect(document.activeElement).toBe(btn1);

      // Press Shift+Tab
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(btn3);
    });
  });

  // -------------------------------------------------------------------------
  // Does not trap focus when inactive (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Does not trap focus when inactive', () => {
    it('does not intercept Tab when isActive is false', () => {
      const btn1 = createButton('First');
      const btn2 = createButton('Second');
      container = createContainer(btn1, btn2);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, false));

      btn2.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Restores focus to previously focused element on deactivation (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Restores focus on deactivation', () => {
    it('restores focus to the previously focused element when deactivated', async () => {
      const outsideButton = document.createElement('button');
      outsideButton.textContent = 'Outside';
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      const btn1 = createButton('Inside');
      container = createContainer(btn1);

      const ref = { current: container };
      const { rerender } = renderHook(
        ({ isActive }) => useFocusTrap(ref, isActive),
        { initialProps: { isActive: true } },
      );

      // Deactivate the trap
      rerender({ isActive: false });

      expect(document.activeElement).toBe(outsideButton);

      document.body.removeChild(outsideButton);
    });
  });

  // -------------------------------------------------------------------------
  // Skips disabled elements (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Skips disabled elements', () => {
    it('does not include disabled buttons in the focus cycle', () => {
      const btn1 = createButton('First');
      const disabledBtn = createButton('Disabled');
      disabledBtn.disabled = true;
      const btn2 = createButton('Last');
      container = createContainer(btn1, disabledBtn, btn2);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      // Focus the last enabled element
      btn2.focus();
      expect(document.activeElement).toBe(btn2);

      // Press Tab — should wrap to first (skipping disabled)
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(btn1);
    });
  });

  // -------------------------------------------------------------------------
  // Handles container with no focusable elements (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Handles empty container', () => {
    it('prevents default Tab when no focusable elements exist', () => {
      const div = document.createElement('div');
      div.textContent = 'No focusable elements';
      container = createContainer(div);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Does not interfere with non-Tab keys (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Does not interfere with non-Tab keys', () => {
    it('ignores Enter key presses', () => {
      const btn1 = createButton('First');
      container = createContainer(btn1);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Tab in the middle does not wrap (Req 1.5)
  // -------------------------------------------------------------------------
  describe('Tab in the middle does not wrap', () => {
    it('does not prevent default when focus is on a middle element', () => {
      const btn1 = createButton('First');
      const btn2 = createButton('Middle');
      const btn3 = createButton('Last');
      container = createContainer(btn1, btn2, btn3);

      const ref = { current: container };
      renderHook(() => useFocusTrap(ref, true));

      // Focus the middle element
      btn2.focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      // Should not prevent default — browser handles normal tab
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });
});
