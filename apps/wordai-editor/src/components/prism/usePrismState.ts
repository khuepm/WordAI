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
import { markdownToBlock } from '../../utils/markdownToBlock';

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

  const promoteVariant = useCallback((slotIndex: PrismSlotIndex) => {
    setState((prev) => {
      const variant = prev.slots[slotIndex];
      if (!variant) return prev; // Cannot promote null slot

      const now = new Date().toISOString();
      const promotedMarkdown = blockToMarkdown(variant.blockContent);

      // Build new slots: slot 0 = promoted variant, keep pinned, clear others
      const newSlots: (PrismVariant | null)[] = [variant, null, null];

      // Preserve pinned variants in their original slots (except the promoted one)
      for (let i = 0; i < 3; i++) {
        const slot = prev.slots[i];
        if (slot && slot.id !== variant.id && slot.pinned) {
          newSlots[i] = slot;
        }
      }

      // Build the bundle with archived variants
      // First, load existing bundle to preserve previously archived entries
      const existingBundle = auraBundleService.loadBundle(intentIdRef.current);
      const existingVariants: AuraVariantEntry[] = existingBundle?.variants ?? [];

      // Collect IDs of pinned variants (they should NOT be archived)
      const pinnedIds = new Set(
        prev.slots
          .filter((s): s is PrismVariant => s !== null && s.pinned)
          .map((s) => s.id)
      );

      // Update existing bundle variants: archive non-pinned, non-promoted active variants
      const updatedExistingVariants = existingVariants.map((v) => {
        if (v.id === variant.id) return v; // promoted variant stays as-is
        if (pinnedIds.has(v.id)) return v; // pinned variants stay as-is
        if (v.archivedAt) return v; // already archived, don't change archivedAt
        return { ...v, archivedAt: now }; // archive it
      });

      // Ensure the promoted variant is in the variants list
      const promotedInList = updatedExistingVariants.some((v) => v.id === variant.id);
      const finalVariants: AuraVariantEntry[] = promotedInList
        ? updatedExistingVariants
        : [
            {
              id: variant.id,
              label: variant.label,
              markdown: promotedMarkdown,
              createdBy: variant.promptRef ? 'aurasphere' as const : 'user' as const,
              promptRef: variant.promptRef,
              createdAt: now,
            },
            ...updatedExistingVariants,
          ];

      // Also add any active slot variants that weren't in the existing bundle
      for (const slot of prev.slots) {
        if (slot && slot.id !== variant.id && !finalVariants.some((v) => v.id === slot.id)) {
          const entry: AuraVariantEntry = {
            id: slot.id,
            label: slot.label,
            markdown: blockToMarkdown(slot.blockContent),
            createdBy: slot.promptRef ? 'aurasphere' as const : 'user' as const,
            promptRef: slot.promptRef,
            createdAt: now,
            ...(slot.pinned ? {} : { archivedAt: now }),
          };
          finalVariants.push(entry);
        }
      }

      // Build and save the bundle directly
      const newBundle: AuraBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: intentIdRef.current,
        canonical: 'markdown',
        markdown: promotedMarkdown,
        variants: finalVariants,
        promotedVariantId: variant.id,
        lastModified: now,
      };

      // Save bundle asynchronously (fire-and-forget within setState)
      auraBundleService.saveBundle(newBundle).catch(() => {
        // Error will be handled by retry logic on next scheduled save
      });

      return {
        ...prev,
        slots: newSlots,
        modes: ['preview', 'preview', 'preview'] as PrismViewMode[],
        codeSubTabs: ['markdown', 'markdown', 'markdown'] as PrismCodeSubTab[],
        focusedSlot: 0 as PrismSlotIndex,
      };
    });
  }, []);

  const pinVariant = useCallback((slotIndex: PrismSlotIndex) => {
    setState((prev) => {
      const slot = prev.slots[slotIndex];
      if (!slot) return prev;

      const newSlots = [...prev.slots];
      newSlots[slotIndex] = { ...slot, pinned: !slot.pinned };

      return { ...prev, slots: newSlots };
    });
    scheduleSave();
  }, [scheduleSave]);

  const addAuraSphereVariants = useCallback(
    (suggestion: AuraSphereSuggestion) => {
      // Validate and filter suggestion variants: label must be non-empty, markdown must parse
      const validVariants: { label: string; markdown: string; promptRef: string; blockContent: string }[] = [];
      for (const sv of suggestion.variants) {
        // Skip variant with empty label
        if (!sv.label || !sv.label.trim()) continue;
        // Skip variant with empty markdown
        if (!sv.markdown || !sv.markdown.trim()) continue;
        // Attempt to parse markdown — skip if it fails
        try {
          const blockContent = markdownToBlock(sv.markdown);
          validVariants.push({
            label: sv.label,
            markdown: sv.markdown,
            promptRef: sv.promptRef,
            blockContent,
          });
        } catch {
          // Invalid markdown — skip this variant, continue with the rest
          continue;
        }
      }

      if (validVariants.length === 0) return;

      setState((prev) => {
        const newSlots = [...prev.slots] as (PrismVariant | null)[];
        let suggestionIndex = 0;

        for (let i = 0; i < 3 && suggestionIndex < validVariants.length; i++) {
          const slot = newSlots[i];

          // Skip slot 0 if it has content (preserve user's content)
          if (i === 0 && slot !== null) continue;
          // Skip pinned slots
          if (slot?.pinned) continue;
          // Skip dirty slots (unsaved changes)
          if (slot?.dirty) continue;

          const sv = validVariants[suggestionIndex];
          newSlots[i] = {
            id: crypto.randomUUID(),
            label: sv.label,
            blockContent: sv.blockContent,
            source: { kind: 'markdown' },
            promptRef: sv.promptRef,
            pinned: false,
            dirty: false,
          };
          suggestionIndex++;
        }

        return { ...prev, slots: newSlots };
      });
      scheduleSave();
    },
    [scheduleSave]
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
