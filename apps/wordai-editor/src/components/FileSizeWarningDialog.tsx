/**
 * FileSizeWarningDialog - Shown when importing a file between 20-100MB.
 * Warns the user about file size and estimated import time before proceeding.
 *
 * Requirements: 25.2, 25.5, 25.6
 */

import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';

export interface FileSizeWarningDialogProps {
  isOpen: boolean;
  /** File size in megabytes */
  fileSizeMB: number;
  /** Estimated import time in seconds: ceil(fileSizeMB / 5) */
  estimatedSeconds: number;
  /** User confirmed to proceed with import */
  onConfirm: () => void;
  /** User cancelled the import */
  onCancel: () => void;
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
};

const card: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
  padding: '2rem',
  width: '100%',
  maxWidth: '440px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  fontFamily: 'var(--font-family-ui, Inter, sans-serif)',
};

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  borderRadius: '0.625rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};

export function FileSizeWarningDialog({
  isOpen,
  fileSizeMB,
  estimatedSeconds,
  onConfirm,
  onCancel,
}: FileSizeWarningDialogProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const formattedSize = `${fileSizeMB.toFixed(1)} MB`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fsw-title"
      data-testid="file-size-warning-dialog"
      style={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={card}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '0.75rem', flexShrink: 0,
            background: 'rgba(234,179,8,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span
              className="material-symbols-outlined"
              style={{ color: '#ca8a04', fontSize: 24, fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
          </div>
          <div>
            <h2
              id="fsw-title"
              style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#18181b', lineHeight: 1.3 }}
            >
              {t('import.sizeWarning.title')}
            </h2>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}>
              {t('import.sizeWarning.message', { size: formattedSize, seconds: estimatedSeconds })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Primary: continue with import */}
          <button
            data-testid="btn-confirm-import"
            onClick={onConfirm}
            style={{ ...btnBase, background: '#4343d5', color: '#ffffff', justifyContent: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            {t('import.sizeWarning.confirm')}
          </button>

          {/* Cancel */}
          <button
            data-testid="btn-cancel-import"
            onClick={onCancel}
            style={{
              ...btnBase,
              background: 'transparent',
              color: '#71717a',
              justifyContent: 'center',
            }}
          >
            {t('import.sizeWarning.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
