/**
 * LibraryEmptyState — Shown when the document grid has no items to display.
 *
 * Two modes:
 *  - 'no-documents': list_intents returned an empty array; prompts user to create a document.
 *  - 'no-results':   search/filter yielded no matches; prompts user to clear the search.
 *
 * Requirements: 2.3, 7.4
 */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

export interface LibraryEmptyStateProps {
  /** 'no-documents' when list_intents returns [], 'no-results' when search/filter yields nothing */
  reason: 'no-documents' | 'no-results';
  /** The active search query — used in the 'no-results' message interpolation */
  searchQuery?: string;
  /** Called when the user clicks the CTA button (create new doc or clear search) */
  onCreateNew: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.25rem',
  padding: '5rem 2rem',
  textAlign: 'center',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
};

const iconWrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '4rem',
  height: '4rem',
  borderRadius: '1rem',
  background: 'var(--md-sys-color-surface-container-low, #f3f4f5)',
  color: 'var(--md-sys-color-on-surface-variant, #464555)',
  border: '1px solid rgba(199, 196, 215, 0.2)',
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: 'var(--md-sys-color-on-surface, #191c1d)',
  lineHeight: 1.3,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  color: 'var(--md-sys-color-on-surface-variant, #464555)',
  fontFamily: 'var(--font-family-content, Newsreader, serif)',
  lineHeight: 1.5,
  maxWidth: '28rem',
};

const ctaButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.75rem',
  border: 'none',
  background: 'var(--md-sys-color-primary, #4343d5)',
  color: 'var(--md-sys-color-on-primary, #ffffff)',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 300ms',
  marginTop: '0.5rem',
};

/** Document icon for 'no-documents' state */
function DocumentIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Search icon for 'no-results' state */
function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 11h6M11 8v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LibraryEmptyState({ reason, searchQuery, onCreateNew }: LibraryEmptyStateProps) {
  const { t } = useTranslation();

  const isNoDocuments = reason === 'no-documents';

  const title = isNoDocuments
    ? t('library.emptyState.noDocuments.title')
    : t('library.emptyState.noResults.title');

  const message = isNoDocuments
    ? t('library.emptyState.noDocuments.message')
    : t('library.emptyState.noResults.message', { query: searchQuery ?? '' });

  const ctaLabel = isNoDocuments
    ? t('library.emptyState.noDocuments.createButton')
    : t('library.emptyState.noResults.clearButton');

  return (
    <div
      style={containerStyle}
      data-testid="library-empty-state"
      aria-live="polite"
    >
      {/* Icon */}
      <div style={iconWrapperStyle}>
        {isNoDocuments ? <DocumentIcon /> : <SearchIcon />}
      </div>

      {/* Title */}
      <h2 style={titleStyle}>{title}</h2>

      {/* Message */}
      <p style={messageStyle}>{message}</p>

      {/* CTA button */}
      <button
        type="button"
        style={ctaButtonStyle}
        onClick={onCreateNew}
        data-testid="library-empty-state-cta"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
