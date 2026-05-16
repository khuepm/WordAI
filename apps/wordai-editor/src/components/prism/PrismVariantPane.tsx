/**
 * PrismVariantPane — Một cột trong layout Prism, chứa view tabs (Preview/Code)
 * và render EditorCanvas hoặc PrismCodeView tương ứng.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.6, 4.1, 4.2, 4.3, 4.8, 7.6, 11.2
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import type {
  PrismVariant,
  PrismSlotIndex,
  PrismViewMode,
  PrismCodeSubTab,
  PrismSourceFormat,
} from './types';
import { EditorCanvas } from '../EditorCanvas';
import { PrismCodeView } from './PrismCodeView';
import { blockToMarkdown } from '../../utils/blockToMarkdown';
import { markdownToBlock, ParseError } from '../../utils/markdownToBlock';
import type { Document } from '../../types/document';

/**
 * Returns the available sub-tabs based on the variant's source format (Req 3.1).
 * - markdown source → only "Markdown"
 * - html source → only "HTML"
 * - docx source → only "OOXML"
 * - aura source → "Markdown" + ".aura"
 */
export function getAvailableSubTabs(source: PrismSourceFormat): PrismCodeSubTab[] {
  switch (source.kind) {
    case 'markdown':
      return ['markdown'];
    case 'html':
      return ['html'];
    case 'docx':
      return ['ooxml'];
    case 'aura':
      return ['markdown', 'aura'];
    default:
      return ['markdown'];
  }
}

/**
 * Returns a display label for a sub-tab.
 */
function getSubTabLabel(tab: PrismCodeSubTab): string {
  switch (tab) {
    case 'markdown':
      return 'Markdown';
    case 'html':
      return 'HTML';
    case 'ooxml':
      return 'OOXML';
    case 'aura':
      return '.aura';
    default:
      return tab;
  }
}

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
  /** Disable Promote button when only 1 variant active (Req 7.9) */
  disablePromote?: boolean;
  fontSize?: number;
  /** Register the scrollable container for sync scroll (Req 9.1) */
  registerScrollPane?: (slotIndex: number, element: HTMLElement | null) => void;
  /** Notify parent that this pane was scrolled (Req 9.1) */
  onPaneScroll?: (slotIndex: number) => void;
}

/**
 * Polyfill for requestIdleCallback (not available in all environments).
 * Falls back to setTimeout with 1ms delay.
 */
const scheduleIdle: (cb: () => void) => number =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => window.requestIdleCallback(cb)
    : (cb) => window.setTimeout(cb, 1) as unknown as number;

const cancelIdle: (id: number) => void =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? (id) => window.cancelIdleCallback(id)
    : (id) => window.clearTimeout(id);

/**
 * PrismVariantPane renders a single variant slot with:
 * - Header: label, pin badge, dirty indicator
 * - Tab bar: Preview | Code (active tab visually distinguished)
 * - Content area: EditorCanvas (Preview) or PrismCodeView (Code)
 * - Action buttons: Discard, Promote, Pin/Unpin
 *
 * View toggle logic (Req 2.2, 2.3, 4.1, 4.2, 4.3, 4.8, 11.2):
 * - When switching to Code: blockToMarkdown(variant.blockContent) → PrismCodeView
 * - When PrismCodeView emits onChange: markdownToBlock → onContentChange
 * - Debounce 500ms for Code→Preview direction (PrismCodeView already debounces internally)
 * - requestIdleCallback to avoid blocking main thread
 * - ParseError → keep old blockContent, set parseError state
 * - Cancel pending transforms on new edits (Req 4.8)
 *
 * Defaults to Preview mode on first mount (Req 2.6).
 */
