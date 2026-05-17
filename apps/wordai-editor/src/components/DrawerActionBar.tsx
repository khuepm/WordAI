import { useTranslation } from 'react-i18next';

/**
 * DrawerActionBar – sticky footer with primary and secondary action buttons
 * for the Archive Detail Drawer.
 *
 * Requirements: 11.1–11.3, 11.6
 */

export interface DrawerActionBarProps {
  itemId: string;
  hasRelatedFile: boolean;
  onRestore: () => void;
  onCompare: () => void;
  onOpenReadOnly: () => void;
  onSaveToLibrary: () => void;
  onDelete: () => void;
}

export function DrawerActionBar({
  itemId,
  hasRelatedFile,
  onRestore,
  onCompare,
  onOpenReadOnly,
  onSaveToLibrary,
  onDelete,
}: DrawerActionBarProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid={`drawer-action-bar-${itemId}`}
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'color-mix(in srgb, var(--md-sys-color-surface-container-lowest, #ffffff) 90%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
        padding: '1rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
      }}
    >
      {/* Primary action row */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        {/* Restore to Drafts */}
        <button
          type="button"
          onClick={onRestore}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md, 0.5rem)',
            border: 'none',
            backgroundColor: 'var(--md-sys-color-primary, #4343d5)',
            color: 'var(--md-sys-color-on-primary, #ffffff)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-normal, all 300ms ease-in-out)',
          }}
        >
          {t('archive.actions.restoreToDrafts', 'Restore to Drafts')}
        </button>

        {/* Compare with Current */}
        <button
          type="button"
          onClick={onCompare}
          disabled={!hasRelatedFile}
          aria-disabled={!hasRelatedFile}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md, 0.5rem)',
            border: 'none',
            backgroundColor: 'var(--md-sys-color-surface-container, #edeef0)',
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            cursor: hasRelatedFile ? 'pointer' : 'not-allowed',
            opacity: hasRelatedFile ? 1 : 0.5,
            transition: 'var(--transition-normal, all 300ms ease-in-out)',
          }}
        >
          {t('archive.actions.compareWithCurrent', 'Compare with Current')}
        </button>

        {/* Open Read-only */}
        <button
          type="button"
          onClick={onOpenReadOnly}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md, 0.5rem)',
            border: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'var(--transition-normal, all 300ms ease-in-out)',
          }}
        >
          {t('archive.actions.openReadOnly', 'Open Read-only')}
        </button>
      </div>

      {/* Secondary action row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Save to Library */}
        <button
          type="button"
          onClick={onSaveToLibrary}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm, 0.375rem)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--md-sys-color-on-surface-variant, #464555)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'var(--transition-normal, all 300ms ease-in-out)',
          }}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1.25rem' }}
          >
            bookmark_add
          </span>
          {t('archive.actions.saveToLibrary', 'Save to Library')}
        </button>

        {/* Delete Permanently */}
        <button
          type="button"
          onClick={onDelete}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm, 0.375rem)',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--md-sys-color-error, #ba1a1a)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'var(--transition-normal, all 300ms ease-in-out)',
          }}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: '1.25rem' }}
          >
            delete_forever
          </span>
          {t('archive.actions.deletePermanently', 'Delete Permanently')}
        </button>
      </div>
    </div>
  );
}
