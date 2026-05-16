/**
 * PrismCanvas — Root component cho Prism Multi-Variant Editor.
 * Thay thế EditorCanvas trực tiếp trong App.tsx, quản lý layout đa cột
 * và dispatch các action chính (add/discard/promote variant).
 *
 * Requirements: 1.1, 1.3, 11.4, 11.5
 */

import { useEffect, useMemo } from 'react';
import type { Document, TextSelection } from '../../types/document';
import type { IPCError } from '../../types/ipc';
import type { AuraSphereSuggestion } from './types';
import { usePrismState } from './usePrismState';
import { EditorCanvas } from '../EditorCanvas';

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

export function PrismCanvas({
  document,
  onDocumentChange,
  onAITrigger,
  isAIPanelOpen,
  saveError,
  hasUnsavedChanges,
  onManualSave,
  onOpenExport,
  onOpenVersionHistory,
  fontSize,
  onFontSizeChange,
  auraSuggestion,
}: PrismCanvasProps) {
  const { state, addAuraSphereVariants } = usePrismState(document.id, document.content);

  // Khi nhận suggestion từ AuraSphere, phân phối vào slots trống
  useEffect(() => {
    if (auraSuggestion) {
      addAuraSphereVariants(auraSuggestion);
    }
  }, [auraSuggestion, addAuraSphereVariants]);

  // Số cột active dựa trên slots không null (Req 1.1)
  const activeSlotCount = state.slots.filter(Boolean).length;

  // Grid container style with CSS transition for smooth layout shift (Req 11.4, 11.5)
  const gridStyle = useMemo(
    () => ({
      display: 'grid' as const,
      gridTemplateColumns: `repeat(${activeSlotCount}, 1fr)`,
      width: '100%',
      height: '100%',
      overflow: 'hidden' as const,
      transition: `grid-template-columns ${LAYOUT_TRANSITION_MS}ms ease-in-out`,
    }),
    [activeSlotCount]
  );

  return (
    <div className="prism-canvas" style={gridStyle}>
      {/*
       * Render all non-null slots. Use variant.id as React key to ensure
       * EditorCanvas instances are NOT unmounted/remounted when adding or
       * removing variants — only the grid layout shifts (Req 11.4).
       */}
      {state.slots.map((variant, index) =>
        variant ? (
          <div
            key={variant.id}
            className="prism-canvas__slot"
            style={{ overflow: 'hidden', minWidth: 0 }}
            data-slot-index={index}
          >
            <EditorCanvas
              document={document}
              onDocumentChange={onDocumentChange}
              onAITrigger={onAITrigger}
              isAIPanelOpen={isAIPanelOpen}
              saveError={saveError}
              hasUnsavedChanges={hasUnsavedChanges}
              onManualSave={onManualSave}
              onOpenExport={onOpenExport}
              onOpenVersionHistory={onOpenVersionHistory}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
            />
          </div>
        ) : null
      )}
    </div>
  );
}

export default PrismCanvas;
