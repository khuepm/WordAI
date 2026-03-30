/**
 * EditorCanvas - Main writing surface component
 * Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 19.1, 19.3, 19.4, 21.5, 2.5, 17.2, 17.3
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import '../utils/reactInternals';
import ReactBlockText, { headerPlugin, listPlugin, quotePlugin, todoPlugin } from 'react-block-text';
import type { Document, TextSelection } from '../types/document';
import type { IPCError } from '../types/ipc';
import { ensureBlockValue, extractPlainText } from '../utils/blockText';

/** Returns a human-readable relative time string (Req 4.4) */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  // Fall back to a readable date for older timestamps
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface EditorCanvasProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
  onAITrigger: (selection: TextSelection) => void;
  isAIPanelOpen: boolean;
  saveError?: IPCError | null;
  hasUnsavedChanges?: boolean;
  /** Called when user presses Cmd+S — parent should trigger immediate save (Req 21.2) */
  onManualSave?: () => void;
  /** Called when user presses Cmd+E — parent should open RenderDrawer (Req 21.3) */
  onOpenExport?: () => void;
  /** Called when user presses Cmd+H — parent should open VersionHistory (Req 22.5) */
  onOpenVersionHistory?: () => void;
  /** Font size in px for the editor textarea (Req 19.5) */
  fontSize?: number;
  /** Called when font size changes (Req 19.5) */
  onFontSizeChange?: (size: number) => void;
}

