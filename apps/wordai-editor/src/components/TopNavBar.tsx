/**
 * TopNavBar - Application top navigation bar
 * Requirements: 18.1, 19.2
 */

import { UserAvatar } from './UserAvatar';
import { useState, useRef, useEffect } from 'react';

interface TopNavBarProps {
  documentTitle: string;
  hasUnsavedChanges: boolean;
  onNew: () => void;
  onSave: () => void;
  onOpenPreferences?: () => void;
  /** Authenticated user's display name; omit for anonymous/guest. */
  userName?: string;
}

export function TopNavBar({ documentTitle, hasUnsavedChanges, onNew, onSave, onOpenPreferences, userName }: TopNavBarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            onClick={onOpenPreferences}
            title="Preferences"
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
          {/*<UserAvatar name={userName} size={32} />*/}
          <div ref={userMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              style={{
                background: isUserMenuOpen ? 'rgba(255,255,255,0.5)' : 'none',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isUserMenuOpen ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                boxShadow: isUserMenuOpen ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <span className="material-symbols-outlined">account_circle</span>
            </button>

            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  width: '260px',
                  backgroundColor: 'color-mix(in srgb, var(--md-sys-color-surface-container-lowest, #ffffff) 80%, transparent)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 40px 60px -5px color-mix(in srgb, var(--md-sys-color-on-surface, #191c1d) 4%, transparent)',
                  borderRadius: 'var(--radius-md, 0.75rem)',
                  border: '1px solid color-mix(in srgb, var(--md-sys-color-outline-variant, #c7c4d7) 15%, transparent)',
                  padding: 'var(--spacing-4, 1.4rem)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-3, 1rem)',
                  zIndex: 200,
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  padding: '1rem',
                  backgroundColor: 'var(--md-sys-color-surface-container-low, #f0f1f3)',
                  borderRadius: 'var(--radius-sm, 0.5rem)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface, #191c1d)', fontFamily: 'var(--font-family-ui)' }}>
                    Digital Curator
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant, #40484c)', fontFamily: 'var(--font-family-ui)' }}>
                    curator@ethereal.editor
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      borderRadius: 'var(--radius-sm, 0.25rem)',
                      color: 'var(--md-sys-color-on-surface, #191c1d)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontFamily: 'var(--font-family-ui)',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--md-sys-color-surface-container-low, #f0f1f3)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>person</span>
                    Profile
                  </button>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      borderRadius: 'var(--radius-sm, 0.25rem)',
                      color: 'var(--md-sys-color-on-surface, #191c1d)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontFamily: 'var(--font-family-ui)',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--md-sys-color-surface-container-low, #f0f1f3)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>workspace_premium</span>
                    Subscription
                  </button>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      borderRadius: 'var(--radius-sm, 0.25rem)',
                      color: 'var(--md-sys-color-error, #ba1a1a)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontFamily: 'var(--font-family-ui)',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--md-sys-color-error-container, #ffdad6)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Divider */}
      <div style={{ position: 'fixed', top: 'var(--topnav-height)', left: 0, right: 0, height: '1px', background: 'var(--md-sys-color-surface-container)', zIndex: 50 }} />
    </>
  );
}

export default TopNavBar;
