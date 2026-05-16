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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        borderRadius: 'var(--radius-lg)',
        padding: '8px 12px',
        fontFamily: 'var(--font-family-ui)',
      }}
    >
      {/* Search icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0, color: 'var(--md-sys-color-outline)' }}
      >
        <path
          d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zm4.243-.757 2.757 2.757"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Controlled input */}
      <input
        type="text"
        role="searchbox"
        aria-label={t('library.searchPlaceholder')}
        placeholder={t('library.searchPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--md-sys-color-on-surface)',
          fontFamily: 'var(--font-family-ui)',
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
            width: 20,
            height: 20,
            padding: 0,
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family-ui)',
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
    </div>
  );
}
