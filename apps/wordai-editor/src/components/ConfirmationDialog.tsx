/**
 * ConfirmationDialog - A minimal two-button modal for destructive confirmations.
 * Separate from ReplaceConfirmationDialog (which has three choices and import-specific copy).
 *
 * Requirements: 9.2, 9.5
 */

import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** When true, renders the confirm button in error color (var(--md-sys-color-error)) */
  isDangerous?: boolean;
  onConfirm: () => void;
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
  background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
  borderRadius: 'var(--radius-xl, 1rem)',
  boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
  padding: '2rem',
  width: '100%',
  maxWidth: '440px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
};

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.75rem 1.25rem',
  borderRadius: 'var(--radius-md, 0.625rem)',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
  width: '100%',
};

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const confirmBtnStyle: CSSProperties = isDangerous
    ? {
      ...btnBase,
      background: 'var(--md-sys-color-error, #ba1a1a)',
      color: 'var(--md-sys-color-on-error, #ffffff)',
    }
    : {
      ...btnBase,
      background: 'var(--md-sys-color-primary, #4343d5)',
      color: 'var(--md-sys-color-on-primary, #ffffff)',
    };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-title"
      aria-label={t('confirmationDialog.ariaLabel')}
      data-testid="confirmation-dialog"
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={card}>
        {/* Title */}
        <div>
          <h2
            id="cd-title"
            style={{
              margin: 0,
              fontSize: '1.0625rem',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface, #191c1d)',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: '0.875rem',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Confirm */}
          <button
            data-testid="confirmation-dialog-confirm"
            onClick={onConfirm}
            style={confirmBtnStyle}
          >
            {confirmLabel}
          </button>

          {/* Cancel */}
          <button
            data-testid="confirmation-dialog-cancel"
            onClick={onCancel}
            style={{
              ...btnBase,
              background: 'transparent',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
