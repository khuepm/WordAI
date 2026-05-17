/**
 * DetailDrawer — Right-side overlay panel with full item details and actions.
 *
 * Slides in from right with 500ms ease-out, max-width 672px.
 * Full-screen on mobile (< 768px).
 * Renders Scrim overlay (inverse-surface/10, 2px backdrop blur).
 * Closes on Escape, Scrim click, or close button.
 * Uses useFocusTrap for keyboard focus management.
 * Renders header with archive type badge and document title.
 * Renders metadata section (archived date, reason, related current file link).
 * Renders AI summary section using useAISummary hook.
 * Scrollable content area independent of main view.
 * Displays error state with retry if item data fails to load.
 *
 * Requirements: 7.1–7.10, 8.1–8.6, 9.1–9.7, 13.5, 14.2, 14.3, 14.5
 */

import { useRef, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAISummary } from '../hooks/useAISummary';
import { MemoryAccessToggle } from './MemoryAccessToggle';
import type { ArchivedIntentDocument } from '../types/archive';

export interface DetailDrawerProps {
  isOpen: boolean;
  item: ArchivedIntentDocument | null;
  isLoading: boolean;
  loadError: string | null;
  onClose: () => void;
  onRestore: (id: string) => void;
  onCompare: (id: string) => void;
  onOpenReadOnly: (id: string) => void;
  onSaveToLibrary: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleMemoryAccess: (id: string, enabled: boolean) => void;
  onRetryLoad: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}

/** Map archive_type to display badge label key */
function getArchiveTypeBadgeKey(type: string): string {
  switch (type) {
    case 'draft':
      return 'Archived Draft';
    case 'version':
      return 'Archived Version';
    case 'project_doc':
      return 'Project Document';
    default:
      return 'Archived Item';
  }
}

