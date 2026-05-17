import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ArchiveSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onToggleFilters: () => void;
  isFilterPanelOpen: boolean;
}

export function ArchiveSearchBar({
  value,
  onChange,
  onClear,
  onToggleFilters,
  isFilterPanelOpen,
}: ArchiveSearchBarProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      role="search"
      aria-label={t('archive.aria.searchBar')}
      style={{
        maxWidth: '768px',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '48px',
          backgroundColor: isFocused
            ? 'var(--md-sys-color-surface-container-lowest, #ffffff)'
            : 'rgba(255, 255, 255, var(--glass-opacity, 0.80))',
          backdropFilter: 'blur(var(--glass-blur, 20px))',
          WebkitBackdropFilter: 'blur(var(--glass-blur, 20px))',
          border: isFocused
            ? '1px solid var(--md-sys-color-primary, #4343d5)'
            : '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
          borderRadius: 'var(--radius-xl, 1rem)',
          padding: '0.25rem 0.5rem',
          transition: 'all var(--transition-normal, 300ms ease-in-out)',
          fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
          boxShadow: isFocused
            ? '0 2px 0 0 var(--md-sys-color-primary, #4343d5)'
            : 'none',
        }}
      >
        {/* Search icon */}
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{
            marginLeft: '0.75rem',
            marginRight: '0.5rem',
            fontSize: '1.25rem',
            color: 'var(--md-sys-color-primary, #4343d5)',
            flexShrink: 0,
          }}
        >
          search
        </span>

        {/* Search input */}
        <input
          type="text"
          role="searchbox"
          aria-label={t('archive.aria.searchBar')}
          placeholder={t('archive.search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: 'var(--font-size-base, 1rem)',
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            padding: '0.75rem 0',
            minHeight: '48px',
            boxSizing: 'border-box',
          }}
        />

        {/* Clear button — only shown when value is non-empty */}
        {value && (
          <button
            type="button"
            aria-label={t('archive.search.clear')}
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: '32px',
              height: '32px',
              minWidth: '32px',
              minHeight: '32px',
              padding: 0,
              border: 'none',
              borderRadius: 'var(--radius-md, 0.5rem)',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #e7e8e9)',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              cursor: 'pointer',
              marginRight: '0.25rem',
              transition: 'background-color var(--transition-normal, 300ms ease-in-out)',
            }}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontSize: '1rem' }}
            >
              close
            </span>
          </button>
        )}

        {/* Filters button */}
        <button
          type="button"
          aria-label={t('archive.search.filters')}
          aria-pressed={isFilterPanelOpen}
          onClick={onToggleFilters}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.5rem 1rem',
            minHeight: '36px',
            borderRadius: 'var(--radius-lg, 0.75rem)',
            border: isFilterPanelOpen
              ? '1px solid var(--md-sys-color-primary, #4343d5)'
              : '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
            backgroundColor: isFilterPanelOpen
              ? 'rgba(67, 67, 213, 0.08)'
              : 'var(--md-sys-color-surface-container-low, #f3f4f5)',
            color: isFilterPanelOpen
              ? 'var(--md-sys-color-primary, #4343d5)'
              : 'var(--md-sys-color-on-surface-variant, #464555)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--transition-normal, 300ms ease-in-out)',
            marginRight: '0.25rem',
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1.125rem' }}
          >
            tune
          </span>
          {t('archive.search.filters')}
        </button>
      </div>
    </div>
  );
}
