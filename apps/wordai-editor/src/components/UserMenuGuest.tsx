/**
 * UserMenuGuest - Guest user menu popover content.
 * Displays an info banner inviting the user to sign in, a Sign In / Sign Up button,
 * and an Explore Features link.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { useTranslation } from 'react-i18next';

export interface UserMenuGuestProps {
  onSignIn: () => void;
  onExploreFeatures?: () => void;
}

export function UserMenuGuest({ onSignIn, onExploreFeatures }: UserMenuGuestProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="user-menu-guest"
      style={{
        width: '340px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '1.25rem',
        border: '1px solid rgba(199, 196, 215, 0.15)',
        boxShadow: '0 24px 60px -10px rgba(25, 28, 29, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Info Banner Section — tonal shift using primary color family */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(67, 67, 213, 0.05)',
          borderBottom: '1px solid rgba(199, 196, 215, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              marginTop: '2px',
              flexShrink: 0,
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(67, 67, 213, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                color: 'var(--md-sys-color-primary, #4343d5)',
                fontSize: '1.125rem',
                fontVariationSettings: "'FILL' 1",
              }}
            >
              auto_awesome
            </span>
          </div>
          <p
            style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              lineHeight: 1.6,
              color: 'var(--md-sys-color-on-surface-variant, #464555)',
              margin: 0,
              fontFamily: 'var(--font-family-ui)',
            }}
          >
            {t('userMenu.guestBanner')}
          </p>
        </div>
      </div>

      {/* Action Section — Fluid Button */}
      <div style={{ padding: '1.25rem' }}>
        <button
          type="button"
          onClick={onSignIn}
          data-testid="user-menu-signin-button"
          style={{
            width: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--md-sys-color-primary, #4343d5)',
            color: 'var(--md-sys-color-on-primary, #ffffff)',
            padding: '0.875rem 1.25rem',
            borderRadius: '0.75rem',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            letterSpacing: '0.025em',
            cursor: 'pointer',
            fontFamily: 'var(--font-family-ui)',
            transition: 'all 0.3s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--md-sys-color-primary-container, #5d5fef)';
            e.currentTarget.style.boxShadow = '0 0 16px rgba(67, 67, 213, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--md-sys-color-primary, #4343d5)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span>{t('userMenu.signInSignUp')}</span>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '1.125rem' }}
          >
            arrow_right_alt
          </span>
        </button>

        {/* Secondary subtle link */}
        {onExploreFeatures && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onExploreFeatures}
              data-testid="user-menu-explore-button"
              style={{
                display: 'inline-flex',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--md-sys-color-outline, #767586)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = 'var(--md-sys-color-primary, #4343d5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--md-sys-color-outline, #767586)';
              }}
            >
              {t('userMenu.exploreFeatures')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
