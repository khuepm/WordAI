/**
 * EditorCanvas - Main writing surface component
 * Requirements: 1.3, 19.1, 19.3, 19.4
 */

import { useState, useCallback } from 'react';
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

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
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
        onAITrigger({ start, end, text: selectedText });
      }
    },
    [localContent, onAITrigger]
  );

  return (
    <div
      className={`editor-canvas-wrapper${isAIPanelOpen ? ' ai-panel-open' : ''}`}
      style={styles.wrapper}
    >
      <textarea
        className="editor-canvas"
        value={localContent}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
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
