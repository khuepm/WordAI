/**
 * ForgotPasswordForm - Forgot password form component rendered inside AuthModal.
 * Displays a glass panel with email input for requesting a password reset email.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { firebaseResetPassword } from '../../services/firebaseAuthService';
import { mapFirebaseError, mapNetworkError } from '../../utils/authErrorMapper';

export interface ForgotPasswordFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'login' | 'reset-success') => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  /** Current error message to display in the error banner */
  error?: string | null;
  /** Callback to clear the error banner */
  clearError?: () => void;
}

export function ForgotPasswordForm({
  email,
  onEmailChange,
  onNavigate,
  onError,
  isSubmitting,
  setIsSubmitting,
  error = null,
  clearError,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();

  const handleEmailChange = (value: string) => {
    onEmailChange(value);
    if (clearError) clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate non-empty email (Req 5.7)
    if (!email.trim()) {
      onError(t('auth.errors.emailRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Call Firebase sendPasswordResetEmail (Req 5.6)
      await firebaseResetPassword(email.trim());

      // On success: navigate to reset-success view
      onNavigate('reset-success');
    } catch (error: unknown) {
      // Check for network errors first
      const networkMsg = mapNetworkError(error, t);
      if (networkMsg) {
        onError(networkMsg);
        return;
      }

      // Firebase errors (have a `code` property)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'string'
      ) {
        onError(mapFirebaseError((error as { code: string }).code, t));
        return;
      }

      // Generic fallback
      onError(t('auth.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-[20px] border border-outline-variant/15 rounded-xl p-10 flex flex-col gap-8 relative">
      {/* Error Banner */}
      {error && (
        <div
          className="bg-error-container text-on-error-container rounded-lg p-4 flex items-start gap-3"
          role="alert"
          data-testid="forgot-password-error-banner"
        >
          <span className="material-symbols-rounded filled text-on-error-container">error</span>
          <span className="font-headline text-sm font-medium leading-snug">{error}</span>
        </div>
      )}

      {/* Header Section — Req 5.2 */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="material-symbols-rounded text-primary text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            lock_reset
          </span>
          <h2
            id="auth-modal-heading"
            className="font-headline font-bold text-2xl tracking-tight text-on-surface"
          >
            {t('auth.forgotPassword.title')}
          </h2>
        </div>
        <p className="font-body text-on-surface-variant leading-relaxed">
          {t('auth.forgotPassword.description')}
        </p>
      </header>

      {/* Form Section — Req 5.3, 5.4, 5.5 */}
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className={isSubmitting ? 'opacity-60 pointer-events-none' : ''}>
          {/* Email Field — Req 5.3 */}
          <div className="flex flex-col gap-2">
            <label
              className="font-headline text-label-md uppercase tracking-wider text-on-surface-variant font-semibold"
              htmlFor="forgot-password-email"
            >
              {t('auth.forgotPassword.emailLabel')}
            </label>
            <div className="relative">
              <span
                className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                mail
              </span>
              <input
                id="forgot-password-email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="fluid-input w-full rounded-lg py-4 pl-12 pr-4 font-body text-base text-on-surface placeholder:text-outline"
                placeholder="ví dụ: ten@domain.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Actions — Req 5.4, 5.5 */}
        <div className="flex flex-col gap-4 mt-4">
          {/* Submit Button — Req 5.4 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`fluid-button w-full rounded-md py-4 px-6 font-headline font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${isSubmitting ? 'cursor-not-allowed' : ''
              }`}
          >
            {isSubmitting && (
              <span className="material-symbols-rounded animate-spin text-on-primary">
                progress_activity
              </span>
            )}
            {t('auth.forgotPassword.submit')}
            <span className="material-symbols-rounded text-lg">arrow_forward</span>
          </button>

          {/* Back Link — Req 5.5 */}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="text-center font-headline text-sm text-primary hover:text-primary-container transition-colors py-2 flex items-center justify-center gap-1 group"
          >
            <span className="material-symbols-rounded text-sm group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
            {t('auth.forgotPassword.backToLogin')}
          </button>
        </div>
      </form>
    </div>
  );
}
