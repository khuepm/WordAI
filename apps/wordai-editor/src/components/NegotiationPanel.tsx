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
                data-diff="added"
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
          <span style={styles.title}>
            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)', fontSize: '20px' }}>compare_arrows</span>
            So sánh đề xuất AI
          </span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close negotiation panel">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Text comparison */}
        <div style={styles.comparisonRow}>
          {/* Original */}
          <div style={{ ...styles.comparisonCol, background: 'var(--md-sys-color-surface-container)' }}>
            <div style={styles.colLabel}>Bản gốc</div>
            <div data-testid="original-text" style={styles.textBox}>
              <OriginalDiff tokens={diffTokens} />
            </div>
          </div>

          {/* Suggested */}
          <div style={{ ...styles.comparisonCol, background: '#f1f8f1', borderLeft: '1px solid rgba(199,196,215,0.1)' }}>
            <div style={{ ...styles.colLabel, color: '#2d5a27' }}>
              Bản AI đề xuất
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#2d5a27', marginLeft: '4px', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div data-testid="suggested-text" style={{ ...styles.textBox, color: '#1e3a1a' }}>
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

        {/* Action footer */}
        <div style={styles.actions}>
          {suggestion.explanation && (
            <p style={{ ...styles.explanation, flex: 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
              {suggestion.explanation}
            </p>
          )}
          <button data-testid="reject-button" style={{ ...styles.btn, ...styles.btnReject }} onClick={handleReject}>Hủy bỏ</button>
          <button data-testid="edit-button" style={{ ...styles.btn, ...styles.btnEdit }} onClick={handleToggleEdit}>{isEditMode ? 'Preview' : 'Yêu cầu lại'}</button>
          <button data-testid="accept-button" style={{ ...styles.btn, ...styles.btnAccept }} onClick={handleAccept}>Chấp nhận</button>
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
    background: 'rgba(25, 28, 29, 0.1)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(199, 196, 215, 0.2)',
    boxShadow: '0 40px 60px -5px rgba(0,0,0,0.1)',
    borderRadius: '1rem',
    width: '700px',
    maxWidth: '90vw',
    height: '400px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'var(--font-family-ui)',
    animation: 'negotiation-fade-in 200ms ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.5rem',
    background: 'rgba(243, 244, 245, 0.5)',
    borderBottom: '1px solid rgba(199, 196, 215, 0.1)',
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 700,
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'var(--font-family-ui)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--md-sys-color-on-surface-variant)',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
  },
  explanation: {
    margin: '0',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontFamily: 'var(--font-family-ui)',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  comparisonRow: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  comparisonCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  colLabel: {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: 'var(--md-sys-color-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontFamily: 'var(--font-family-label)',
    opacity: 0.6,
    padding: '1rem 1.5rem 0.5rem',
  },
  textBox: {
    flex: 1,
    padding: '0.5rem 1.5rem 1.5rem',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'var(--font-family-content)',
    lineHeight: '1.8',
    overflowY: 'auto',
    wordBreak: 'break-word',
  },
  editTextarea: {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'var(--font-family-content)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    lineHeight: '1.8',
    resize: 'none',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderTop: '1px solid rgba(199, 196, 215, 0.1)',
    background: 'var(--md-sys-color-surface-container-lowest)',
    flexShrink: 0,
  },
  btn: {
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    transition: 'opacity var(--transition-fast)',
  },
  btnAccept: {
    background: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary)',
    padding: '8px 24px',
    boxShadow: '0 4px 12px rgba(67,67,213,0.2)',
  },
  btnEdit: {
    background: 'transparent',
    color: 'var(--md-sys-color-primary)',
  },
  btnReject: {
    background: 'transparent',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
};

export default NegotiationPanel;
