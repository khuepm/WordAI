/**
 * EditorCanvas - Main writing surface component
 * Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 19.1, 19.3, 19.4, 21.5, 2.5, 17.2, 17.3
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Document, TextSelection } from '../types/document';
import type { IPCError } from '../types/ipc';

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
}: EditorCanvasProps) {
  const [localContent, setLocalContent] = useState(document.content);
  // Track current text selection (Req 3.2, 3.3) — exposed to parent via onAITrigger on Cmd+K
  const selectionRef = useRef<TextSelection>({ start: 0, end: 0, text: '' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track cursor position so React re-renders don't cause cursor jumps (Req 3.5)
  const cursorRef = useRef<{ start: number; end: number } | null>(null);

  // Restore cursor position after state-driven re-renders (Req 3.5)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && cursorRef.current !== null) {
      textarea.selectionStart = cursorRef.current.start;
      textarea.selectionEnd = cursorRef.current.end;
      cursorRef.current = null;
    }
  });

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      const newContent = textarea.value;
      // Capture cursor before React batches the state update (Req 3.5)
      cursorRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      setLocalContent(newContent);
      onDocumentChange({
        ...document,
        content: newContent,
        lastModified: new Date(),
      });
    },
    [document, onDocumentChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'k') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = localContent.slice(start, end);
        const sel: TextSelection = { start, end, text: selectedText };
        selectionRef.current = sel;
        onAITrigger(sel);
      }
      // Cmd+S / Ctrl+S — manual save (Req 21.2)
      if (isMod && e.key === 's') {
        e.preventDefault();
        onManualSave?.();
      }
      // Cmd+E / Ctrl+E — open export drawer (Req 21.3)
      if (isMod && e.key === 'e') {
        e.preventDefault();
        onOpenExport?.();
      }
      // Cmd+A / Ctrl+A — select all content (Req 3.4, 21.5)
      if (isMod && e.key === 'a') {
        e.preventDefault();
        const textarea = e.currentTarget;
        textarea.setSelectionRange(0, localContent.length);
        selectionRef.current = { start: 0, end: localContent.length, text: localContent };
      }
    },
    [localContent, onAITrigger, onManualSave, onOpenExport]
  );

  // Capture selection after mouse drag or click (Req 3.1, 3.2, 3.3)
  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    selectionRef.current = { start, end, text: localContent.slice(start, end) };
  }, [localContent]);

  // Real-time word count (Req 4.1) and reading time (Req 4.2)
  const wordCount = useMemo(
    () => localContent.trim().split(/\s+/).filter(Boolean).length,
    [localContent]
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

  return (
    <div
      className={`editor-canvas-wrapper${isAIPanelOpen ? ' ai-panel-open' : ''}`}
      style={styles.wrapper}
    >
      {saveError && (
        <div style={styles.errorBanner} role="alert" aria-live="assertive">
          Save failed: {saveError.message}. Retrying...
        </div>
      )}
      <div style={styles.contentColumn}>
        <textarea
          ref={textareaRef}
          className="editor-canvas"
          value={localContent}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onMouseUp={handleSelectionChange}
          onSelect={handleSelectionChange}
          placeholder="Start writing..."
          spellCheck
          style={styles.textarea}
          aria-label="Document editor"
        />
        {/* Document metadata bar (Req 4.1–4.5) */}
        <div style={styles.metaBar} aria-label="Document metadata">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span style={styles.metaSep}>·</span>
          <span>{readingTime} min read</span>
          <span style={styles.metaSep}>·</span>
          <span>Edited {relativeTime}</span>
          {hasUnsavedChanges && (
            <>
              <span style={styles.metaSep}>·</span>
              <span style={styles.unsavedIndicator} aria-label="Unsaved changes">Unsaved changes</span>
            </>
          )}
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
  wrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem',
    transition: 'all var(--transition-normal)',
    overflow: 'hidden',
  },
  contentColumn: {
    width: '100%',
    maxWidth: '720px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  textarea: {
    flex: 1,
    width: '100%',
    resize: 'none',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-family-content)',
    fontSize: 'var(--font-size-lg)',
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
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    opacity: 0.6,
    userSelect: 'none',
  },
  metaSep: {
    opacity: 0.5,
  },
  tagList: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  tag: {
    background: 'var(--md-sys-color-surface-variant)',
    color: 'var(--md-sys-color-on-surface-variant)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.4rem',
    fontSize: 'var(--font-size-xs)',
  },
  errorBanner: {
    background: 'var(--md-sys-color-error-container, #ffdad6)',
    color: 'var(--md-sys-color-error, #ba1a1a)',
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
};

export default EditorCanvas;
