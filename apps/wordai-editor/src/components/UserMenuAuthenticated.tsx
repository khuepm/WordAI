/**
 * UserMenuAuthenticated - Authenticated user menu popover content.
 * Displays user profile header, My Library link, and Sign Out button.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useTranslation } from 'react-i18next';

export interface UserMenuAuthenticatedProps {
  user: {
    displayName: string;
    email: string;
    avatarUrl?: string;
    plan?: string;
  };
  onSignOut: () => void;
  onOpenLibrary?: () => void;
  onOpenProfile?: () => void;
  isSigningOut?: boolean;
}

export function UserMenuAuthenticated({
  user,
  onSignOut,
  onOpenLibrary,
  onOpenProfile,
  isSigningOut = false,
}: UserMenuAuthenticatedProps) {
  const { t } = useTranslation();

  const menuItemStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    background: 'none',
    fontFamily: 'var(--font-family-ui)',
    transition: 'background-color 0.2s',
    textAlign: 'left' as const,
  };

  return (
    <div
      data-testid="user-menu-authenticated"
      style={{
        width: '320px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '0.75rem',
        outline: '1px solid rgba(199, 196, 215, 0.15)',
        boxShadow: '0 -5px 40px rgba(25, 28, 29, 0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Block — Req 7.2 */}
      <button
        type="button"
        onClick={onOpenProfile}
        data-testid="user-menu-profile-button"
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          opacity: isSigningOut ? 0.5 : 1,
          pointerEvents: isSigningOut ? 'none' : 'auto',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-low, #f3f4f5)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Avatar with online indicator */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-surface-container-low, #f3f4f5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ color: 'var(--md-sys-color-on-surface-variant, #464555)', fontSize: '1.5rem' }}
              >
                person
              </span>
            </div>
          )}
          {/* Online Status Indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '14px',
              height: '14px',
              backgroundColor: '#10b981',
              border: '2px solid #ffffff',
              borderRadius: '50%',
            }}
          />
        </div>

        {/* Name, plan badge, email */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface, #191c1d)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-family-ui)',
              }}
            >
              {user.displayName}
            </span>
            {user.plan && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(to bottom right, var(--md-sys-color-primary, #4343d5), var(--md-sys-color-primary-container, #5d5fef))',
                  color: 'var(--md-sys-color-on-primary, #ffffff)',
                  flexShrink: 0,
                }}
              >
                {user.plan}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-family-ui)',
            }}
          >
            {user.email}
          </span>
        </div>
      </button>

      {/* Separation via Tonal Shift — Req 7.3 */}
      <div style={{ height: '8px', backgroundColor: 'var(--md-sys-color-surface-container-low, #f3f4f5)' }} />

      {/* Section 1: Workspace Navigation — Req 7.4 */}
      <div style={{ padding: '0.5rem' }}>
        <button
          type="button"
          onClick={onOpenLibrary}
          data-testid="user-menu-library-button"
          style={{
            ...menuItemStyle,
            color: 'var(--md-sys-color-on-surface, #191c1d)',
            opacity: isSigningOut ? 0.5 : 1,
            pointerEvents: isSigningOut ? 'none' : 'auto',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-low, #f3f4f5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: 'var(--md-sys-color-outline, #767586)' }}
          >
            folder
          </span>
          {t('userMenu.myLibrary')}
        </button>
      </div>

      {/* Separation via Tonal Shift — Req 7.3 */}
      <div style={{ height: '8px', backgroundColor: 'var(--md-sys-color-surface-container-low, #f3f4f5)' }} />

      {/* Section 2: Sign Out — Req 7.5 */}
      <div style={{ padding: '0.5rem' }}>
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          data-testid="user-menu-signout-button"
          style={{
            ...menuItemStyle,
            color: 'var(--md-sys-color-error, #ba1a1a)',
            opacity: isSigningOut ? 0.7 : 1,
            pointerEvents: isSigningOut ? 'none' : 'auto',
          }}
          onMouseOver={(e) => {
            if (!isSigningOut) {
              e.currentTarget.style.backgroundColor = 'var(--md-sys-color-error-container, #ffdad6)';
              e.currentTarget.style.color = 'var(--md-sys-color-on-error-container, #93000a)';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--md-sys-color-error, #ba1a1a)';
          }}
        >
          {isSigningOut ? (
            <span
              className="material-symbols-outlined"
              style={{ animation: 'spin 1s linear infinite', color: 'var(--md-sys-color-error, #ba1a1a)' }}
            >
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined">logout</span>
          )}
          {t('userMenu.signOut')}
        </button>
      </div>
    </div>
  );
}
