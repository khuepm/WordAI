/**
 * Unit tests for useKeyboardShortcuts hook.
 * Requirements: 11.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { PrismState, PrismVariant, PrismSlotIndex } from './types';

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

describe('useKeyboardShortcuts', () => {
  let setFocus: ReturnType<typeof vi.fn>;
  let addVariant: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setFocus = vi.fn();
    addVariant = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cmd+1/2/3 — switch focus slot', () => {
    it('Cmd+1 sets focus to slot 0 when slot 0 is not null', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('1');
      expect(setFocus).toHaveBeenCalledWith(0);
    });

    it('Cmd+2 sets focus to slot 1 when slot 1 is not null', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('2');
      expect(setFocus).toHaveBeenCalledWith(1);
    });

    it('Cmd+3 sets focus to slot 2 when slot 2 is not null', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), createVariant()],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('3');
      expect(setFocus).toHaveBeenCalledWith(2);
    });

    it('Cmd+2 does nothing when slot 1 is null', () => {
      const state = createState({
        slots: [createVariant(), null, null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('2');
      expect(setFocus).not.toHaveBeenCalled();
    });

    it('Cmd+3 does nothing when slot 2 is null', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('3');
      expect(setFocus).not.toHaveBeenCalled();
    });

    it('does not trigger without Meta key', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), createVariant()],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('1', false);
      fireKeydown('2', false);
      fireKeydown('3', false);
      expect(setFocus).not.toHaveBeenCalled();
    });
  });

  describe('Cmd+Enter — add new variant', () => {
    it('calls addVariant when there are available slots', () => {
      const state = createState({
        slots: [createVariant(), null, null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('Enter');
      expect(addVariant).toHaveBeenCalledTimes(1);
    });

    it('does not call addVariant when all 3 slots are full', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), createVariant()],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('Enter');
      expect(addVariant).not.toHaveBeenCalled();
    });

    it('does not trigger without Meta key', () => {
      const state = createState({
        slots: [createVariant(), null, null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      fireKeydown('Enter', false);
      expect(addVariant).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), null],
      });

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      unmount();

      // After unmount, keyboard events should not trigger callbacks
      fireKeydown('2');
      expect(setFocus).not.toHaveBeenCalled();
    });
  });

  describe('preventDefault', () => {
    it('prevents default for Cmd+1 when slot is valid', () => {
      const state = createState({
        slots: [createVariant(), createVariant(), null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      const event = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Enter when slots available', () => {
      const state = createState({
        slots: [createVariant(), null, null],
      });

      renderHook(() =>
        useKeyboardShortcuts({ state, setFocus, addVariant })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
