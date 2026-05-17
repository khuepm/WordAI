import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArchivedVersion } from '../types/archive';

export interface VersionListItemProps {
  version: ArchivedVersion;
  onOpen: (id: string) => void;
  onCompare: (id: string) => void;
  onRestore: (id: string) => void;
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

/**
 * Determines if the Compare action should be disabled.
 * Returns true if related_current_id is null or undefined.
 */
function isCompareDisabled(relatedCurrentId: string | null | undefined): boolean {
  return relatedCurrentId === null || relatedCurrentId === undefined;
}

/**
 * VersionListItem - Row component for an archived document version.
 * Displays document icon, title, relative timestamp, archival reason,
 * and circular action buttons (Compare, Restore) on hover/focus.
 *
 * Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 12.2, 12.5
 */
export function VersionListItem({ version, onOpen, onCompare, onRestore }: VersionListItemProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const showActions = isHovered || isFocused;

  const handleCompare = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (isCompareDisabled(version.related_current_id)) {
      setCompareError(t('archive.errors.relatedDocUnavailable'));
      return;
    }
    setCompareError(null);
    onCompare(version.id);
  };

  const handleRestore = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onRestore(version.id);
  };

  const handleOpen = () => {
    onOpen(version.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <div
      role="listitem"
      aria-label={t('archive.aria.versionItem', { title: version.intent_name })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Only blur if focus leaves the entire item
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: isHovered
          ? 'var(--md-sys-color-surface-container-low)'
          : 'transparent',
        transition: 'background-color var(--transition-normal)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Document icon in rounded container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--md-sys-color-primary-fixed)',
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{
            fontSize: '1.25rem',
            color: 'var(--md-sys-color-primary)',
          }}
        >
          description
        </span>
      </div>

      {/* Title and metadata - clickable area */}
      <div
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={t('archive.aria.versionItem', { title: version.intent_name })}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {/* Title */}
        <span
          style={{
            fontFamily: 'var(--font-family-ui)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            color: 'var(--md-sys-color-on-surface)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {version.intent_name}
        </span>

        {/* Timestamp and reason */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          <span>{formatRelativeTime(version.archived_at)}</span>
          {version.archive_reason && (
            <>
              <span aria-hidden="true">·</span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '200px',
                }}
              >
                {version.archive_reason}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons - visible on hover/focus */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          opacity: showActions ? 1 : 0,
          transition: 'opacity var(--transition-normal)',
          pointerEvents: showActions ? 'auto' : 'none',
        }}
      >
        {/* Compare button */}
        <button
          type="button"
          aria-label={t('archive.actions.compare')}
          onClick={handleCompare}
          aria-disabled={isCompareDisabled(version.related_current_id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            color: isCompareDisabled(version.related_current_id)
              ? 'var(--md-sys-color-outline)'
              : 'var(--md-sys-color-primary)',
            cursor: isCompareDisabled(version.related_current_id) ? 'not-allowed' : 'pointer',
            opacity: isCompareDisabled(version.related_current_id) ? 0.5 : 1,
            transition: 'all var(--transition-normal)',
            padding: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1rem' }}
          >
            compare
          </span>
        </button>

        {/* Restore button */}
        <button
          type="button"
          aria-label={t('archive.actions.restore')}
          onClick={handleRestore}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            color: 'var(--md-sys-color-primary)',
            cursor: 'pointer',
            transition: 'all var(--transition-normal)',
            padding: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1rem' }}
          >
            restore
          </span>
        </button>
      </div>

      {/* Inline error message for compare unavailable */}
      {compareError && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: '-1.5rem',
            left: 'var(--spacing-md)',
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--md-sys-color-error)',
            whiteSpace: 'nowrap',
          }}
        >
          {compareError}
        </div>
      )}
    </div>
  );
}
