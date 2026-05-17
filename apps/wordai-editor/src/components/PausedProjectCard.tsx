import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PausedProject } from '../types/archive';

export interface PausedProjectCardProps {
  project: PausedProject;
  onOpen: (id: string) => void;
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
 * Truncates a project name at 60 characters with ellipsis.
 */
function truncateName(name: string, maxLength = 60): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength) + '…';
}

/**
 * PausedProjectCard - Folder card for a paused project collection.
 * Displays folder icon (48px rounded), project name (truncated at 60 chars),
 * document count, description (max 2 lines), relative timestamp, and "Open Folder" link.
 * Decorative 64px circle in top-right scales to 1.1x on hover (300ms ease-in-out).
 *
 * Requirements: 6.2, 6.3, 6.5, 12.1, 12.8
 */
export function PausedProjectCard({ project, onOpen }: PausedProjectCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleOpen = () => {
    onOpen(project.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <div
      role="article"
      aria-label={t('archive.aria.projectCard', { title: project.name })}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(199, 196, 215, 0.1)',
        boxShadow: 'var(--shadow-ambient)',
        padding: 'var(--spacing-lg)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'box-shadow var(--transition-normal)',
      }}
    >
      {/* Decorative 64px circle in top-right, scales to 1.1x on hover */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -12,
          right: -12,
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: 'rgba(67, 67, 213, 0.05)',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 300ms ease-in-out',
          pointerEvents: 'none',
        }}
      />

      {/* Folder icon in 48px rounded container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--md-sys-color-primary-fixed)',
          marginBottom: 'var(--spacing-md)',
          flexShrink: 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{
            fontSize: '1.5rem',
            color: 'var(--md-sys-color-primary)',
          }}
        >
          folder
        </span>
      </div>

      {/* Project name - truncated at 60 chars */}
      <p
        style={{
          fontFamily: 'var(--font-family-ui)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          color: 'var(--md-sys-color-on-surface)',
          margin: 0,
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={project.name}
      >
        {truncateName(project.name)}
      </p>

      {/* Document count */}
      <span
        style={{
          fontFamily: 'var(--font-family-label)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--md-sys-color-on-surface-variant)',
          display: 'block',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        {project.document_count} {project.document_count === 1 ? 'document' : 'documents'}
      </span>

      {/* Description - max 2 lines */}
      <p
        style={{
          fontFamily: 'var(--font-family-content)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: 'var(--line-height-normal)',
          color: 'var(--md-sys-color-on-surface-variant)',
          margin: 0,
          marginBottom: 'var(--spacing-sm)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {project.description}
      </p>

      {/* Relative timestamp */}
      <span
        style={{
          fontFamily: 'var(--font-family-label)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--md-sys-color-on-surface-variant)',
          display: 'block',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        {formatRelativeTime(project.paused_at)}
      </span>

      {/* "Open Folder" action link */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
          border: 'none',
          background: 'none',
          fontFamily: 'var(--font-family-ui)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 500,
          color: 'var(--md-sys-color-primary)',
          cursor: 'pointer',
          transition: 'opacity var(--transition-normal)',
        }}
        aria-label={t('archive.actions.openFolder')}
      >
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '1rem' }}
        >
          folder_open
        </span>
        {t('archive.actions.openFolder')}
      </button>
    </div>
  );
}
