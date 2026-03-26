/**
 * TopNavBar - Application top navigation bar
 * Requirements: 18.1, 19.2
 */

interface TopNavBarProps {
  documentTitle: string;
  hasUnsavedChanges: boolean;
  onNew: () => void;
  onSave: () => void;
}

export function TopNavBar({ documentTitle, hasUnsavedChanges, onNew, onSave }: TopNavBarProps) {
  return (
    <div
      data-testid="top-nav-bar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-lg)',
        background: 'rgba(254, 247, 255, 0.82)',
        backdropFilter: `blur(var(--glass-blur))`,
        WebkitBackdropFilter: `blur(var(--glass-blur))`,
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-ambient)',
        fontFamily: 'var(--font-family-ui)',
      }}
    >
      {/* Left: App title */}
      <span
        data-testid="app-title"
        style={{
          fontWeight: 700,
          fontSize: 'var(--font-size-base)',
          color: 'var(--md-sys-color-primary)',
          letterSpacing: '0.02em',
          minWidth: '80px',
        }}
      >
        WordAI
      </span>

      {/* Center: Document title */}
      <span
        data-testid="document-title"
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--md-sys-color-on-surface-variant)',
          fontWeight: 500,
          flex: 1,
          textAlign: 'center',
        }}
      >
        {documentTitle}
        {hasUnsavedChanges && (
          <span
            data-testid="unsaved-indicator"
            style={{ marginLeft: '4px', color: 'var(--md-sys-color-primary)' }}
            aria-label="unsaved changes"
          >
            •
          </span>
        )}
      </span>

      {/* Right: Menu buttons */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', minWidth: '80px', justifyContent: 'flex-end' }}>
        <button
          data-testid="new-button"
          onClick={onNew}
          style={{
            background: 'transparent',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: 'var(--font-family-ui)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--md-sys-color-on-surface-variant)',
            transition: 'var(--transition-fast)',
          }}
        >
          New
        </button>
        <button
          data-testid="save-button"
          onClick={onSave}
          style={{
            background: 'var(--md-sys-color-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: 'var(--font-family-ui)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--md-sys-color-on-primary)',
            transition: 'var(--transition-fast)',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default TopNavBar;
