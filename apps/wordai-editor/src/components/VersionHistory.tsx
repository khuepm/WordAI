/**
 * VersionHistory - Browse and restore past document versions
 * Requirements: 22.4, 22.5
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DocumentSnapshot } from '../types/document';
import { extractPlainText } from '../utils/blockText';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  /** Called when the user confirms restoring a past version */
  onRestore: (content: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── VersionHistory ───────────────────────────────────────────────────────────

export function VersionHistory({ isOpen, onClose, documentId, onRestore }: VersionHistoryProps) {
  const [history, setHistory] = useState<DocumentSnapshot[]>([]);
  const [selected, setSelected] = useState<DocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch history whenever the panel opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    setSelected(null);

    invoke<DocumentSnapshot[]>('get_version_history', { docId: documentId })
      .then((snapshots) => {
        // Show newest first
        setHistory([...snapshots].reverse());
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, documentId]);

  // Escape key closes the panel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleRestore = useCallback(() => {
    if (!selected) return;
    onRestore(selected.content);
    onClose();
  }, [selected, onRestore, onClose]);

  return (
    // Backdrop
    <div
      style={{
        ...styles.backdrop,
        ...(isOpen ? styles.backdropVisible : styles.backdropHidden),
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden={!isOpen}
      data-testid="version-history-backdrop"
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-label="Version history"
        aria-modal="true"
        data-testid="version-history-panel"
        style={{
          ...styles.panel,
          ...(isOpen ? styles.panelOpen : styles.panelClosed),
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Version History</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close version history"
            data-testid="version-history-close"
          >
            ✕
          </button>
        </div>

        {/* Body: list + preview */}
        <div style={styles.body}>
          {/* Version list */}
          <div style={styles.listPane} aria-label="Past versions">
            {isLoading && (
              <p style={styles.hint} data-testid="version-history-loading">Loading…</p>
            )}
            {error && !isLoading && (
              <p style={styles.errorText} role="alert" data-testid="version-history-error">{error}</p>
            )}
            {!isLoading && !error && history.length === 0 && (
              <p style={styles.hint} data-testid="version-history-empty">No saved versions yet.</p>
            )}
            {history.map((snap) => (
              <button
                key={`${snap.version}-${snap.timestamp}`}
                style={{
                  ...styles.versionItem,
                  ...(selected?.version === snap.version && selected?.timestamp === snap.timestamp
                    ? styles.versionItemSelected
                    : {}),
                }}
                onClick={() => setSelected(snap)}
                aria-pressed={selected?.version === snap.version && selected?.timestamp === snap.timestamp}
                data-testid={`version-item-${snap.version}`}
              >
                <span style={styles.versionLabel}>v{snap.version}</span>
                <span style={styles.versionTimestamp}>{formatTimestamp(snap.timestamp)}</span>
              </button>
            ))}
          </div>

          {/* Preview pane */}
          <div style={styles.previewPane} aria-label="Version preview">
            {selected ? (
              <pre style={styles.previewContent} data-testid="version-preview">
                {extractPlainText(selected.content) || <em>(empty document)</em>}
              </pre>
            ) : (
              <p style={styles.hint} data-testid="version-preview-hint">
                Select a version to preview its content.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{
              ...styles.restoreBtn,
              ...(!selected ? styles.restoreBtnDisabled : {}),
            }}
            onClick={handleRestore}
            disabled={!selected}
            aria-label={selected ? `Restore version ${selected.version}` : 'Restore version'}
            data-testid="version-restore-button"
          >
            Restore this version
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-normal)',
  },
  backdropVisible: {
    background: 'rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    pointerEvents: 'auto',
  },
  backdropHidden: {
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    pointerEvents: 'none',
  },
  panel: {
    width: '720px',
    maxWidth: '95vw',
    height: '520px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-family-ui)',
    background: 'rgba(254, 247, 255, 0.92)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-ambient-strong)',
    transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease',
    overflow: 'hidden',
  },
  panelOpen: { transform: 'scale(1)', opacity: 1 },
  panelClosed: { transform: 'scale(0.96)', opacity: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
    letterSpacing: '0.02em',
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
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  listPane: {
    width: '220px',
    flexShrink: 0,
    overflowY: 'auto',
    borderRight: '1px solid var(--md-sys-color-outline-variant)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--spacing-sm)',
    gap: 'var(--spacing-xs)',
  },
  versionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    textAlign: 'left',
    transition: 'background var(--transition-fast), border-color var(--transition-fast)',
  },
  versionItemSelected: {
    background: 'var(--md-sys-color-primary-container)',
    borderColor: 'var(--md-sys-color-primary)',
  },
  versionLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
  },
  versionTimestamp: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
  previewPane: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-lg)',
  },
  previewContent: {
    margin: 0,
    fontFamily: 'var(--font-family-content, monospace)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 'var(--line-height-normal)',
  },
  hint: {
    margin: 0,
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--spacing-md)',
    opacity: 0.7,
  },
  errorText: {
    margin: 0,
    color: 'var(--md-sys-color-error)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--spacing-md)',
  },
  footer: {
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderTop: '1px solid var(--md-sys-color-outline-variant)',
    flexShrink: 0,
  },
  restoreBtn: {
    width: '100%',
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    background: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  restoreBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
};

export default VersionHistory;
