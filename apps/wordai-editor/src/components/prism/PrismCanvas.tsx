/**
 * PrismCanvas — Root component cho Prism Multi-Variant Editor.
 * Thay thế EditorCanvas trực tiếp trong App.tsx, quản lý layout đa cột
 * và dispatch các action chính (add/discard/promote variant).
 *
 * Requirements: 1.1, 1.3
 */

import { useEffect } from 'react';
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

  // Số cột active dựa trên slots không null
  const activeSlotCount = state.slots.filter(Boolean).length;

  return (
    <div
      className="prism-canvas"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${activeSlotCount}, 1fr)`,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Slot 0 — variant chính, luôn tồn tại (Req 1.3) */}
      {state.slots[0] && (
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
      )}
    </div>
  );
}

export default PrismCanvas;
