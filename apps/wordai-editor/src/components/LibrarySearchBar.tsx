import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface LibrarySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Passed as autoFocus when LibraryView mounts (Req 10.4) */
  autoFocus?: boolean;
}

export function LibrarySearchBar({ value, onChange, onClear, autoFocus }: LibrarySearchBarProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient glow on hover */}
      <div
        style={{
          position: 'absolute',
          inset: '-4px',
          background: 'linear-gradient(135deg, rgba(67,67,213,0.05), rgba(93,95,239,0.05))',
          borderRadius: '1rem',
          filter: 'blur(12px)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 500ms',
          pointerEvents: 'none',
        }}
      />

      {/* Main search container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: isFocused
            ? 'var(--md-sys-color-surface-container-lowest, #ffffff)'
            : 'var(--md-sys-color-surface-container-low, #f3f4f5)',
          border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
          borderColor: isFocused ? 'transparent' : 'rgba(199, 196, 215, 0.2)',
          borderRadius: '1rem',
          padding: '0.5rem',
          boxShadow: isFocused ? '0 2px 0 0 var(--md-sys-color-primary, #4343d5)' : 'none',
          transition: 'all 300ms',
          fontFamily: 'var(--font-family-ui)',
        }}
      >
        {/* Search icon */}
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{
            marginLeft: '1rem',
            marginRight: '0.75rem',
            fontSize: '1.5rem',
            color: 'var(--md-sys-color-primary, #4343d5)',
            flexShrink: 0,
          }}
        >
          search
        </span>

        {/* Controlled input */}
        <input
          type="text"
          role="searchbox"
          aria-label={t('library.searchPlaceholder')}
          placeholder={t('library.search.placeholder', t('library.searchPlaceholder'))}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: 'var(--font-size-lg, 1.125rem)',
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            fontFamily: 'var(--font-family-content, Newsreader, serif)',
            padding: '0.75rem 0',
          }}
        />

        {/* Clear button — only shown when value is non-empty */}
        {value && (
          <button
            type="button"
            aria-label={t('library.searchClearAriaLabel')}
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: 24,
              height: 24,
              padding: 0,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface-variant)',
              cursor: 'pointer',
              marginRight: '0.5rem',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Search button */}
        <button
          type="button"
          onClick={() => {/* search is live, this is visual */ }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.625rem 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: 'var(--md-sys-color-primary, #4343d5)',
            color: 'var(--md-sys-color-on-primary, #ffffff)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 300ms',
            marginRight: '0.25rem',
            flexShrink: 0,
          }}
        >
          {t('library.search.button', 'Search')}
        </button>
      </div>

      {/* Search suggestions */}
      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          gap: '1rem',
          paddingLeft: '1rem',
          fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
          fontSize: '0.75rem',
          color: 'var(--md-sys-color-on-surface-variant, #464555)',
          opacity: 0.7,
        }}
      >
        <span>{t('library.search.try', 'Try:')}</span>
        <button
          type="button"
          onClick={() => onChange('type: document')}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            transition: 'color 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-primary, #4343d5)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
        >
          type: document
        </button>
        <button
          type="button"
          onClick={() => onChange('status: final')}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            transition: 'color 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-primary, #4343d5)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
        >
          status: final
        </button>
      </div>
    </div>
  );
}
