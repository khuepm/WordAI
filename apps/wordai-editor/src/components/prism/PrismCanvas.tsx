/**
 * PrismCanvas — Root component cho Prism Multi-Variant Editor.
 * Thay thế EditorCanvas trực tiếp trong App.tsx, quản lý layout đa cột
 * và dispatch các action chính (add/discard/promote variant).
 *
 * Requirements: 1.1, 1.3, 7.9, 8.1, 8.7, 10.9, 11.4, 11.5
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { Document, TextSelection } from '../../types/document';
import type { IPCError } from '../../types/ipc';
import type { AuraSphereSuggestion, PrismSlotIndex } from './types';
import { usePrismState } from './usePrismState';
import { useSyncScroll } from './useSyncScroll';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { PrismToolbar } from './PrismToolbar';
import { PrismVariantPane } from './PrismVariantPane';
import { markdownToBlock } from '../../utils/markdownToBlock';

export interface PrismCanvasProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
  onAITrigger: (selection: TextSelection) => void;
  isAIPanelOpen: boolean;
  saveError?: IPCError | null;
  hasUnsavedChanges?: boolean;
  onManualSave?: () => void;
  onOpenExport?: () => void;
  onOpenVersionHistory?: () => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  auraSuggestion?: AuraSphereSuggestion | null;
}

/**
 * CSS transition duration for layout shift.
 * Requirement 11.5: layout shift must complete within 50ms.
 */
const LAYOUT_TRANSITION_MS = 40;

/** Toast auto-dismiss duration in ms (Req 10.9) */
const TOAST_DURATION_MS = 5000;

export function PrismCanvas({
  document,
  onDocumentChange,
  onAITrigger,
  isAIPanelOpen: _isAIPanelOpen,
  saveError: _saveError,
  hasUnsavedChanges: _hasUnsavedChanges,
  onManualSave: _onManualSave,
  onOpenExport: _onOpenExport,
  onOpenVersionHistory: _onOpenVersionHistory,
  fontSize,
  onFontSizeChange: _onFontSizeChange,
  auraSuggestion,
}: PrismCanvasProps) {
  const {
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
  } = usePrismState(document.id, document.content);

  // Sync scroll hook (Req 9.1, 9.2, 9.4, 9.5)
  const { registerPane, handlePaneScroll } = useSyncScroll({
    syncScroll: state.syncScroll,
    focusedSlot: state.focusedSlot,
    activePaneCount: state.slots.filter(Boolean).length,
  });

  // Keyboard shortcuts (Req 11.1): Cmd+1/2/3 to switch focus, Cmd+Enter to add variant
  useKeyboardShortcuts({ state, setFocus, addVariant });

  // Toast state for AuraSphere parse failure notification (Req 10.9)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the previous auraSuggestion to detect new suggestions
  const prevSuggestionRef = useRef<AuraSphereSuggestion | null | undefined>(undefined);

  // Show toast with auto-dismiss after 5 seconds
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Khi nhận suggestion từ AuraSphere, phân phối vào slots trống (Req 8.1)
  // After calling addAuraSphereVariants, check if variants were placed.
  // If all variants parse failed (none placed), show toast (Req 10.9)
  useEffect(() => {
    if (auraSuggestion && auraSuggestion !== prevSuggestionRef.current) {
      addAuraSphereVariants(auraSuggestion);

      // Check if any variants could be parsed by examining the suggestion
      // The addAuraSphereVariants function internally validates and skips invalid variants.
      // If the suggestion had variants but none were valid (all parse failed),
      // we need to show a toast.
      const hasValidVariants = auraSuggestion.variants.some((sv) => {
        if (!sv.label || !sv.label.trim()) return false;
        if (!sv.markdown || !sv.markdown.trim()) return false;
        // Try to parse markdown to check validity
        try {
          markdownToBlock(sv.markdown);
          return true;
        } catch {
          return false;
        }
      });

      if (!hasValidVariants && auraSuggestion.variants.length > 0) {
        // All variants parse failed — show toast (Req 10.9)
        showToast(
          'Không thể áp dụng suggestion từ AuraSphere do lỗi parse.'
        );
      }
    }
    prevSuggestionRef.current = auraSuggestion;
  }, [auraSuggestion, addAuraSphereVariants, showToast]);

  // Số cột active dựa trên slots không null (Req 1.1)
  const activeSlotCount = state.slots.filter(Boolean).length;

  // Disable Promote when only 1 variant active (Req 7.9)
  const disablePromote = activeSlotCount <= 1;

  // Grid container style with CSS transition for smooth layout shift (Req 11.4, 11.5)
  const gridStyle = useMemo(
    () => ({
      display: 'grid' as const,
      gridTemplateColumns: `repeat(${activeSlotCount}, 1fr)`,
      width: '100%',
      flex: 1,
      overflow: 'hidden' as const,
      transition: `grid-template-columns ${LAYOUT_TRANSITION_MS}ms ease-in-out`,
    }),
    [activeSlotCount]
  );

  return (
    <div
      className="prism-canvas"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* PrismToolbar above the grid (Req 1.5, 9.3) */}
      <PrismToolbar
        variantCount={activeSlotCount}
        maxVariants={3}
        syncScroll={state.syncScroll}
        onAddVariant={addVariant}
        onToggleSyncScroll={toggleSyncScroll}
      />

      {/* Multi-slot grid layout */}
      <div style={gridStyle}>
        {state.slots.map((variant, index) =>
          variant ? (
            <PrismVariantPane
              key={variant.id}
              variant={variant}
              slotIndex={index as PrismSlotIndex}
              viewMode={state.modes[index]}
              codeSubTab={state.codeSubTabs[index]}
              isFocused={state.focusedSlot === index}
              syncScroll={state.syncScroll}
              onViewModeChange={(mode) =>
                setViewMode(index as PrismSlotIndex, mode)
              }
              onCodeSubTabChange={(tab) =>
                setCodeSubTab(index as PrismSlotIndex, tab)
              }
              onFocus={() => setFocus(index as PrismSlotIndex)}
              onContentChange={(content) => {
                updateVariantContent(index as PrismSlotIndex, content);
                // Propagate slot 0 changes to parent document
                if (index === 0) {
                  onDocumentChange({ ...document, content });
                }
              }}
              onMarkdownChange={(md) =>
                updateFromMarkdown(index as PrismSlotIndex, md)
              }
              onDiscard={() => discardVariant(index as PrismSlotIndex)}
              onPromote={() => promoteVariant(index as PrismSlotIndex)}
              onPin={() => pinVariant(index as PrismSlotIndex)}
              disablePromote={disablePromote}
              fontSize={fontSize}
              registerScrollPane={registerPane}
              onPaneScroll={handlePaneScroll}
            />
          ) : null
        )}
      </div>

      {/* Toast notification for AuraSphere parse failure (Req 10.9) */}
      {toastMessage && (
        <div
          className="prism-canvas__toast"
          role="alert"
          aria-live="polite"
          style={toastStyles.container}
        >
          <span style={toastStyles.message}>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={toastStyles.dismissButton}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: 'var(--md-sys-color-error-container, #fce4ec)',
    color: 'var(--md-sys-color-on-error-container, #b71c1c)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.875rem',
    zIndex: 9999,
    maxWidth: '90vw',
  },
  message: {
    flex: 1,
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
    lineHeight: 1,
  },
};

export default PrismCanvas;
