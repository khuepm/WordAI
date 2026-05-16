/**
 * PrismVariantPane — Một cột trong layout Prism, chứa view tabs (Preview/Code)
 * và render EditorCanvas hoặc placeholder Code view tương ứng.
 *
 * Requirements: 2.1, 2.5, 2.6, 7.6
 */

import { useCallback } from 'react';
import type {
  PrismVariant,
  PrismSlotIndex,
  PrismViewMode,
  PrismCodeSubTab,
} from './types';
import { EditorCanvas } from '../EditorCanvas';
import type { Document } from '../../types/document';

export interface PrismVariantPaneProps {
  variant: PrismVariant;
  slotIndex: PrismSlotIndex;
  viewMode: PrismViewMode;
  codeSubTab: PrismCodeSubTab;
  isFocused: boolean;
  syncScroll: boolean;
  onViewModeChange: (mode: PrismViewMode) => void;
  onCodeSubTabChange: (tab: PrismCodeSubTab) => void;
  onFocus: () => void;
  onContentChange: (blockContent: string) => void;
  onMarkdownChange: (markdown: string) => void;
  onDiscard: () => void;
  onPromote: () => void;
  onPin: () => void;
  fontSize?: number;
}

/**
 * PrismVariantPane renders a single variant slot with:
 * - Header: label, pin badge, dirty indicator
 * - Tab bar: Preview | Code (active tab visually distinguished)
 * - Content area: EditorCanvas (Preview) or placeholder (Code)
 * - Action buttons: Discard, Promote, Pin/Unpin
 *
 * Defaults to Preview mode on first mount (Req 2.6).
 * Code view is a placeholder — will be implemented in task 5.5+.
 */
export function PrismVariantPane({
  variant,
  slotIndex,
  viewMode,
  codeSubTab: _codeSubTab,
  isFocused,
  syncScroll: _syncScroll,
  onViewModeChange,
  onCodeSubTabChange: _onCodeSubTabChange,
  onFocus,
  onContentChange,
  onMarkdownChange: _onMarkdownChange,
  onDiscard,
  onPromote,
  onPin,
  fontSize,
}: PrismVariantPaneProps) {
  // Build a minimal Document object for EditorCanvas from variant.blockContent
  const variantDocument: Document = {
    id: variant.id,
    title: variant.label,
    content: variant.blockContent,
    lastModified: new Date(),
    version: 1,
    metadata: {
      wordCount: 0,
      readingTime: 0,
      status: 'draft',
      tags: [],
    },
  };

  const handleDocumentChange = useCallback(
    (doc: Document) => {
      onContentChange(doc.content);
    },
    [onContentChange]
  );

  // No-op handlers for EditorCanvas props not relevant in variant pane context
  const handleAITrigger = useCallback(() => { }, []);

  const handleTabClick = useCallback(
    (mode: PrismViewMode) => {
      onViewModeChange(mode);
    },
    [onViewModeChange]
  );

  return (
    <div
      className="prism-variant-pane"
      data-slot-index={slotIndex}
      data-focused={isFocused}
      onClick={onFocus}
      style={styles.container}
      role="region"
      aria-label={`Variant pane: ${variant.label}`}
    >
      {/* Header: label, pin badge, dirty indicator */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.label}>{variant.label}</span>
          {variant.pinned && (
            <span
              style={styles.pinBadge}
              aria-label="Pinned"
              title="Pinned"
            >
              📌
            </span>
          )}
          {variant.dirty && (
            <span
              style={styles.dirtyIndicator}
              aria-label="Unsaved changes"
              title="Unsaved changes"
            >
              ●
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={styles.headerRight}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            disabled={slotIndex === 0}
            style={{
              ...styles.actionButton,
              ...(slotIndex === 0 ? styles.actionButtonDisabled : {}),
            }}
            aria-label="Discard variant"
            title={slotIndex === 0 ? 'Cannot discard main variant' : 'Discard variant'}
          >
            Discard
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPromote();
            }}
            style={styles.actionButton}
            aria-label="Promote variant"
            title="Promote variant to main"
          >
            Promote
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            style={styles.actionButton}
            aria-label={variant.pinned ? 'Unpin variant' : 'Pin variant'}
            title={variant.pinned ? 'Unpin variant' : 'Pin variant'}
          >
            {variant.pinned ? 'Unpin' : 'Pin'}
          </button>
        </div>
      </div>

      {/* Tab bar: Preview | Code (Req 2.1) */}
      <div style={styles.tabBar} role="tablist" aria-label="View mode tabs">
        <button
          role="tab"
          aria-selected={viewMode === 'preview'}
          onClick={() => handleTabClick('preview')}
          style={{
            ...styles.tab,
            ...(viewMode === 'preview' ? styles.tabActive : {}),
          }}
        >
          Preview
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'code'}
          onClick={() => handleTabClick('code')}
          style={{
            ...styles.tab,
            ...(viewMode === 'code' ? styles.tabActive : {}),
          }}
        >
          Code
        </button>
      </div>

      {/* Content area */}
      <div style={styles.content}>
        {viewMode === 'preview' ? (
          <EditorCanvas
            document={variantDocument}
            onDocumentChange={handleDocumentChange}
            onAITrigger={handleAITrigger}
            isAIPanelOpen={false}
            fontSize={fontSize}
          />
        ) : (
          /* Code view placeholder — will be replaced by PrismCodeView in task 5.5+ */
          <div style={styles.codePlaceholder}>
            <p style={styles.codePlaceholderText}>
              Code view will be available soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderRight: '1px solid var(--md-sys-color-outline-variant)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
    backgroundColor: 'var(--md-sys-color-surface-container-low)',
    minHeight: '2.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  label: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
  },
  pinBadge: {
    fontSize: '0.75rem',
  },
  dirtyIndicator: {
    color: 'var(--md-sys-color-primary)',
    fontSize: '0.6rem',
  },
  actionButton: {
    background: 'none',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: '4px',
    padding: '0.25rem 0.5rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.7rem',
    color: 'var(--md-sys-color-on-surface-variant)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  actionButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  tabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
    backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
  },
  tab: {
    flex: 1,
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'none',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.8rem',
    color: 'var(--md-sys-color-on-surface-variant)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
    textAlign: 'center' as const,
  },
  tabActive: {
    color: 'var(--md-sys-color-primary)',
    borderBottomColor: 'var(--md-sys-color-primary)',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  codePlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '2rem',
    backgroundColor: 'var(--md-sys-color-surface-container)',
  },
  codePlaceholderText: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.875rem',
    color: 'var(--md-sys-color-on-surface-variant)',
    opacity: 0.6,
  },
};

export default PrismVariantPane;
