import { useState, useCallback } from 'react';
import type {
  PrismState,
  PrismVariant,
  PrismSlotIndex,
  PrismViewMode,
  PrismCodeSubTab,
  AuraSphereSuggestion,
} from './types';

export interface UsePrismStateReturn {
  state: PrismState;
  addVariant: (variant?: Partial<PrismVariant>) => void;
  discardVariant: (slotIndex: PrismSlotIndex) => void;
  promoteVariant: (slotIndex: PrismSlotIndex) => void;
  updateVariantContent: (slotIndex: PrismSlotIndex, blockContent: string) => void;
  updateFromMarkdown: (slotIndex: PrismSlotIndex, markdown: string) => void;
  setViewMode: (slotIndex: PrismSlotIndex, mode: PrismViewMode) => void;
  setCodeSubTab: (slotIndex: PrismSlotIndex, tab: PrismCodeSubTab) => void;
  setFocus: (slotIndex: PrismSlotIndex) => void;
  toggleSyncScroll: () => void;
  pinVariant: (slotIndex: PrismSlotIndex) => void;
  addAuraSphereVariants: (suggestion: AuraSphereSuggestion) => void;
}

function createInitialState(initialContent: string): PrismState {
  const mainVariant: PrismVariant = {
    id: crypto.randomUUID(),
    label: 'Main',
    blockContent: initialContent,
    source: { kind: 'markdown' },
    pinned: false,
    dirty: false,
  };

  return {
    slots: [mainVariant, null, null],
    modes: ['preview', 'preview', 'preview'],
    codeSubTabs: ['markdown', 'markdown', 'markdown'],
    focusedSlot: 0,
    syncScroll: false,
  };
}

export function usePrismState(
  _intentId: string,
  initialContent: string
): UsePrismStateReturn {
  const [state, setState] = useState<PrismState>(() =>
    createInitialState(initialContent)
  );

  const addVariant = useCallback((variant?: Partial<PrismVariant>) => {
    setState((prev) => {
      // Find the lowest-index null slot (only slots 1 and 2)
      const emptyIndex = prev.slots.findIndex(
        (slot, i) => i > 0 && slot === null
      );
      if (emptyIndex === -1) return prev; // No empty slot available

      const sourceContent = prev.slots[0]!.blockContent;
      const newVariant: PrismVariant = {
        id: crypto.randomUUID(),
        label: `Variant ${emptyIndex + 1}`,
        blockContent: sourceContent,
        source: { kind: 'markdown' },
        pinned: false,
        dirty: false,
        ...variant,
      };

      const newSlots = [...prev.slots];
      newSlots[emptyIndex] = newVariant;

      return { ...prev, slots: newSlots };
    });
  }, []);

  const discardVariant = useCallback((slotIndex: PrismSlotIndex) => {
    if (slotIndex === 0) return; // Refuse to discard slot 0

    setState((prev) => {
      const newSlots = [...prev.slots];
      newSlots[slotIndex] = null;

      // If focused slot was discarded, move focus to slot 0
      const newFocusedSlot =
        prev.focusedSlot === slotIndex ? 0 : prev.focusedSlot;

      return { ...prev, slots: newSlots, focusedSlot: newFocusedSlot as PrismSlotIndex };
    });
  }, []);

  const updateVariantContent = useCallback(
    (slotIndex: PrismSlotIndex, blockContent: string) => {
      setState((prev) => {
        const slot = prev.slots[slotIndex];
        if (!slot) return prev;

        const newSlots = [...prev.slots];
        newSlots[slotIndex] = { ...slot, blockContent, dirty: true };

        return { ...prev, slots: newSlots };
      });
    },
    []
  );

  const setViewMode = useCallback(
    (slotIndex: PrismSlotIndex, mode: PrismViewMode) => {
      setState((prev) => {
        const newModes = [...prev.modes];
        newModes[slotIndex] = mode;
        return { ...prev, modes: newModes };
      });
    },
    []
  );

  const setCodeSubTab = useCallback(
    (slotIndex: PrismSlotIndex, tab: PrismCodeSubTab) => {
      setState((prev) => {
        const newCodeSubTabs = [...prev.codeSubTabs];
        newCodeSubTabs[slotIndex] = tab;
        return { ...prev, codeSubTabs: newCodeSubTabs };
      });
    },
    []
  );

  const setFocus = useCallback((slotIndex: PrismSlotIndex) => {
    setState((prev) => {
      // Only set focus if the slot is not null
      if (!prev.slots[slotIndex]) return prev;
      return { ...prev, focusedSlot: slotIndex };
    });
  }, []);

  const toggleSyncScroll = useCallback(() => {
    setState((prev) => ({ ...prev, syncScroll: !prev.syncScroll }));
  }, []);

  // Stubs for later milestones
  const promoteVariant = useCallback((_slotIndex: PrismSlotIndex) => {
    // No-op: will be implemented in M5
  }, []);

  const pinVariant = useCallback((_slotIndex: PrismSlotIndex) => {
    // No-op: will be implemented in M5
  }, []);

  const addAuraSphereVariants = useCallback(
    (_suggestion: AuraSphereSuggestion) => {
      // No-op: will be implemented in M5
    },
    []
  );

  const updateFromMarkdown = useCallback(
    (_slotIndex: PrismSlotIndex, _markdown: string) => {
      // No-op: will be implemented in M3
    },
    []
  );

  return {
    state,
    addVariant,
    discardVariant,
    promoteVariant,
    updateVariantContent,
    updateFromMarkdown,
    setViewMode,
    setCodeSubTab,
    setFocus,
    toggleSyncScroll,
    pinVariant,
    addAuraSphereVariants,
  };
}