export function EditorCanvas({
  document,
  onDocumentChange,
  onAITrigger,
  isAIPanelOpen,
  saveError = null,
  hasUnsavedChanges = false,
  onManualSave,
  onOpenExport,
  onOpenVersionHistory,
  fontSize: fontSizeProp = 18,
  onFontSizeChange,
}: EditorCanvasProps) {
  const [fontSize, setFontSize] = useState(fontSizeProp);
  const [blockValue, setBlockValue] = useState(() => ensureBlockValue(document.content));

  useEffect(() => {
    setBlockValue(ensureBlockValue(document.content));
  }, [document.content, document.id]);

  const handleDecreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(12, prev - 1);
      onFontSizeChange?.(next);
      return next;
    });
  }, [onFontSizeChange]);

  const handleIncreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(28, prev + 1);
      onFontSizeChange?.(next);
      return next;
    });
  }, [onFontSizeChange]);

  const plugins = useMemo(
    () => [...headerPlugin(), ...todoPlugin(), ...listPlugin(), ...quotePlugin()],
    []
  );

  const plainText = useMemo(() => extractPlainText(blockValue), [blockValue]);

  const wordCount = useMemo(
    () => plainText.trim().split(/\s+/).filter(Boolean).length,
    [plainText]
  );
  const readingTime = useMemo(() => Math.ceil(wordCount / 200), [wordCount]);

  // Relative timestamp that refreshes every 30 s (Req 4.3, 4.4)
  const [relativeTime, setRelativeTime] = useState(() =>
    formatRelativeTime(document.lastModified)
  );
  useEffect(() => {
    setRelativeTime(formatRelativeTime(document.lastModified));
    const id = setInterval(
      () => setRelativeTime(formatRelativeTime(document.lastModified)),
      30_000
    );
    return () => clearInterval(id);
  }, [document.lastModified]);

  const tags = document.metadata.tags ?? [];

  const handleBlockChange = useCallback(
    (value: string) => {
      const nextPlain = extractPlainText(value);
      const nextWordCount = nextPlain.trim().split(/\s+/).filter(Boolean).length;
      const nextReadingTime = Math.ceil(nextWordCount / 200);
      setBlockValue(value);
      onDocumentChange({
        ...document,
        content: value,
        metadata: {
          ...document.metadata,
          wordCount: nextWordCount,
          readingTime: nextReadingTime,
        },
        lastModified: new Date(),
      });
    },
    [document, onDocumentChange]
  );

  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key === 'k') {
        e.preventDefault();
        const selectionText = window.getSelection()?.toString() ?? '';
        const text = selectionText || plainText;
        const selection: TextSelection = { start: 0, end: text.length, text };
        onAITrigger(selection);
      }
      if (e.key === 'e') {
        e.preventDefault();
        onOpenExport?.();
      }
      if (e.key === 'h') {
        e.preventDefault();
        onOpenVersionHistory?.();
      }
    },
    [onAITrigger, onManualSave, onOpenExport, onOpenVersionHistory, plainText]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        padding: '3rem 2rem 2rem',
        overflow: 'hidden',
      }}
    >
      {saveError && saveError.message && (
        <div style={styles.errorBanner} role="alert" aria-live="assertive">
          Save failed: {saveError.message}. Retrying...
        </div>
      )}
      <div style={styles.contentColumn}>
        {/* Document header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-family-content)',
            fontSize: '2.25rem',
            fontWeight: 300,
            color: 'var(--md-sys-color-on-surface)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            marginBottom: '0.75rem',
          }}>
            {document.title}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontFamily: 'var(--font-family-label)',
            fontSize: '0.7rem',
            color: 'var(--md-sys-color-on-surface-variant)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            opacity: 0.6,
          }}>
            <span>Edited {relativeTime}</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            <span>{readingTime} min read</span>
            {hasUnsavedChanges && (
              <>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                <span style={{ color: 'var(--md-sys-color-primary)', opacity: 1 }}>Unsaved</span>
              </>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div
          data-testid="block-text-editor-container"
          onKeyDownCapture={handleKeyDownCapture}
          style={{
            ...styles.blockEditor,
            fontSize: `${fontSize}px`,
          }}
        >
          <ReactBlockText
            value={blockValue}
            onChange={handleBlockChange}
            onSave={onManualSave}
            plugins={plugins}
            textColor="#1f1f1f"
            primaryColor="#6750a4"
            style={{ fontFamily: 'var(--font-family-content)', fontSize: `${fontSize}px` }}
            data-testid="block-text-editor"
          />
        </div>
        {/* Document metadata bar (Req 4.1–4.5) */}
        <div style={styles.metaBar} aria-label="Document metadata">
          <button data-testid="font-size-decrease" aria-label="Decrease font size" onClick={handleDecreaseFontSize} style={styles.fontSizeBtn}>A−</button>
          <span data-testid="font-size-display" style={styles.fontSizeDisplay}>{fontSize}px</span>
          <button data-testid="font-size-increase" aria-label="Increase font size" onClick={handleIncreaseFontSize} style={styles.fontSizeBtn}>A+</button>
          {tags.length > 0 && (
            <>
              <span style={styles.metaSep}>·</span>
              <span style={styles.tagList} aria-label="Tags">
                {tags.map((tag) => (
                  <span key={tag} style={styles.tag}>{tag}</span>
                ))}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  contentColumn: {
    width: '100%',
    maxWidth: '820px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  blockEditor: {
    flex: 1,
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-family-content)',
    lineHeight: 'var(--line-height-relaxed)',
    color: 'var(--md-sys-color-on-background)',
    caretColor: 'var(--md-sys-color-primary)',
  },
  metaBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.25rem',
    padding: '0.5rem 0',
    fontFamily: 'var(--font-family-label)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    opacity: 0.6,
    userSelect: 'none',
  },
  metaSep: { opacity: 0.5 },
  tagList: { display: 'flex', gap: '0.25rem', flexWrap: 'wrap' },
  tag: {
    background: 'var(--md-sys-color-surface-variant)',
    color: 'var(--md-sys-color-on-surface-variant)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.4rem',
    fontSize: 'var(--font-size-xs)',
  },
  errorBanner: {
    background: 'var(--md-sys-color-error-container)',
    color: 'var(--md-sys-color-error)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    marginBottom: '0.5rem',
  },
  unsavedIndicator: {
    color: 'var(--md-sys-color-primary)',
    fontStyle: 'italic',
  },
  fontSizeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    padding: '0 0.15rem',
    lineHeight: 1,
  },
  fontSizeDisplay: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    minWidth: '2.5rem',
    textAlign: 'center' as const,
  },
};

export default EditorCanvas;
