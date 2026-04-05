/**
 * ReplaceConfirmationDialog - Shown when importing a file with an Aura_Tag
 * that matches an existing Intent in AuraBrain.
 *
 * Requirements: 8.4
 */

import type { CSSProperties } from 'react';

export interface ReplaceConfirmationDialogProps {
  isOpen: boolean;
  /** Display name of the conflicting Intent already in AuraBrain */
  intentName: string;
  /** UUID of the existing Intent */
  auraIntentId: string;
  /** User chose to overwrite the existing Intent with the imported content */
  onUpdateIntent: () => void;
  /** User chose to create a brand-new Intent (new UUID) */
  onCreateNew: () => void;
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

export function ReplaceConfirmationDialog({
  isOpen,
  intentName,
  onUpdateIntent,
  onCreateNew,
  onCancel,
}: ReplaceConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcd-title"
      data-testid="replace-confirmation-dialog"
      style={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={card}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '0.75rem', flexShrink: 0,
            background: 'rgba(67,67,213,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span
              className="material-symbols-outlined"
              style={{ color: '#4343d5', fontSize: 24, fontVariationSettings: "'FILL' 1" }}
            >
              swap_horiz
            </span>
          </div>
          <div>
            <h2
              id="rcd-title"
              style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#18181b', lineHeight: 1.3 }}
            >
              Intent already exists
            </h2>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}>
              File này thuộc Intent{' '}
              <strong style={{ color: '#18181b' }}>"{intentName}"</strong>.
              Bạn có muốn cập nhật Intent đó với nội dung mới không?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Primary: update existing */}
          <button
            data-testid="btn-update-intent"
            onClick={onUpdateIntent}
            style={{ ...btnBase, background: '#4343d5', color: '#ffffff', justifyContent: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sync</span>
            Cập nhật Intent
          </button>

          {/* Secondary: create new */}
          <button
            data-testid="btn-create-new"
            onClick={onCreateNew}
            style={{
              ...btnBase,
              background: 'rgba(67,67,213,0.07)',
              color: '#4343d5',
              justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
            Tạo Intent mới
          </button>

          {/* Cancel */}
          <button
            data-testid="btn-cancel"
            onClick={onCancel}
            style={{
              ...btnBase,
              background: 'transparent',
              color: '#71717a',
              justifyContent: 'center',
            }}
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
