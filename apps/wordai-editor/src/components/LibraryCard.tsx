/**
 * LibraryCard — A card component for displaying a library document summary.
 *
 * Requirements: 2.6
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuraIntentSummary } from '../types/auraDocument';
import { formatRelativeTime } from '../utils/formatRelativeTime';

export interface LibraryCardProps {
  summary: AuraIntentSummary;
  isLoading: boolean;
  hasError: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const cardStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  borderRadius: 'var(--radius-lg, 0.75rem)',
  border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
  background: 'var(--md-sys-color-surface-container, #f3f3f7)',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  outline: 'none',
  transition: 'background 150ms ease-in-out, border-color 150ms ease-in-out',
};

const cardFocusStyle: CSSProperties = {
  ...cardStyle,
  outline: '2px solid var(--md-sys-color-primary, #4343d5)',
  outlineOffset: '2px',
};

const iconRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const docIconStyle: CSSProperties = {
  fontSize: '1.5rem',
  color: 'var(--md-sys-color-primary, #4343d5)',
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
};

const titleStyle: CSSProperties = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: 'var(--md-sys-color-on-surface, #191c1d)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  margin: 0,
};

const metaStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--md-sys-color-on-surface-variant, #464555)',
};

const versionBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.125rem 0.5rem',
  borderRadius: 'var(--radius-sm, 0.25rem)',
  background: 'var(--md-sys-color-secondary-container, #e4e0f7)',
  color: 'var(--md-sys-color-on-secondary-container, #1d1b4b)',
  fontSize: '0.6875rem',
  fontWeight: 600,
};

const deleteBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.25rem',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--md-sys-color-error, #ba1a1a)',
  borderRadius: 'var(--radius-sm, 0.25rem)',
  opacity: 0.6,
  transition: 'opacity 150ms ease-in-out',
  flexShrink: 0,
};

const deleteBtnHoverStyle: CSSProperties = {
  ...deleteBtnStyle,
  opacity: 1,
};

const loadingOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.7)',
  borderRadius: 'var(--radius-lg, 0.75rem)',
  zIndex: 1,
};

const spinnerStyle: CSSProperties = {
  width: '1.5rem',
  height: '1.5rem',
  border: '2px solid var(--md-sys-color-outline-variant, #c7c4d7)',
  borderTopColor: 'var(--md-sys-color-primary, #4343d5)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const errorStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--md-sys-color-error, #ba1a1a)',
  marginTop: '0.25rem',
};

export function LibraryCard({ summary, isLoading, hasError, onOpen, onDelete }: LibraryCardProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  return (
    <button
      type="button"
      data-testid="library-card"
      aria-label={t('library.card.openAriaLabel', { name: summary.intent_name })}
      style={isFocused ? cardFocusStyle : cardStyle}
      onClick={() => onOpen(summary.id)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div
          data-testid="library-card-loading"
          aria-label={t('library.card.loadingAriaLabel', { name: summary.intent_name })}
          style={loadingOverlayStyle}
        >
          <div style={spinnerStyle} />
        </div>
      )}

      {/* Icon row with delete button */}
      <div style={iconRowStyle}>
        {/* Document icon */}
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={docIconStyle}
        >
          description
        </span>

        {/* Delete button — uses div+role="button" to avoid invalid nested <button> in <button> */}
        <div
          role="button"
          tabIndex={0}
          data-testid="library-card-delete"
          aria-label={t('library.card.deleteAriaLabel', { name: summary.intent_name })}
          style={isDeleteHovered ? deleteBtnHoverStyle : deleteBtnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(summary.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onDelete(summary.id);
            }
          }}
          onMouseEnter={() => setIsDeleteHovered(true)}
          onMouseLeave={() => setIsDeleteHovered(false)}
          onFocus={() => setIsDeleteHovered(true)}
          onBlur={() => setIsDeleteHovered(false)}
        >
          {/* Trash icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 0 0 4.5 14h7a.5.5 0 0 0 .5-.5L13 4"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Document title */}
      <p style={titleStyle}>{summary.intent_name}</p>

      {/* Metadata row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span
          data-testid="library-card-timestamp"
          style={metaStyle}
        >
          {t('library.card.updatedAt', { time: formatRelativeTime(summary.updated_at) })}
        </span>
        <span
          data-testid="library-card-version"
          style={versionBadgeStyle}
        >
          {t('library.card.version', { version: summary.version })}
        </span>
      </div>

      {/* Error message */}
      {hasError && (
        <span
          data-testid="library-card-error"
          style={errorStyle}
        >
          {t('library.card.errorMessage')}
        </span>
      )}
    </button>
  );
}
