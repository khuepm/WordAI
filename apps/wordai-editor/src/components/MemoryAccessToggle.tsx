import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface MemoryAccessToggleProps {
  enabled: boolean;
  isUpdating: boolean;
  error: string | null;
  onChange: (enabled: boolean) => void;
}

/**
 * MemoryAccessToggle — Toggle switch for controlling AI memory access to an archived item.
 *
 * Behavior:
 * - Optimistic UI update on toggle
 * - Reverts on persistence failure with error message
 * - Announces state to screen readers via aria-live="polite"
 * - Operable via click and Space key
 *
 * Requirements: 10.1–10.8, 14.6
 */
export function MemoryAccessToggle({
  enabled,
  isUpdating,
  error,
  onChange,
}: MemoryAccessToggleProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderRadius: 'var(--radius-xl, 1rem)',
    backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
    border: isHovered
      ? '1px solid rgba(67, 67, 213, 0.3)'
      : '1px solid var(--md-sys-color-outline-variant, rgba(199, 196, 215, 0.3))',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
    cursor: isUpdating ? 'wait' : 'pointer',
    opacity: isUpdating ? 0.7 : 1,
  };

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: 'var(--radius-md, 0.5rem)',
    backgroundColor: enabled
      ? 'rgba(67, 67, 213, 0.08)'
      : 'var(--md-sys-color-surface-container-high, #e7e8e9)',
    flexShrink: 0,
    transition: 'var(--transition-normal, 300ms ease-in-out)',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    color: enabled
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    fontVariationSettings: enabled ? "'FILL' 1" : "'FILL' 0",
  };

  const textContainerStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-sm, 0.875rem)',
    fontWeight: 700,
    color: 'var(--md-sys-color-on-surface, #191c1d)',
    margin: 0,
    lineHeight: 'var(--line-height-tight, 1.25)',
  };

  const descriptionStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
    fontSize: 'var(--font-size-xs, 0.75rem)',
    color: 'var(--md-sys-color-on-surface-variant, #464555)',
    margin: '0.25rem 0 0 0',
    lineHeight: 'var(--line-height-normal, 1.5)',
  };

  const toggleTrackStyle: React.CSSProperties = {
    position: 'relative',
    width: '2.75rem',
    height: '1.5rem',
    borderRadius: '0.75rem',
    backgroundColor: enabled
      ? 'var(--md-sys-color-primary, #4343d5)'
      : 'var(--md-sys-color-surface-container-high, #e7e8e9)',
    border: enabled
      ? 'none'
      : '1px solid var(--md-sys-color-outline-variant, rgba(199, 196, 215, 0.5))',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
    flexShrink: 0,
    cursor: isUpdating ? 'wait' : 'pointer',
  };

  const toggleThumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: enabled ? 'calc(100% - 1.25rem - 2px)' : '2px',
    width: '1.25rem',
    height: '1.25rem',
    borderRadius: '50%',
    backgroundColor: enabled
      ? 'var(--md-sys-color-on-primary, #ffffff)'
      : 'var(--md-sys-color-on-surface-variant, #464555)',
    transition: 'var(--transition-normal, 300ms ease-in-out)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  };

  const errorStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family-label, Inter, sans-serif)',
    fontSize: 'var(--font-size-xs, 0.75rem)',
    color: 'var(--md-sys-color-error, #ba1a1a)',
    margin: '0.5rem 0 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  const handleToggle = () => {
    if (isUpdating) return;
    onChange(!enabled);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div>
      <div
        style={sectionStyle}
        role="switch"
        aria-checked={enabled}
        aria-label={t('archive.detail.memoryAccess.title')}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Memory icon */}
        <div style={iconContainerStyle}>
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={iconStyle}
          >
            memory
          </span>
        </div>

        {/* Title and description */}
        <div style={textContainerStyle}>
          <p style={titleStyle}>{t('archive.detail.memoryAccess.title')}</p>
          <p style={descriptionStyle}>{t('archive.detail.memoryAccess.description')}</p>
        </div>

        {/* Toggle switch */}
        <div style={toggleTrackStyle} aria-hidden="true">
          <div style={toggleThumbStyle} />
        </div>
      </div>

      {/* Screen reader announcement */}
      <div aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>
        {enabled
          ? t('archive.detail.memoryAccess.enabled')
          : t('archive.detail.memoryAccess.disabled')}
      </div>

      {/* Inline error message */}
      {error && (
        <p style={errorStyle} role="alert">
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '0.875rem' }}
          >
            error
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