export function PrismVariantPane({
  variant,
  slotIndex,
  viewMode,
  codeSubTab,
  isFocused,
  syncScroll: _syncScroll,
  onViewModeChange,
  onCodeSubTabChange,
  onFocus,
  onContentChange,
  onMarkdownChange,
  onDiscard,
  onPromote,
  onPin,
  disablePromote = false,
  fontSize,
  registerScrollPane,
  onPaneScroll,
}: PrismVariantPaneProps) {
  // Local markdown state — kept in sync with blockContent via transforms
  const [localMarkdown, setLocalMarkdown] = useState<string>(() =>
    blockToMarkdown(variant.blockContent)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Store scroll percentage per view mode so we can restore on toggle (Req 2.4)
  // Key: 'preview' | 'code', Value: scroll percentage (0-1)
  const scrollPercentRef = useRef<Record<PrismViewMode, number>>({
    preview: 0,
    code: 0,
  });

  // Refs for debounce/idle cancellation (Req 4.8)
  const previewToCodeTimerRef = useRef<number | null>(null);
  const previewToCodeIdleRef = useRef<number | null>(null);
  const codeToPreviewTimerRef = useRef<number | null>(null);
  const codeToPreviewIdleRef = useRef<number | null>(null);

  // Track whether the last blockContent change came from code→preview transform
  // to avoid circular updates
  const isInternalBlockUpdateRef = useRef(false);

  // Ref callback for the scrollable content container (Req 9.1, 9.4)
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (registerScrollPane) {
        registerScrollPane(slotIndex, node);
      }
    },
    [registerScrollPane, slotIndex]
  );

  // Handle scroll events on the content container (Req 9.1)
  const handleContentScroll = useCallback(() => {
    if (onPaneScroll) {
      onPaneScroll(slotIndex);
    }
  }, [onPaneScroll, slotIndex]);

  // Sync markdown when blockContent changes from Preview edits (Req 4.1)
  // Debounce 500ms + requestIdleCallback
  useEffect(() => {
    // Skip if this update originated from our own code→preview transform
    if (isInternalBlockUpdateRef.current) {
      isInternalBlockUpdateRef.current = false;
      return;
    }

    // Only sync when in code view mode — otherwise markdown will be computed on tab switch
    if (viewMode !== 'code') return;

    // Cancel any pending preview→code transform (Req 4.8)
    if (previewToCodeTimerRef.current !== null) {
      clearTimeout(previewToCodeTimerRef.current);
      previewToCodeTimerRef.current = null;
    }
    if (previewToCodeIdleRef.current !== null) {
      cancelIdle(previewToCodeIdleRef.current);
      previewToCodeIdleRef.current = null;
    }

    // Debounce 500ms (Req 4.1)
    previewToCodeTimerRef.current = window.setTimeout(() => {
      // Use requestIdleCallback to not block main thread (Req 11.2, 4.3)
      previewToCodeIdleRef.current = scheduleIdle(() => {
        const md = blockToMarkdown(variant.blockContent);
        setLocalMarkdown(md);
        onMarkdownChange(md);
        previewToCodeIdleRef.current = null;
      });
      previewToCodeTimerRef.current = null;
    }, 500);

    return () => {
      if (previewToCodeTimerRef.current !== null) {
        clearTimeout(previewToCodeTimerRef.current);
        previewToCodeTimerRef.current = null;
      }
      if (previewToCodeIdleRef.current !== null) {
        cancelIdle(previewToCodeIdleRef.current);
        previewToCodeIdleRef.current = null;
      }
    };
  }, [variant.blockContent, viewMode, onMarkdownChange]);

  // When switching to Code view, immediately compute markdown from current blockContent
  const handleTabClick = useCallback(
    (mode: PrismViewMode) => {
      if (mode === viewMode) return; // no-op if same mode

      // Save current scroll percentage before switching (Req 2.4)
      const container = contentRef.current;
      if (container) {
        const scrollableHeight = container.scrollHeight - container.clientHeight;
        const percent = scrollableHeight > 0 ? container.scrollTop / scrollableHeight : 0;
        scrollPercentRef.current[viewMode] = percent;
      }

      if (mode === 'code' && viewMode !== 'code') {
        // Switching to Code: compute markdown immediately (Req 2.3)
        const md = blockToMarkdown(variant.blockContent);
        setLocalMarkdown(md);
        setParseError(null);
      }
      onViewModeChange(mode);
    },
    [onViewModeChange, viewMode, variant.blockContent]
  );

  // Restore scroll position after view mode changes (Req 2.4)
  useEffect(() => {
    const savedPercent = scrollPercentRef.current[viewMode];
    if (savedPercent === 0) return; // nothing to restore

    // Use requestAnimationFrame to ensure DOM has rendered the new view
    const rafId = requestAnimationFrame(() => {
      const container = contentRef.current;
      if (container) {
        const scrollableHeight = container.scrollHeight - container.clientHeight;
        if (scrollableHeight > 0) {
          container.scrollTop = savedPercent * scrollableHeight;
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [viewMode]);

  // Handle onChange from PrismCodeView (already debounced 500ms internally by PrismCodeView)
  // Convert markdown → blockContent using requestIdleCallback (Req 4.2, 4.3, 11.2)
  const handleCodeChange = useCallback(
    (newMarkdown: string) => {
      // Update local markdown state immediately for responsive UI
      setLocalMarkdown(newMarkdown);
      onMarkdownChange(newMarkdown);

      // Cancel any pending code→preview transform (Req 4.8)
      if (codeToPreviewTimerRef.current !== null) {
        clearTimeout(codeToPreviewTimerRef.current);
        codeToPreviewTimerRef.current = null;
      }
      if (codeToPreviewIdleRef.current !== null) {
        cancelIdle(codeToPreviewIdleRef.current);
        codeToPreviewIdleRef.current = null;
      }

      // Use requestIdleCallback to parse markdown → blocks (Req 11.2, 4.3)
      codeToPreviewIdleRef.current = scheduleIdle(() => {
        try {
          const blockContent = markdownToBlock(newMarkdown);
          setParseError(null);
          // Mark as internal update to prevent circular sync
          isInternalBlockUpdateRef.current = true;
          onContentChange(blockContent);
        } catch (error) {
          if (error instanceof ParseError) {
            // Keep old blockContent, set parseError state (Req 4.7, 10.2)
            setParseError(`Parse error at line ${error.line}: ${error.message}`);
          } else {
            setParseError('Unknown parse error');
          }
        }
        codeToPreviewIdleRef.current = null;
      });
    },
    [onContentChange, onMarkdownChange]
  );

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (previewToCodeTimerRef.current !== null) clearTimeout(previewToCodeTimerRef.current);
      if (previewToCodeIdleRef.current !== null) cancelIdle(previewToCodeIdleRef.current);
      if (codeToPreviewTimerRef.current !== null) clearTimeout(codeToPreviewTimerRef.current);
      if (codeToPreviewIdleRef.current !== null) cancelIdle(codeToPreviewIdleRef.current);
      // Unregister scroll pane on unmount (Req 9.1)
      if (registerScrollPane) {
        registerScrollPane(slotIndex, null);
      }
    };
  }, [registerScrollPane, slotIndex]);

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
            disabled={disablePromote}
            style={{
              ...styles.actionButton,
              ...(disablePromote ? styles.actionButtonDisabled : {}),
            }}
            aria-label="Promote variant"
            title={disablePromote ? 'Cần ít nhất 2 variant để promote' : 'Promote variant to main'}
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

      {/* Sub-tab bar: shown only in Code view, tabs based on source format (Req 3.1, 3.6) */}
      {viewMode === 'code' && (() => {
        const availableTabs = getAvailableSubTabs(variant.source);
        // Only show sub-tab bar if there are multiple sub-tabs
        if (availableTabs.length <= 1) return null;
        return (
          <div
            style={styles.subTabBar}
            role="tablist"
            aria-label="Code format sub-tabs"
          >
            {availableTabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={codeSubTab === tab}
                onClick={(e) => {
                  e.stopPropagation();
                  onCodeSubTabChange(tab);
                }}
                style={{
                  ...styles.subTab,
                  ...(codeSubTab === tab ? styles.subTabActive : {}),
                }}
              >
                {getSubTabLabel(tab)}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Content area */}
      <div style={styles.content} ref={scrollContentRefCallback} onScroll={handleContentScroll}>
        {viewMode === 'preview' ? (
          <EditorCanvas
            document={variantDocument}
            onDocumentChange={handleDocumentChange}
            onAITrigger={handleAITrigger}
            isAIPanelOpen={false}
            fontSize={fontSize}
          />
        ) : (
          <PrismCodeView
            content={
              codeSubTab === 'aura'
                ? variant.source.kind === 'aura'
                  ? JSON.stringify(variant.source.bundle, null, 2)
                  : '{}'
                : localMarkdown
            }
            subTab={codeSubTab}
            readonly={false}
            onChange={handleCodeChange}
            fontSize={fontSize}
            parseError={parseError}
          />
        )}
      </div>

      {/* Parse error indicator (visible when Code view has parse errors) */}
      {parseError && viewMode === 'code' && (
        <div style={styles.parseErrorBanner} role="alert" aria-live="polite">
          {parseError}
        </div>
      )}
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
  subTabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
    backgroundColor: 'var(--md-sys-color-surface-container)',
    paddingLeft: '0.5rem',
  },
  subTab: {
    padding: '0.35rem 0.75rem',
    border: 'none',
    background: 'none',
    fontFamily: 'var(--font-family-mono, "JetBrains Mono", "Fira Code", monospace)',
    fontSize: '0.7rem',
    color: 'var(--md-sys-color-on-surface-variant)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
  },
  subTabActive: {
    color: 'var(--md-sys-color-primary)',
    borderBottomColor: 'var(--md-sys-color-primary)',
    fontWeight: 600,
    backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  parseErrorBanner: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--md-sys-color-error-container, #fce4ec)',
    color: 'var(--md-sys-color-on-error-container, #b71c1c)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    borderTop: '1px solid var(--md-sys-color-error, #d32f2f)',
  },
};

export default PrismVariantPane;
