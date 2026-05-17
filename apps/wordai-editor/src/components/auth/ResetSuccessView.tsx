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
    <div className="bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[24px] p-12 ring-1 ring-outline-variant/15 flex flex-col items-center text-center gap-6">
      {/* Top glow gradient bar — Req 6.1 */}
      <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent h-1 rounded-t-[24px]" />

      {/* Success icon with background glow — Req 6.2 */}
      <div className="relative flex items-center justify-center">
        {/* Glow effect behind icon */}
        <div className="absolute bg-primary/10 rounded-full blur-[20px] scale-150 w-[80px] h-[80px]" />
        <span
          className="material-symbols-rounded text-[80px] text-primary relative"
          style={{ fontVariationSettings: "'FILL' 1" }}
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
