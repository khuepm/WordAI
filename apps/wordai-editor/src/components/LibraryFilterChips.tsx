/**
 * LibraryFilterChips — Row of filter chip buttons for the Library view.
 *
 * Three chips: "All", "Documents", "AI-ready".
 * The chip matching `activeFilter` receives the active visual style
 * (primary color background and border).
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
    borderRadius: 'var(--radius-full, 9999px)',
    border: isActive
      ? '1.5px solid var(--md-sys-color-primary, #4343d5)'
      : '1.5px solid var(--md-sys-color-outline-variant, #c5c4d4)',
    background: isActive
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-surface-container-low, #f3f3f7)',
    color: isActive
      ? 'var(--md-sys-color-on-primary, #ffffff)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: '0.8125rem',
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  };
}

export function LibraryFilterChips({ activeFilter, onChange }: LibraryFilterChipsProps) {
  const { t } = useTranslation();

  const chips: { filter: LibraryFilter; label: string }[] = [
    { filter: 'all', label: t('library.filters.all') },
    { filter: 'documents', label: t('library.filters.documents') },
    { filter: 'ai-ready', label: t('library.filters.aiReady') },
  ];

  return (
    <div style={containerStyle} role="group" aria-label={t('library.filters.all')}>
      {chips.map(({ filter, label }) => (
        <button
          key={filter}
          type="button"
          style={chipStyle(activeFilter === filter)}
          onClick={() => onChange(filter)}
          aria-pressed={activeFilter === filter}
          data-testid={`filter-chip-${filter}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
