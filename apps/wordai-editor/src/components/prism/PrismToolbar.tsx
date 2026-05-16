/**
 * PrismToolbar — Header chung cho PrismCanvas.
 * Chứa nút thêm variant, toggle sync scroll, và hiển thị số variant hiện tại.
 *
 * Requirements: 1.5, 9.3
 */

import { Tooltip } from '../Tooltip';

export interface PrismToolbarProps {
  /** Số variant đang active */
  variantCount: number;
  /** Số variant tối đa cho phép */
  maxVariants: number;
  /** Trạng thái đồng bộ scroll giữa các pane */
  syncScroll: boolean;
  /** Callback khi nhấn nút "+ Variant" */
  onAddVariant: () => void;
  /** Callback khi toggle sync scroll */
  onToggleSyncScroll: () => void;
}

export function PrismToolbar({
  variantCount,
  maxVariants,
  syncScroll,
  onAddVariant,
  onToggleSyncScroll,
}: PrismToolbarProps) {
  const isMaxReached = variantCount >= maxVariants;

  const addButton = (
    <button
      onClick={onAddVariant}
      disabled={isMaxReached}
      aria-label={isMaxReached ? 'Tối đa 3 biến thể' : 'Thêm biến thể mới'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        background: isMaxReached
          ? 'var(--md-sys-color-surface-container)'
          : 'var(--md-sys-color-primary)',
        color: isMaxReached
          ? 'var(--md-sys-color-outline)'
          : 'var(--md-sys-color-on-primary)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        fontFamily: 'var(--font-family-ui)',
        cursor: isMaxReached ? 'not-allowed' : 'pointer',
        opacity: isMaxReached ? 0.6 : 1,
        transition: 'var(--transition-fast)',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '18px' }}
      >
        add
      </span>
      Variant
    </button>
  );

  return (
    <div
      className="prism-toolbar"
      role="toolbar"
      aria-label="Prism variant toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid var(--md-sys-color-outline-variant)',
        background: 'var(--md-sys-color-surface-container-low)',
        fontFamily: 'var(--font-family-ui)',
      }}
    >
      {/* Left section: Add variant button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {isMaxReached ? (
          <Tooltip text="Tối đa 3 biến thể" position="bottom">
            {addButton}
          </Tooltip>
        ) : (
          addButton
        )}
      </div>

      {/* Right section: Variant count + Sync scroll toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Variant count indicator */}
        <span
          aria-label={`${variantCount} trên ${maxVariants} biến thể`}
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {variantCount}/{maxVariants} variants
        </span>

        {/* Sync scroll toggle */}
        <Tooltip
          text={syncScroll ? 'Tắt đồng bộ scroll' : 'Bật đồng bộ scroll'}
          position="bottom"
        >
          <button
            onClick={onToggleSyncScroll}
            aria-label={syncScroll ? 'Tắt đồng bộ scroll' : 'Bật đồng bộ scroll'}
            aria-pressed={syncScroll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: syncScroll
                ? 'var(--md-sys-color-primary-container)'
                : 'transparent',
              color: syncScroll
                ? 'var(--md-sys-color-primary)'
                : 'var(--md-sys-color-on-surface-variant)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '20px',
                fontVariationSettings: syncScroll
                  ? "'FILL' 1"
                  : "'FILL' 0",
              }}
            >
              sync
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export default PrismToolbar;
