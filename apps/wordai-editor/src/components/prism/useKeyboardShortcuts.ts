/**
 * useKeyboardShortcuts — Hook quản lý keyboard shortcuts cho PrismCanvas.
 *
 * Shortcuts:
 * - Cmd+1 / Cmd+2 / Cmd+3: chuyển focus sang slot tương ứng (chỉ nếu slot không null)
 * - Cmd+Enter: thêm variant mới
 *
 * Chỉ gắn keyboard listeners khi component mounted.
 * Các EditorCanvas ngoài focus render read-only (handled bởi PrismVariantPane isFocused prop).
 *
 * Requirements: 11.1
 */

import { useEffect, useCallback } from 'react';
import type { PrismSlotIndex, PrismState } from './types';

export interface UseKeyboardShortcutsOptions {
  /** Current Prism state — used to check which slots are non-null */
  state: PrismState;
  /** Set focus to a specific slot */
  setFocus: (slotIndex: PrismSlotIndex) => void;
  /** Add a new variant */
  addVariant: () => void;
}

/**
 * Registers global keyboard shortcuts for Prism multi-variant editor.
 * Only allows focusing on non-null slots.
 * Cmd+Enter only adds variant if there's an available slot.
 */
export function useKeyboardShortcuts({
  state,
  setFocus,
  addVariant,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle Meta (Cmd on macOS) key combinations
      if (!event.metaKey) return;

      // Cmd+1/2/3: switch focus to slot 0/1/2
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const slotIndex = (parseInt(event.key, 10) - 1) as PrismSlotIndex;

        // Only focus if the target slot is not null
        if (state.slots[slotIndex] !== null) {
          event.preventDefault();
          setFocus(slotIndex);
        }
        return;
      }

      // Cmd+Enter: add new variant
      if (event.key === 'Enter') {
        // Only add if there's an available slot (less than 3 active)
        const activeCount = state.slots.filter(Boolean).length;
        if (activeCount < 3) {
          event.preventDefault();
          addVariant();
        }
        return;
      }
    },
    [state.slots, setFocus, addVariant]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
