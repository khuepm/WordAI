/**
 * LibrarySearchBar — Controlled search input with a clear button.
 *
 * Requirements: 7.1, 7.5, 10.2, 10.4, 10.5
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export interface LibrarySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** When true, the input receives focus on mount (Req 10.4) */
  autoFocus?: boolean;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-md, 0.625rem)',
  border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
  background: 'var(--md-sys-color-surface-container, #f3f3f7)',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
};

const inputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '0.9375rem',
  color: 'var(--md-sys-color-on-surface, #191c1d)',
  fontFamily: 'inherit',
};

const clearBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.125rem',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--md-sys-color-on-surface-variant, #464555)',
  borderRadius: 'var(--radius-sm, 0.25rem)',
  flexShrink: 0,
};

export function LibrarySearchBar({ value, onChange, onClear, autoFocus }: LibrarySearchBarProps) {
  const { t } = useTranslation();
  const placeholder = t('library.searchPlaceholder');

  return (
    <div style={containerStyle}>
      {/* Search icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0, color: 'var(--md-sys-color-on-surface-variant, #464555)' }}
      >
        <path
          d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zm4.243-.757 2.757 2.757"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <input
        type="text"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />

      {value && (
        <button
          type="button"
          aria-label={t('library.searchClearAriaLabel')}
          onClick={onClear}
          style={clearBtnStyle}
        >
          {/* ✕ icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
