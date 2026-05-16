/**
 * LibraryFilterChips — Row of filter chip buttons for the Library view.
 *
 * Matches the UI mockup with: All, Documents, Templates, Research, References, Reports
 * plus special AI-ready and Verified chips with distinct styling.
 *
 * Requirements: 8.1, 8.4, 8.5
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export type LibraryFilter = 'all' | 'documents' | 'ai-ready' | 'templates' | 'research' | 'references' | 'reports' | 'verified';

export interface LibraryFilterChipsProps {
  activeFilter: LibraryFilter;
  onChange: (filter: LibraryFilter) => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

function chipStyle(isActive: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: isActive
      ? '1px solid rgba(67, 67, 213, 0.2)'
      : '1px solid var(--md-sys-color-outline-variant, rgba(199, 196, 215, 0.3))',
    background: isActive
      ? 'rgba(67, 67, 213, 0.1)'
      : 'var(--md-sys-color-surface-container-low, #f3f4f5)',
    color: isActive
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: '0.75rem',
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  };
}

function specialChipStyle(type: 'ai-ready' | 'verified'): CSSProperties {
  const isAI = type === 'ai-ready';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: isAI
      ? '1px solid rgba(67, 67, 213, 0.3)'
      : '1px solid rgba(87, 89, 149, 0.3)',
    background: isAI
      ? 'var(--md-sys-color-surface-container-lowest, #ffffff)'
      : 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    color: isAI
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-secondary, #575995)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
    boxShadow: isAI ? '0 0 10px rgba(67, 67, 213, 0.1)' : 'none',
  };
}

const dividerStyle: CSSProperties = {
  width: '1px',
  height: '1.5rem',
  background: 'var(--md-sys-color-outline-variant, rgba(199, 196, 215, 0.3))',
  margin: '0 0.25rem',
  alignSelf: 'center',
};

export function LibraryFilterChips({ activeFilter, onChange }: LibraryFilterChipsProps) {
  const { t } = useTranslation();

  const standardChips: { filter: LibraryFilter; label: string }[] = [
    { filter: 'all', label: t('library.filters.all') },
    { filter: 'documents', label: t('library.filters.documents') },
    { filter: 'templates', label: t('library.filters.templates', 'Templates') },
    { filter: 'research', label: t('library.filters.research', 'Research') },
    { filter: 'references', label: t('library.filters.references', 'References') },
    { filter: 'reports', label: t('library.filters.reports', 'Reports') },
  ];

  return (
    <div style={containerStyle} role="group" aria-label={t('library.filters.all')}>
      {standardChips.map(({ filter, label }) => (
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

      {/* Divider */}
      <div style={dividerStyle} aria-hidden="true" />

      {/* AI-ready special chip */}
      <button
        type="button"
        style={specialChipStyle('ai-ready')}
        onClick={() => onChange('ai-ready')}
        aria-pressed={activeFilter === 'ai-ready'}
        data-testid="filter-chip-ai-ready"
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '14px' }}
        >
          auto_awesome
        </span>
        <span>{t('library.filters.aiReady')}</span>
      </button>

      {/* Verified special chip */}
      <button
        type="button"
        style={specialChipStyle('verified')}
        onClick={() => onChange('verified')}
        aria-pressed={activeFilter === 'verified'}
        data-testid="filter-chip-verified"
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '14px' }}
        >
          verified
        </span>
        <span>{t('library.filters.verified', 'Verified')}</span>
      </button>
    </div>
  );
}
