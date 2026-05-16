/**
 * LibraryCard — A card component for displaying a library document summary.
 * Matches the UI mockup with icon box, status badge, @-reference, description,
 * and hover action buttons.
 *
 * Requirements: 2.6
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuraIntentSummary } from '../types/auraDocument';
import { formatRelativeTime } from '../utils/formatRelativeTime';

export interface LibraryCardProps {
  summary: AuraIntentSummary;
  isLoading: boolean;
  hasError: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Pick a deterministic icon and color based on the document name */
function getDocIcon(name: string): { icon: string; color: string } {
  const icons = [
    { icon: 'description', color: 'var(--md-sys-color-primary, #4343d5)' },
    { icon: 'auto_stories', color: 'var(--md-sys-color-secondary, #575995)' },
    { icon: 'analytics', color: '#904400' },
    { icon: 'article', color: 'var(--md-sys-color-primary, #4343d5)' },
    { icon: 'school', color: 'var(--md-sys-color-secondary, #575995)' },
  ];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return icons[hash % icons.length];
}

/** Determine status badge based on version */
function getStatusBadge(version: number): { label: string; color: string; borderColor: string } {
  if (version >= 3) {
    return {
      label: 'Final',
      color: 'var(--md-sys-color-secondary, #575995)',
      borderColor: 'var(--md-sys-color-outline-variant, #c7c4d7)',
    };
  }
  return {
    label: 'Draft',
    color: 'var(--md-sys-color-on-surface-variant, #464555)',
    borderColor: 'var(--md-sys-color-outline-variant, #c7c4d7)',
  };
}

/** Generate a short @-reference from the intent name */
function getReference(name: string): string {
  return name.replace(/\s+/g, '_').substring(0, 20);
}

export function LibraryCard({ summary, isLoading, hasError, onOpen, onDelete }: LibraryCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const { icon, color } = getDocIcon(summary.intent_name);
  const badge = getStatusBadge(summary.version);
  const reference = getReference(summary.intent_name);

  const cardStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1.25rem',
    borderRadius: '1rem',
    border: '1px solid rgba(199, 196, 215, 0.15)',
    background: 'var(--md-sys-color-surface-container-low, #f3f4f5)',
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    outline: isFocused ? '2px solid var(--md-sys-color-primary, #4343d5)' : 'none',
    outlineOffset: '2px',
    overflow: 'hidden',
    transition: 'box-shadow 300ms, background 300ms',
    boxShadow: isHovered ? '0 4px 20px -5px rgba(0, 0, 0, 0.05)' : 'none',
  };

  const gradientOverlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(67,67,213,0) 0%, rgba(67,67,213,0.05) 100%)',
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 300ms',
    pointerEvents: 'none',
    borderRadius: '1rem',
  };

  const iconBoxStyle: CSSProperties = {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '0.75rem',
    background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid rgba(199, 196, 215, 0.2)',
    flexShrink: 0,
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.25rem',
    background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    color: badge.color,
    border: `1px solid ${badge.borderColor}`,
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const titleStyle: CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface, #191c1d)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: '0 0 0.25rem',
    lineHeight: 1.3,
  };

  const referenceStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    border: '1px solid rgba(199, 196, 215, 0.3)',
    borderRadius: '0.25rem',
    padding: '0.125rem 0.5rem',
    marginBottom: '0.75rem',
  };

  const footerStyle: CSSProperties = {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(199, 196, 215, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  };

  const actionButtonsStyle: CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 200ms',
  };

  return (
    <button
      type="button"
      data-testid="library-card"
      aria-label={t('library.card.openAriaLabel', { name: summary.intent_name })}
      style={cardStyle}
      onClick={() => onOpen(summary.id)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient overlay on hover */}
      <div style={gradientOverlayStyle} />

      {/* Loading overlay */}
      {isLoading && (
        <div
          data-testid="library-card-loading"
          aria-label={t('library.card.loadingAriaLabel', { name: summary.intent_name })}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            borderRadius: '1rem',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '1.5rem',
              height: '1.5rem',
              border: '2px solid var(--md-sys-color-outline-variant, #c7c4d7)',
              borderTopColor: 'var(--md-sys-color-primary, #4343d5)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {/* Top row: icon + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', position: 'relative', zIndex: 10 }}>
        <div style={iconBoxStyle}>
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1.375rem' }}
          >
            {icon}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span style={badgeStyle}>{badge.label}</span>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', zIndex: 10 }}>
        {/* Title */}
        <p style={titleStyle}>{summary.intent_name}</p>

        {/* @-reference */}
        <div style={referenceStyle}>
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '12px', color: 'var(--md-sys-color-primary, #4343d5)' }}
          >
            alternate_email
          </span>
          <span
            style={{
              fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
              fontSize: '0.6875rem',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              fontWeight: 500,
            }}
          >
            {reference}
          </span>
        </div>

        {/* Version badge */}
        <span
          data-testid="library-card-version"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.125rem 0.5rem',
            borderRadius: 'var(--radius-sm, 0.25rem)',
            background: 'var(--md-sys-color-secondary-container, #babbfe)',
            color: 'var(--md-sys-color-on-secondary-container, #474984)',
            fontSize: '0.6875rem',
            fontWeight: 600,
          }}
        >
          {t('library.card.version', { version: summary.version })}
        </span>
      </div>

      {/* Footer: timestamp + action buttons */}
      <div style={footerStyle}>
        <span
          data-testid="library-card-timestamp"
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            color: 'var(--md-sys-color-on-surface-variant, #464555)',
            opacity: 0.6,
          }}
        >
          {t('library.card.updatedAt', { time: formatRelativeTime(summary.updated_at) })}
        </span>

        <div style={actionButtonsStyle}>
          {/* View button */}
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{
              fontSize: '18px',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              cursor: 'pointer',
              padding: '0.25rem',
              transition: 'color 200ms',
            }}
          >
            visibility
          </span>

          {/* Delete button */}
          <div
            role="button"
            tabIndex={0}
            data-testid="library-card-delete"
            aria-label={t('library.card.deleteAriaLabel', { name: summary.intent_name })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isDeleteHovered
                ? 'var(--md-sys-color-error, #ba1a1a)'
                : 'var(--md-sys-color-on-surface-variant, #464555)',
              transition: 'color 200ms',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(summary.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onDelete(summary.id);
              }
            }}
            onMouseEnter={() => setIsDeleteHovered(true)}
            onMouseLeave={() => setIsDeleteHovered(false)}
            onFocus={() => setIsDeleteHovered(true)}
            onBlur={() => setIsDeleteHovered(false)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 0 0 4.5 14h7a.5.5 0 0 0 .5-.5L13 4"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Open arrow button */}
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{
              fontSize: '18px',
              color: 'var(--md-sys-color-primary, #4343d5)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            arrow_forward
          </span>
        </div>
      </div>

      {/* Error message */}
      {hasError && (
        <span
          data-testid="library-card-error"
          style={{
            fontSize: '0.75rem',
            color: 'var(--md-sys-color-error, #ba1a1a)',
            marginTop: '0.25rem',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {t('library.card.errorMessage')}
        </span>
      )}
    </button>
  );
}
