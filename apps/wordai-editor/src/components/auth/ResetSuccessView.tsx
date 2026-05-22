/**
 * ResetSuccessView - Password reset success confirmation view rendered inside AuthModal.
 * Displays a glassmorphism container with success icon, heading, subtitle, and
 * a button to navigate back to the login form.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useTranslation } from 'react-i18next';

export interface ResetSuccessViewProps {
  onNavigate: (view: 'login') => void;
}

export function ResetSuccessView({ onNavigate }: ResetSuccessViewProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '1.5rem',
        padding: '3rem',
        boxShadow: '0 0 0 1px rgba(199, 196, 215, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1.5rem',
        position: 'relative',
      }}
    >
      {/* Top glow gradient bar — Req 6.1 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: 'linear-gradient(to right, transparent, rgba(67, 67, 213, 0.3), transparent)',
          borderRadius: '1.5rem 1.5rem 0 0',
        }}
      />

      {/* Success icon with background glow — Req 6.2 */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Glow effect behind icon */}
        <div
          style={{
            position: 'absolute',
            backgroundColor: 'rgba(67, 67, 213, 0.1)',
            borderRadius: '50%',
            filter: 'blur(20px)',
            transform: 'scale(1.5)',
            width: '80px',
            height: '80px',
          }}
        />
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '80px', color: 'var(--md-sys-color-primary, #4343d5)', position: 'relative', fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      </div>

      {/* Heading — Req 6.3 */}
      <h2
        id="auth-modal-heading"
        className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-on-surface"
      >
        {t('auth.resetSuccess.title')}
      </h2>

      {/* Subtitle — Req 6.4 */}
      <p className="font-body text-lg text-on-surface-variant">
        {t('auth.resetSuccess.subtitle')}
      </p>

      {/* Back to Login button — Req 6.5 */}
      <button
        type="button"
        onClick={() => onNavigate('login')}
        className="bg-primary text-on-primary rounded-xl font-headline text-xs tracking-[0.05em] uppercase font-bold px-10 py-4 hover:bg-primary-container hover:shadow-[0_0_20px_-2px_rgba(67,67,213,0.3)] transition-all duration-300 mt-2"
        data-testid="nav-to-login-from-success"
      >
        {t('auth.resetSuccess.backToLogin')}
      </button>
    </div>
  );
}
