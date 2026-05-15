/**
 * LibraryFilterChips — Row of filter chip buttons for the Library view.
 *
 * Requirements: 8.1, 8.4, 8.5
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export type LibraryFilter = 'all' | 'documents' | 'ai-ready';

export interface LibraryFilterChipsProps {
  activeFilter: LibraryFilter;
  onChange: (filter: LibraryFilter) => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

function chipStyle(isActive: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.375rem 0.875rem',
    borderRadius: 'var(--radius-xl, 1rem)',
    border: isActive
      ? '1.5px solid var(--md-sys-color-primary, #4343d5)'
      : '1.5px solid var(--md-sys-color-outline-variant, #c7c4d7)',
    background: isActive
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'transparent',
    color: isActive
      ? 'var(--md-sys-color-on-primary, #ffffff)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 400,
    cursor: 'pointer',
    transition: 'background 150ms ease-in-out, color 150ms ease-in-out, border-color 150ms ease-in-out',
    outline: 'none',
    whiteSpace: 'nowrap',
  };
}

const CHIPS: Array<{ filter: LibraryFilter; labelKey: string }> = [
  { filter: 'all', labelKey: 'library.filters.all' },
  { filter: 'documents', labelKey: 'library.filters.documents' },
  { filter: 'ai-ready', labelKey: 'library.filters.aiReady' },
];

export function LibraryFilterChips({ activeFilter, onChange }: LibraryFilterChipsProps) {
  const { t } = useTranslation();

  return (
    <div style={containerStyle} role="group" aria-label={t('library.filters.all')}>
      {CHIPS.map(({ filter, labelKey }) => {
        const isActive = activeFilter === filter;
        return (
          <button
            key={filter}
            type="button"
            style={chipStyle(isActive)}
            aria-pressed={isActive}
            onClick={() => onChange(filter)}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
