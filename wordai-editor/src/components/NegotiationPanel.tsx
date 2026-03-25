/**
 * NegotiationPanel - Modal for reviewing and accepting/rejecting AI suggestions
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5,
 *               10.1, 10.2, 10.3, 10.4, 10.5, 18.1, 20.3, 21.4
 */

import { useState, useEffect, useCallback } from 'react';
import type { AISuggestion } from '../types/ai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NegotiationPanelProps {
  isOpen: boolean;
  suggestion: AISuggestion | null;
  onAccept: (text: string) => void;
  onReject: () => void;
  onClose: () => void;
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

type DiffToken =
  | { type: 'same'; word: string }
  | { type: 'removed'; word: string }
  | { type: 'added'; word: string };

/**
 * Simple word-level diff between two strings.
 * Returns tokens tagged as same / removed / added.
 */
function wordDiff(original: string, suggested: string): DiffToken[] {
  const origWords = original.split(/(\s+)/);
  const suggWords = suggested.split(/(\s+)/);

  const origSet = new Set(origWords.filter((w) => w.trim()));
  const suggSet = new Set(suggWords.filter((w) => w.trim()));

  const tokens: DiffToken[] = [];

  // Removed words (in original but not in suggested)
  for (const w of origWords) {
    if (!w.trim()) continue;
    if (suggSet.has(w)) {
      tokens.push({ type: 'same', word: w });
    } else {
      tokens.push({ type: 'removed', word: w });
    }
  }

  // Added words (in suggested but not in original)
  for (const w of suggWords) {
    if (!w.trim()) continue;
    if (!origSet.has(w)) {
      tokens.push({ type: 'added', word: w });
    }
  }

  return tokens;
}

/** Render diff tokens for the original side (same + removed) */
function OriginalDiff({ tokens }: { tokens: DiffToken[] }) {
  return (
    <>
      {tokens
        .filter((t) => t.type !== 'added')
        .map((t, i) => {
          if (t.type === 'removed') {
            return (
              <span
                key={i}
                style={{
                  background: 'var(--md-sys-color-error-container)',
                  textDecoration: 'line-through',
                  borderRadius: '2px',
                  padding: '0 2px',
                  marginRight: '2px',
                }}
              >
                {t.word}
              </span>
            );
          }
          return <span key={i} style={{ marginRight: '2px' }}>{t.word}</span>;
        })}
    </>
  );
}

/** Render diff tokens for the suggested side (same + added) */
function SuggestedDiff({ tokens }: { tokens: DiffToken[] }) {
  return (
    <>
      {tokens
        .filter((t) => t.type !== 'removed')
        .map((t, i) => {
          if (t.type === 'added') {
            return (
              <span
                key={i}
                style={{
                  background: '#d4edda',
                  color: '#155724',
                  borderRadius: '2px',
                  padding: '0 2px',
                  marginRight: '2px',
                }}
              >
                {t.word}
              </span>
            );
          }
          return <span key={i} style={{ marginRight: '2px' }}>{t.word}</span>;
        })}
    </>
  );
}

// ─── NegotiationPanel ─────────────────────────────────────────────────────────

export function NegotiationPanel({
  isOpen,
  suggestion,
  onAccept,
  onReject,
  onClose,
}: NegotiationPanelProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedText, setEditedText] = useState('');

  // Reset edit state when suggestion changes or panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
      setEditedText('');
    } else if (suggestion) {
      setEditedText(suggestion.suggestedText);
    }
  }, [isOpen, suggestion]);

  // Escape key closes the panel (Req 21.4)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleAccept = useCallback(() => {
    const text = isEditMode ? editedText : (suggestion?.suggestedText ?? '');
    onAccept(text);
  }, [isEditMode, editedText, suggestion, onAccept]);

  const handleReject = useCallback(() => {
    onReject();
  }, [onReject]);

  const handleToggleEdit = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  if (!isOpen || !suggestion) return null;

  const diffTokens = wordDiff(
    suggestion.originalText,
    isEditMode ? editedText : suggestion.suggestedText
  );

  return (
    // Backdrop overlay
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Review AI suggestion"
    >
      {/* Modal container */}
      <div
        data-testid="negotiation-panel"
        style={styles.modal}
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Review Suggestion</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close negotiation panel"
          >
            ✕
          </button>
        </div>

        {/* Explanation */}
        {suggestion.explanation && (
          <p style={styles.explanation}>{suggestion.explanation}</p>
        )}

        {/* Text comparison (Req 8.2, 8.3, 8.4) */}
        <div style={styles.comparisonRow}>
          {/* Original */}
          <div style={styles.comparisonCol}>
            <div style={styles.colLabel}>Original</div>
            <div
              data-testid="original-text"
              style={styles.textBox}
            >
              <OriginalDiff tokens={diffTokens} />
            </div>
          </div>

          {/* Suggested / Edited */}
          <div style={styles.comparisonCol}>
            <div style={styles.colLabel}>Suggested</div>
            <div
              data-testid="suggested-text"
              style={styles.textBox}
            >
              {isEditMode ? (
                <textarea
                  data-testid="edit-textarea"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  style={styles.editTextarea}
                  aria-label="Edit suggested text"
                />
              ) : (
                <SuggestedDiff tokens={diffTokens} />
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={styles.actions}>
          <button
            data-testid="accept-button"
            style={{ ...styles.btn, ...styles.btnAccept }}
            onClick={handleAccept}
          >
            Accept
          </button>
          <button
            data-testid="edit-button"
            style={{ ...styles.btn, ...styles.btnEdit }}
            onClick={handleToggleEdit}
          >
            {isEditMode ? 'Preview' : 'Edit'}
          </button>
          <button
            data-testid="reject-button"
            style={{ ...styles.btn, ...styles.btnReject }}
            onClick={handleReject}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    background: 'rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'rgba(254, 247, 255, 0.75)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--shadow-ambient-strong)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    width: '680px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflowY: 'auto',
    fontFamily: 'var(--font-family-ui)',
    // Fade-in animation (Req 20.3)
    animation: 'negotiation-fade-in 200ms ease-out',
    opacity: 1,
    transition: 'opacity 200ms ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-sm)',
  },
  title: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'var(--font-family-ui)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-base)',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
  },
  explanation: {
    margin: '0 0 var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontFamily: 'var(--font-family-ui)',
  },
  comparisonRow: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-md)',
  },
  comparisonCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  },
  colLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--font-family-ui)',
  },
  textBox: {
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-sm)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'var(--font-family-content)',
    lineHeight: 'var(--line-height-relaxed)',
    minHeight: '80px',
    wordBreak: 'break-word',
  },
  editTextarea: {
    width: '100%',
    minHeight: '80px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-family-content)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    lineHeight: 'var(--line-height-relaxed)',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    justifyContent: 'flex-end',
  },
  btn: {
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-xs) var(--spacing-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    transition: 'opacity var(--transition-fast)',
  },
  btnAccept: {
    background: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary)',
  },
  btnEdit: {
    background: 'var(--md-sys-color-secondary-container)',
    color: 'var(--md-sys-color-on-secondary-container)',
  },
  btnReject: {
    background: 'var(--md-sys-color-surface-variant)',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
};

export default NegotiationPanel;
