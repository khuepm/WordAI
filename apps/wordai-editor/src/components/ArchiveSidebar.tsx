/**
 * ArchiveSidebar — Left navigation panel for the Archive view.
 *
 * Displays category links (Drafts, Projects, Versions, Trash) with
 * active/inactive styling and a "New Entry" button.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.9, 2.10, 12.1, 12.2, 12.5
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArchiveCategory } from '../types/archive';

export interface ArchiveSidebarProps {
  activeCategory: ArchiveCategory;
  onCategoryChange: (category: ArchiveCategory) => void;
  onNewEntry: () => void;
}

interface CategoryItem {
  key: ArchiveCategory;
  icon: string;
}

const CATEGORIES: CategoryItem[] = [
  { key: 'drafts', icon: 'draft' },
  { key: 'projects', icon: 'folder' },
  { key: 'versions', icon: 'history' },
  { key: 'trash', icon: 'delete' },
];

export function ArchiveSidebar({ activeCategory, onCategoryChange, onNewEntry }: ArchiveSidebarProps) {
  const { t } = useTranslation();

  const containerStyle: CSSProperties = {
    width: '288px',
    minWidth: '288px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '1.5rem 1rem',
    gap: '0.5rem',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    borderRight: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
  };

  const getItemStyle = (isActive: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-lg, 0.75rem)',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
    textAlign: 'left' as const,
    // Active vs inactive styling per Req 2.3 and 2.9
    background: isActive ? '#ffffff' : 'transparent',
    color: isActive
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    fontWeight: isActive ? 700 : 400,
    boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
  });

  const newEntryButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem 1rem',
    marginTop: 'auto',
    borderRadius: 'var(--radius-lg, 0.75rem)',
    border: 'none',
    background: 'var(--md-sys-color-primary, #4343d5)',
    color: 'var(--md-sys-color-on-primary, #ffffff)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
  };

  return (
    <nav
      role="navigation"
      aria-label={t('archive.title')}
      data-testid="archive-sidebar"
      style={containerStyle}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {CATEGORIES.map(({ key, icon }) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              data-testid={`archive-sidebar-${key}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onCategoryChange(key)}
              style={getItemStyle(isActive)}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{
                  fontSize: '20px',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {icon}
              </span>
              <span>{t(`archive.sidebar.${key}`)}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="archive-new-entry-button"
        onClick={onNewEntry}
        style={newEntryButtonStyle}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '20px' }}
        >
          add
        </span>
        <span>{t('archive.actions.newEntry')}</span>
      </button>
    </nav>
  );
}
