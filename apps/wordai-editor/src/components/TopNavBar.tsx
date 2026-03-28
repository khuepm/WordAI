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
    <>
      <header
        data-testid="top-nav-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'var(--topnav-height)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          background: 'var(--md-sys-color-surface)',
          fontFamily: 'var(--font-family-ui)',
        }}
      >
        {/* Left: Logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span
            data-testid="app-title"
            style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--md-sys-color-on-surface)', letterSpacing: '-0.01em' }}
          >
            WordAI
          </span>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a
              href="#"
              style={{
                color: 'var(--md-sys-color-primary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
                textDecoration: 'none',
                borderBottom: '2px solid var(--md-sys-color-primary)',
                paddingBottom: '2px',
              }}
            >
              Drafts
            </a>
            <a href="#" style={{ color: '#5a5a5a', fontSize: 'var(--font-size-sm)', textDecoration: 'none' }}>Archive</a>
            <a href="#" style={{ color: '#5a5a5a', fontSize: 'var(--font-size-sm)', textDecoration: 'none' }}>Library</a>
          </nav>
        </div>

        {/* Center: doc title */}
        <span
          data-testid="document-title"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--md-sys-color-on-surface-variant)',
            fontWeight: 500,
          }}
        >
          {documentTitle}
          {hasUnsavedChanges && (
            <span data-testid="unsaved-indicator" style={{ marginLeft: '4px', color: 'var(--md-sys-color-primary)' }} aria-label="unsaved changes">•</span>
          )}
        </span>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            data-testid="save-button"
            onClick={onSave}
            style={{
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 16px',
              cursor: 'pointer',
              fontFamily: 'var(--font-family-ui)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            Render
          </button>
          <button
            data-testid="new-button"
            onClick={onNew}
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
            title="New document"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>
      {/* Divider */}
      <div style={{ position: 'fixed', top: 'var(--topnav-height)', left: 0, right: 0, height: '1px', background: 'var(--md-sys-color-surface-container)', zIndex: 50 }} />
    </>
  );
}

export default TopNavBar;
