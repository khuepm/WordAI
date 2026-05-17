import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArchiveSuggestion } from '../types/archive';

export interface SuggestionCardProps {
  suggestion: ArchiveSuggestion;
  isPrimary: boolean;
  onReview: (id: string) => void;
  onCompare?: (id: string) => void;
  onRestore?: (id: string) => void;
}

/**
 * Formats a Unix timestamp (seconds) as a relative time string.
 * e.g. "2 days ago", "3 weeks ago", "just now"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  if (diff < 2592000) {
    const weeks = Math.floor(diff / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  const months = Math.floor(diff / 2592000);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

/** Maps category keys to Material Symbols icon names */
const CATEGORY_ICONS: Record<ArchiveSuggestion['category'], string> = {
  unused_concept: 'lightbulb',
  referenced_work: 'link',
  outdated_draft: 'history',
  related_research: 'science',
};

/**
 * SuggestionCard — AI-powered card displaying an archived item suggested for review.
 *
 * Variants:
 * - Primary (first card): glass-panel, --shadow-ambient-strong, primary/10 border
 * - Secondary (subsequent): glass-panel, --shadow-ambient, outline-variant/10 border
 * - "Referenced Work" category: shows "Compare" and "Restore" buttons instead of "Review" link
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 12.6, 12.7
 */
export function SuggestionCard({
  suggestion,
  isPrimary,
  onReview,
  onCompare,
  onRestore,
}: SuggestionCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const isReferencedWork = suggestion.category === 'referenced_work';

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    padding: '1.25rem',
    borderRadius: 'var(--radius-xl, 1rem)',
    backgroundColor: `rgba(255, 255, 255, var(--glass-opacity, 0.80))`,
    backdropFilter: `blur(var(--glass-blur, 20px))`,
    WebkitBackdropFilter: `blur(var(--glass-blur, 20px))`,
    border: isPrimary
      ? '1px solid rgba(67, 67, 213, 0.1)'
      : '1px solid rgba(199, 196, 215, 0.1)',
    boxShadow: isPrimary
      ? 'var(--shadow-ambient-strong, 0 40px 60px -5px rgba(67, 67, 213, 0.08))'
      : 'var(--shadow-ambient, 0 2px 12px rgba(0, 0, 0, 0.08))',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  };

  const categoryBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    borderRadius: 'var(--radius-md, 0.5rem)',
    backgroundColor: isPrimary
      ? 'rgba(67, 67, 213, 0.08)'
      : 'var(--md-sys-color-surface-container-high, #e7e8e9)',
    fontFamily: 'var(--font-family-label, Inter, sans-serif)',
    fontSize: 'var(--font-size-xs, 0.75rem)',
    fontWeight: 500,
    color: isPrimary
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    letterSpacing: '0.02em',
    width: 'fit-content',
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-base, 1rem)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface, #191c1d)',
    margin: 0,
    lineHeight: 'var(--line-height-tight, 1.25)',
  };

  const descriptionStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-content, Newsreader, serif)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    color: 'var(--md-sys-color-on-surface-variant, #464555)',
    lineHeight: 'var(--line-height-relaxed, 1.6)',
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const timestampStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-label, Inter, sans-serif)',
    fontSize: 'var(--font-size-xs, 0.75rem)',
    color: 'var(--md-sys-color-on-surface-variant, #464555)',
    opacity: 0.7,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  const actionLinkStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontWeight: 600,
    color: 'var(--md-sys-color-primary, #4343d5)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'var(--transition-fast, 150ms ease-in-out)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  const actionButtonStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontWeight: 500,
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md, 0.5rem)',
    cursor: 'pointer',
    transition: 'var(--transition-fast, 150ms ease-in-out)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    border: 'none',
  };

  return (
    <article
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={t('archive.aria.suggestionCard', { title: suggestion.title })}
      role="article"
    >
      {/* Category badge */}
      <div style={categoryBadgeStyle}>
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '0.875rem' }}
        >
          {CATEGORY_ICONS[suggestion.category]}
        </span>
        {t(`archive.categories.${suggestion.category}`)}
      </div>

      {/* Title */}
      <h3 style={titleStyle}>{suggestion.title}</h3>

      {/* Description (max 3 lines with ellipsis) */}
      <p style={descriptionStyle}>{suggestion.description}</p>

      {/* Archived date (relative time) */}
      <div style={timestampStyle}>
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '0.875rem' }}
        >
          schedule
        </span>
        <span>{formatRelativeTime(suggestion.archived_at)}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
        {isReferencedWork ? (
          <>
            <button
              type="button"
              style={{
                ...actionButtonStyle,
                backgroundColor: 'var(--md-sys-color-surface-container-low, #f3f4f5)',
                color: 'var(--md-sys-color-primary, #4343d5)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onCompare?.(suggestion.id);
              }}
              aria-label={`${t('archive.actions.compare')} ${suggestion.title}`}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: '1rem' }}
              >
                compare_arrows
              </span>
              {t('archive.actions.compare')}
            </button>
            <button
              type="button"
              style={{
                ...actionButtonStyle,
                backgroundColor: 'var(--md-sys-color-primary, #4343d5)',
                color: 'var(--md-sys-color-on-primary, #ffffff)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRestore?.(suggestion.id);
              }}
              aria-label={`${t('archive.actions.restore')} ${suggestion.title}`}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: '1rem' }}
              >
                restore
              </span>
              {t('archive.actions.restore')}
            </button>
          </>
        ) : (
          <button
            type="button"
            style={actionLinkStyle}
            onClick={(e) => {
              e.stopPropagation();
              onReview(suggestion.id);
            }}
            aria-label={`${t('archive.actions.review')} ${suggestion.title}`}
          >
            {t('archive.actions.review')}
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontSize: '1rem' }}
            >
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
