import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  PrismState,
  PrismVariant,
  PrismSlotIndex,
  PrismViewMode,
  PrismCodeSubTab,
  AuraSphereSuggestion,
  AuraBundle,
  AuraVariantEntry,
} from './types';
import { auraBundleService } from '../../services/auraBundleService';
import { blockToMarkdown } from '../../utils/blockToMarkdown';

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
  saveError: string | null;
  retrySave: () => void;
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

/**
 * Build an AuraBundle from the current PrismState.
 */
function buildBundleFromState(intentId: string, state: PrismState): AuraBundle {
  const now = new Date().toISOString();
  const variants: AuraVariantEntry[] = state.slots
    .filter((slot): slot is PrismVariant => slot !== null)
    .map((variant) => ({
      id: variant.id,
      label: variant.label,
      markdown: blockToMarkdown(variant.blockContent),
      createdBy: variant.promptRef ? 'aurasphere' as const : 'user' as const,
      promptRef: variant.promptRef,
      createdAt: now,
    }));

  return {
    $schema: 'https://wordai.app/schemas/aura/v1.json',
    version: 1,
    intentId,
    canonical: 'markdown',
    markdown: blockToMarkdown(state.slots[0]!.blockContent),
    variants,
    promotedVariantId: null,
    lastModified: now,
  };
}

export function usePrismState(
  intentId: string,
  initialContent: string
): UsePrismStateReturn {
  const [state, setState] = useState<PrismState>(() =>
    createInitialState(initialContent)
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs for debounce and retry logic
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const intentIdRef = useRef<string>(intentId);
  intentIdRef.current = intentId;

  // ---------------------------------------------------------------------------
  // Load bundle on init
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadInitialBundle() {
      const bundle = await auraBundleService.loadBundleAsync(intentId);
      if (cancelled || !bundle) return;

      // Populate state from bundle variants (only active ones)
      const activeVariants = bundle.variants.filter((v) => !v.archivedAt);
      if (activeVariants.length === 0) return;

      setState((prev) => {
        const newSlots: (PrismVariant | null)[] = [null, null, null];

        // Fill slots from active variants (max 3)
        for (let i = 0; i < Math.min(activeVariants.length, 3); i++) {
          const entry = activeVariants[i];
          newSlots[i] = {
            id: entry.id,
            label: entry.label,
            blockContent: entry.markdown, // Store markdown as blockContent for now
            source: { kind: 'aura', bundle },
            promptRef: entry.promptRef,
            pinned: false,
            dirty: false,
          };
        }

        // Ensure slot 0 is never null
        if (!newSlots[0]) {
          newSlots[0] = prev.slots[0];
        }

        return { ...prev, slots: newSlots };
      });
    }

    loadInitialBundle();

    return () => {
      cancelled = true;
    };
  }, [intentId]);

  // ---------------------------------------------------------------------------
  // Save bundle with retry logic
  // ---------------------------------------------------------------------------
  const performSave = useCallback(async (currentState: PrismState) => {
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    const bundle = buildBundleFromState(intentIdRef.current, currentState);

    try {
      await auraBundleService.saveBundle(bundle);
      // Success — reset retry count and clear error
      retryCountRef.current = 0;
      setSaveError(null);
      isSavingRef.current = false;

      // If there was a pending save while we were saving, trigger it
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // Will be triggered by the next debounce cycle
      }
    } catch (error) {
      isSavingRef.current = false;
      retryCountRef.current += 1;

      if (retryCountRef.current < maxRetries) {
        // Retry with exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, retryCountRef.current - 1) * 1000;
        setTimeout(() => {
          performSave(currentState);
        }, backoffMs);
      } else {
        // Max retries reached — set error for toast notification
        const errorMessage = error instanceof Error
          ? error.message
          : 'Lưu variant thất bại. Vui lòng kiểm tra dung lượng ổ đĩa và thử lại.';
        setSaveError(errorMessage);
      }
    }
  }, []);

  // State ref for accessing current state in async callbacks
  const stateRef = useRef<PrismState>(state);
  stateRef.current = state;

  // Save version counter — incremented on each variant mutation to trigger debounced save
  const [saveVersion, setSaveVersion] = useState(0);

  // Debounced save effect using saveVersion state
  useEffect(() => {
    if (saveVersion === 0) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave(stateRef.current);
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [saveVersion, performSave]);

  // Trigger save helper
  const scheduleSave = useCallback(() => {
    setSaveVersion((v) => v + 1);
  }, []);

  // Manual retry function
  const retrySave = useCallback(() => {
    retryCountRef.current = 0;
    setSaveError(null);
    performSave(stateRef.current);
  }, [performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // State mutation actions
  // ---------------------------------------------------------------------------

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
    scheduleSave();
  }, [scheduleSave]);

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
    scheduleSave();
  }, [scheduleSave]);

  const updateVariantContent = useCallback(
    (slotIndex: PrismSlotIndex, blockContent: string) => {
      setState((prev) => {
        const slot = prev.slots[slotIndex];
        if (!slot) return prev;

        const newSlots = [...prev.slots];
        newSlots[slotIndex] = { ...slot, blockContent, dirty: true };

        return { ...prev, slots: newSlots };
      });
      scheduleSave();
    },
    [scheduleSave]
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
    saveError,
    retrySave,
  };
}