export function DetailDrawer({
  isOpen,
  item,
  isLoading,
  loadError,
  onClose,
  onRestore,
  onCompare,
  onOpenReadOnly,
  onSaveToLibrary,
  onDelete,
  onToggleMemoryAccess,
  onRetryLoad,
  triggerRef,
}: DetailDrawerProps) {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Focus trap: traps focus within drawer while open
  useFocusTrap(drawerRef as React.RefObject<HTMLElement>, isOpen, triggerRef, onClose);

  // AI Summary hook
  const { state: aiSummaryState, retry: retryAISummary } = useAISummary(
    isOpen && item ? item.id : null
  );

  // Memory access toggle state
  const [memoryAccessUpdating, setMemoryAccessUpdating] = useState(false);
  const [memoryAccessError, setMemoryAccessError] = useState<string | null>(null);

  const handleMemoryAccessChange = (enabled: boolean) => {
    if (!item) return;
    setMemoryAccessUpdating(true);
    setMemoryAccessError(null);
    onToggleMemoryAccess(item.id, enabled);
    // Parent handles optimistic update; we reset local state after a short delay
    setTimeout(() => setMemoryAccessUpdating(false), 300);
  };

  // Responsive: track mobile breakpoint
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle scrim click
  const handleScrimClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  // --- Styles ---
  const scrimStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(46, 49, 50, 0.1)', // inverse-surface/10
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 1000,
  };

  const drawerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: isMobile ? '100vw' : '100%',
    maxWidth: isMobile ? '100vw' : '672px',
    backgroundColor: 'var(--md-sys-color-surface, #f8f9fa)',
    boxShadow: 'var(--shadow-ambient-strong)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideInFromRight 500ms ease-out forwards',
  };

  const closeButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '2rem',
    right: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--md-sys-color-surface-container-high)',
    color: 'var(--md-sys-color-on-surface)',
    cursor: 'pointer',
    zIndex: 10,
  };

  const headerStyle: CSSProperties = {
    padding: 'var(--spacing-xl) var(--spacing-2xl)',
    paddingRight: '5rem', // space for close button
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.75rem',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'rgba(67, 67, 213, 0.1)', // primary/10
    color: 'var(--md-sys-color-primary)',
    fontFamily: 'var(--font-family-label)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 'var(--spacing-sm)',
  };

  const titleStyle: CSSProperties = {
    fontFamily: 'var(--font-family-ui)',
    fontSize: '2rem',
    fontWeight: 800,
    color: 'var(--md-sys-color-on-surface)',
    margin: 0,
    lineHeight: 'var(--line-height-tight)',
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-xl) var(--spacing-2xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-lg)',
  };

  const metadataSectionStyle: CSSProperties = {
    backgroundColor: 'var(--md-sys-color-surface-container-low)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--spacing-md)',
  };

  const metadataLabelStyle: CSSProperties = {
    fontFamily: 'var(--font-family-label)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    color: 'var(--md-sys-color-on-surface-variant)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: '0.25rem',
  };

  const metadataValueStyle: CSSProperties = {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--md-sys-color-on-surface)',
  };

  const aiSummarySectionStyle: CSSProperties = {
    position: 'relative',
    backgroundColor: 'var(--md-sys-color-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-ambient)',
    padding: 'var(--spacing-lg)',
    overflow: 'hidden',
  };

  const aiSummaryDecorStyle: CSSProperties = {
    position: 'absolute',
    top: '-1rem',
    right: '-1rem',
    width: '6rem',
    height: '6rem',
    borderRadius: '50%',
    background: 'rgba(67, 67, 213, 0.05)', // primary/5
    filter: 'blur(20px)',
    pointerEvents: 'none',
  };

  const errorContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 'var(--spacing-2xl)',
    textAlign: 'center',
    gap: 'var(--spacing-md)',
  };

  const retryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.5rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
    color: 'var(--md-sys-color-primary)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition-normal)',
  };

  // --- Render error state ---
  if (loadError) {
    return (
      <>
        <div style={scrimStyle} onClick={handleScrimClick} aria-hidden="true" />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('archive.aria.drawer')}
          style={drawerStyle}
        >
          <button
            type="button"
            style={closeButtonStyle}
            onClick={onClose}
            aria-label={t('archive.aria.closeDrawer')}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.25rem' }}>
              close
            </span>
          </button>
          <div style={errorContainerStyle}>
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontSize: '3rem', color: 'var(--md-sys-color-error)' }}
            >
              error_outline
            </span>
            <p style={{
              fontFamily: 'var(--font-family-ui)',
              fontSize: 'var(--font-size-base)',
              color: 'var(--md-sys-color-on-surface-variant)',
              margin: 0,
            }}>
              {t('archive.errors.loadFailed', { message: loadError })}
            </p>
            <button type="button" style={retryButtonStyle} onClick={onRetryLoad}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.125rem' }}>
                refresh
              </span>
              {t('archive.retry')}
            </button>
          </div>
        </div>
      </>
    );
  }

  // --- Render loading state ---
  if (isLoading || !item) {
    return (
      <>
        <div style={scrimStyle} onClick={handleScrimClick} aria-hidden="true" />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('archive.aria.drawer')}
          style={drawerStyle}
        >
          <button
            type="button"
            style={closeButtonStyle}
            onClick={onClose}
            aria-label={t('archive.aria.closeDrawer')}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.25rem' }}>
              close
            </span>
          </button>
          <div style={errorContainerStyle}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid var(--md-sys-color-surface-container-high)',
              borderTopColor: 'var(--md-sys-color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{
              fontFamily: 'var(--font-family-ui)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--md-sys-color-on-surface-variant)',
              margin: 0,
            }}>
              {t('archive.loading')}
            </p>
          </div>
        </div>
      </>
    );
  }

  // --- Helpers ---
  const archivedDateFormatted = new Date(item.archived_at * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const reasonDisplay = item.archive_reason
    ? item.archive_reason.length > 200
      ? item.archive_reason.slice(0, 200) + '…'
      : item.archive_reason
    : t('archive.detail.reasonPlaceholder');

  const hasRelatedFile = item.related_current_id != null;
  const isCompareDisabled = !hasRelatedFile;

  // --- Render full drawer ---
  return (
    <>
      {/* Scrim overlay */}
      <div style={scrimStyle} onClick={handleScrimClick} aria-hidden="true" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('archive.aria.drawer')}
        style={drawerStyle}
      >
        {/* Close button */}
        <button
          type="button"
          style={closeButtonStyle}
          onClick={onClose}
          aria-label={t('archive.aria.closeDrawer')}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.25rem' }}>
            close
          </span>
        </button>

        {/* Header */}
        <div style={headerStyle}>
          <div style={badgeStyle}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '0.875rem' }}>
              inventory_2
            </span>
            {getArchiveTypeBadgeKey(item.archive_type)}
          </div>
          <h2 style={titleStyle}>{item.intent_name}</h2>
        </div>

        {/* Scrollable content */}
        <div style={contentStyle}>
          {/* Metadata section */}
          <section style={metadataSectionStyle}>
            {/* Archived Date */}
            <div>
              <div style={metadataLabelStyle}>{t('archive.detail.archivedDate')}</div>
              <div style={metadataValueStyle}>{archivedDateFormatted}</div>
            </div>

            {/* Reason */}
            <div>
              <div style={metadataLabelStyle}>{t('archive.detail.reason')}</div>
              <div style={{
                ...metadataValueStyle,
                color: item.archive_reason
                  ? 'var(--md-sys-color-on-surface)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}>
                {reasonDisplay}
              </div>
            </div>

            {/* Related Current File */}
            {hasRelatedFile && (
              <div style={{
                gridColumn: '1 / -1',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                paddingTop: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span className="material-symbols-outlined" aria-hidden="true" style={{
                  fontSize: '1.25rem',
                  color: 'var(--md-sys-color-primary)',
                }}>
                  description
                </span>
                <div>
                  <div style={metadataLabelStyle}>{t('archive.detail.relatedCurrentFile')}</div>
                  <button
                    type="button"
                    onClick={() => onCompare(item.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      fontFamily: 'var(--font-family-ui)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 500,
                      color: 'var(--md-sys-color-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {item.related_current_id}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* AI Summary section */}
          <section style={aiSummarySectionStyle}>
            <div style={aiSummaryDecorStyle} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: 'var(--spacing-md)',
            }}>
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{
                  fontSize: '1.25rem',
                  color: 'var(--md-sys-color-primary)',
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                auto_awesome
              </span>
              <h3 style={{
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                margin: 0,
              }}>
                {t('archive.detail.aiSummary.title')}
              </h3>
            </div>

            {/* AI Summary content */}
            {aiSummaryState.status === 'loading' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  border: '2px solid var(--md-sys-color-surface-container-high)',
                  borderTopColor: 'var(--md-sys-color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{
                  fontFamily: 'var(--font-family-content)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--md-sys-color-on-surface-variant)',
                }}>
                  {t('archive.detail.aiSummary.generating')}
                </span>
              </div>
            )}

            {aiSummaryState.status === 'success' && aiSummaryState.text && (
              <p style={{
                fontFamily: 'var(--font-family-content)',
                fontSize: 'var(--font-size-base)',
                lineHeight: 'var(--line-height-relaxed)',
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: 0,
              }}>
                {aiSummaryState.text}
              </p>
            )}

            {aiSummaryState.status === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{
                  fontFamily: 'var(--font-family-content)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  margin: 0,
                }}>
                  {t('archive.detail.aiSummary.unavailable')}
                </p>
                <button
                  type="button"
                  onClick={retryAISummary}
                  disabled={aiSummaryState.retryCount >= 3}
                  style={{
                    ...retryButtonStyle,
                    alignSelf: 'flex-start',
                    opacity: aiSummaryState.retryCount >= 3 ? 0.5 : 1,
                    cursor: aiSummaryState.retryCount >= 3 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1rem' }}>
                    refresh
                  </span>
                  {t('archive.detail.aiSummary.retry')}
                </button>
              </div>
            )}

            {aiSummaryState.status === 'idle' && (
              <p style={{
                fontFamily: 'var(--font-family-content)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: 0,
                fontStyle: 'italic',
              }}>
                {t('archive.detail.aiSummary.generating')}
              </p>
            )}
          </section>

          {/* Memory Access Toggle section */}
          <MemoryAccessToggle
            enabled={item.memory_access_enabled}
            isUpdating={memoryAccessUpdating}
            error={memoryAccessError}
            onChange={handleMemoryAccessChange}
          />
        </div>

        {/* Sticky footer action bar */}
        <div style={{
          borderTop: '1px solid var(--md-sys-color-outline-variant)',
          padding: 'var(--spacing-md) var(--spacing-2xl)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          {/* Primary action row */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              onClick={() => onRestore(item.id)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
              }}
            >
              {t('archive.actions.restoreToDrafts')}
            </button>
            <button
              type="button"
              onClick={() => onCompare(item.id)}
              disabled={isCompareDisabled}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface)',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                cursor: isCompareDisabled ? 'not-allowed' : 'pointer',
                opacity: isCompareDisabled ? 0.5 : 1,
                transition: 'var(--transition-normal)',
              }}
            >
              {t('archive.actions.compareWithCurrent')}
            </button>
            <button
              type="button"
              onClick={() => onOpenReadOnly(item.id)}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                color: 'var(--md-sys-color-on-surface)',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('archive.actions.openReadOnly')}
            </button>
          </div>

          {/* Secondary action row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onSaveToLibrary(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.125rem' }}>
                bookmark_add
              </span>
              {t('archive.actions.saveToLibrary')}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                color: 'var(--md-sys-color-error)',
                fontFamily: 'var(--font-family-ui)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'var(--transition-normal)',
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '1.125rem' }}>
                delete_forever
              </span>
              {t('archive.actions.deletePermanently')}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe animations injected via style tag */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
