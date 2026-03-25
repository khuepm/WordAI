/**
 * EditorCanvas - Main writing surface component
 * Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 19.1, 19.3, 19.4, 21.5
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Document, TextSelection } from '../types/document';

export interface EditorCanvasProps {
  document: Document;
  onDocumentChange: (doc: Document) => void;
  onAITrigger: (selection: TextSelection) => void;
  isAIPanelOpen: boolean;
}

export function EditorCanvas({
  document,
  onDocumentChange,
  onAITrigger,
  isAIPanelOpen,
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
      // Cmd+A / Ctrl+A — select all content (Req 3.4, 21.5)
      if (isMod && e.key === 'a') {
        e.preventDefault();
        const textarea = e.currentTarget;
        textarea.setSelectionRange(0, localContent.length);
        selectionRef.current = { start: 0, end: localContent.length, text: localContent };
      }
    },
    [localContent, onAITrigger]
  );

  // Capture selection after mouse drag or click (Req 3.1, 3.2, 3.3)
  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    selectionRef.current = { start, end, text: localContent.slice(start, end) };
  }, [localContent]);

  return (
    <div
      className={`editor-canvas-wrapper${isAIPanelOpen ? ' ai-panel-open' : ''}`}
      style={styles.wrapper}
    >
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
  textarea: {
    width: '100%',
    maxWidth: '720px',
    height: '100%',
    resize: 'none',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-family-content)',
    fontSize: 'var(--font-size-lg)',   /* 18px */
    lineHeight: 'var(--line-height-relaxed)', /* 1.6 */
    color: 'var(--md-sys-color-on-background)',
    caretColor: 'var(--md-sys-color-primary)',
  },
};

export default EditorCanvas;
