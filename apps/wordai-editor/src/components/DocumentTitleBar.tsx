/**
 * DocumentTitleBar - Displays the document title in the format:
 * "● {intentName} — WordAI" (dirty) or "{intentName} — WordAI" (clean)
 * "Untitled Intent — WordAI" when intentName is null
 *
 * Click the title to rename inline. Press Enter or blur to confirm,
 * press Escape to cancel.
 *
 * NEVER displays file paths or path separators (/ or \)
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7
 */

import { useState, useRef, useEffect } from 'react';

interface DocumentTitleBarProps {
  intentName: string | null; // null → display "Untitled Intent"
  isDirty: boolean;          // true → display ● before name
  isSyncing: boolean;        // true → optional syncing indicator
  /** Called when the user commits a new title. Omit to make read-only. */
  onRename?: (newTitle: string) => void;
}

export function DocumentTitleBar({ intentName, isDirty, isSyncing: _isSyncing, onRename }: DocumentTitleBarProps) {
  const displayName = intentName ?? 'Untitled Intent';
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when the title changes externally
  useEffect(() => {
    if (!isEditing) setDraft(displayName);
  }, [displayName, isEditing]);

  // Focus + select all when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : displayName;
    setDraft(next);
    setIsEditing(false);
    if (trimmed.length > 0 && trimmed !== displayName) {
      onRename?.(trimmed);
    }
  }

  function cancel() {
    setDraft(displayName);
    setIsEditing(false);
  }

  const dirtyDot = isDirty ? '● ' : '';

  if (isEditing) {
    return (
      <div
        data-testid="document-title-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#18181b',
        }}
      >
        {dirtyDot && <span aria-hidden="true" style={{ marginRight: 2 }}>{dirtyDot}</span>}
        <input
          ref={inputRef}
          data-testid="document-title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          style={{
            font: 'inherit',
            fontWeight: 'inherit',
            color: 'inherit',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--md-sys-color-primary, #6750a4)',
            outline: 'none',
            padding: '0 2px',
            minWidth: '4ch',
            width: `${Math.max(draft.length, 4)}ch`,
            textAlign: 'center',
          }}
          aria-label="Document title"
        />
        <span style={{ marginLeft: 4, color: '#71717a' }}> — WordAI</span>
      </div>
    );
  }

  const title = `${dirtyDot}${displayName} — WordAI`;

  return (
    <div
      data-testid="document-title-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#18181b',
        userSelect: 'none',
      }}
    >
      <span
        data-testid="document-title-text"
        onClick={onRename ? () => { setDraft(displayName); setIsEditing(true); } : undefined}
        title={onRename ? 'Click to rename' : undefined}
        style={{
          cursor: onRename ? 'text' : 'default',
          borderRadius: 4,
          padding: '1px 4px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (onRename) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {title}
      </span>
    </div>
  );
}
