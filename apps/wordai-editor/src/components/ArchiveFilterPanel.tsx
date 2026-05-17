import { useTranslation } from 'react-i18next';
import type { ArchiveFilters } from '../types/archive';

export interface ArchiveFilterPanelProps {
  filters: ArchiveFilters;
  onChange: (filters: ArchiveFilters) => void;
  onClear: () => void;
}

const TYPE_OPTIONS: Array<{ key: ArchiveFilters['types'][number]; labelKey: string }> = [
  { key: 'suggestions', labelKey: 'archive.filters.itemType.suggestions' },
  { key: 'versions', labelKey: 'archive.filters.itemType.versions' },
  { key: 'paused_projects', labelKey: 'archive.filters.itemType.pausedProjects' },
];

const DATE_RANGE_OPTIONS: Array<{ value: ArchiveFilters['dateRange']; labelKey: string }> = [
  { value: 'last_7_days', labelKey: 'archive.filters.dateRange.last7Days' },
  { value: 'last_30_days', labelKey: 'archive.filters.dateRange.last30Days' },
  { value: 'last_90_days', labelKey: 'archive.filters.dateRange.last90Days' },
  { value: 'all', labelKey: 'archive.filters.dateRange.allTime' },
];

export function ArchiveFilterPanel({ filters, onChange, onClear }: ArchiveFilterPanelProps) {
  const { t } = useTranslation();

  const handleTypeToggle = (type: ArchiveFilters['types'][number]) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types: newTypes });
  };

  const handleDateRangeChange = (dateRange: ArchiveFilters['dateRange']) => {
    onChange({ ...filters, dateRange });
  };

  const hasActiveFilters = filters.types.length > 0 || filters.dateRange !== 'all';

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
        borderRadius: 'var(--radius-xl, 1rem)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-ambient, 0 4px 12px rgba(0, 0, 0, 0.08))',
        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
      }}
    >
      {/* Item Type Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            marginBottom: '0.625rem',
          }}
        >
          {t('archive.filters.itemType.label')}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {TYPE_OPTIONS.map(({ key, labelKey }) => {
            const isActive = filters.types.includes(key);
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={isActive}
                onClick={() => handleTypeToggle(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.375rem 0.875rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: isActive
                    ? '1.5px solid var(--md-sys-color-primary, #4343d5)'
                    : '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
                  backgroundColor: isActive
                    ? 'rgba(67, 67, 213, 0.1)'
                    : 'var(--md-sys-color-surface-container-low, #f3f4f5)',
                  color: isActive
                    ? 'var(--md-sys-color-primary, #4343d5)'
                    : 'var(--md-sys-color-on-surface-variant, #464555)',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  minHeight: '32px',
                }}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            marginBottom: '0.625rem',
          }}
        >
          {t('archive.filters.dateRange.label')}
        </span>
        <div role="radiogroup" aria-label={t('archive.filters.dateRange.label')} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {DATE_RANGE_OPTIONS.map(({ value, labelKey }) => {
            const isSelected = filters.dateRange === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleDateRangeChange(value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.375rem 0.875rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: isSelected
                    ? '1.5px solid var(--md-sys-color-primary, #4343d5)'
                    : '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
                  backgroundColor: isSelected
                    ? 'rgba(67, 67, 213, 0.1)'
                    : 'var(--md-sys-color-surface-container-low, #f3f4f5)',
                  color: isSelected
                    ? 'var(--md-sys-color-primary, #4343d5)'
                    : 'var(--md-sys-color-on-surface-variant, #464555)',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                  fontWeight: isSelected ? 600 : 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  minHeight: '32px',
                }}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear All Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md, 0.5rem)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--md-sys-color-primary, #4343d5)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'background-color 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(67, 67, 213, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('archive.filters.clearAll')}
        </button>
      )}
    </div>
  );
}
