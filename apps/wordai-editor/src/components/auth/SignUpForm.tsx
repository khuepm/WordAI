/**
 * SignUpForm - Sign-up form component rendered inside AuthModal.
 * Displays display name, email, password, confirm password inputs with validation,
 * submit button, and navigation link back to login.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import { useState, useMemo, useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { firebaseSignUp } from '../../services/firebaseAuthService';
import { login, BridgeApiError } from '../../services/authService';
import { useAuthState } from '../../services/authStore';
import {
  mapFirebaseError,
  mapNetworkError,
  mapBridgeError,
} from '../../utils/authErrorMapper';

export interface SignUpFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'login') => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  /** Current error message to display (Req 3.1 pattern) */
  error?: string | null;
  /** Callback to clear the error (Req 3.8 pattern) */
  clearError?: () => void;
  /** Called before setAccessContext on successful sign-up (Req 15.4 — signals upload-on-signup) */
  onBeforeSuccess?: () => void;
}

export function SignUpForm({
  email,
  onEmailChange,
  onNavigate,
  onSuccess,
  onError,
  isSubmitting,
  setIsSubmitting,
  error = null,
  clearError,
  onBeforeSuccess,
}: SignUpFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({
    displayName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const { t } = useTranslation();
  const { setAccessContext } = useAuthState();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Validation ---

  const validation = useMemo(() => {
    const trimmedName = displayName.trim();
    const nameValid = trimmedName.length >= 1 && trimmedName.length <= 100;

    // HTML5 email validation pattern
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const passwordValid = password.length >= 6;

    const confirmValid = confirmPassword.length > 0 && confirmPassword === password;

    const confirmMismatch =
      confirmPassword.length > 0 && confirmPassword !== password;

    return {
      nameValid,
      emailValid,
      passwordValid,
      confirmValid,
      confirmMismatch,
      allValid: nameValid && emailValid && passwordValid && confirmValid,
    };
  }, [displayName, email, password, confirmPassword]);

  // --- Handlers ---

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (clearError) clearError();
  };

  const handleEmailChange = (value: string) => {
    onEmailChange(value);
    if (clearError) clearError();
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (clearError) clearError();
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (clearError) clearError();
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      displayName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!validation.allValid) {
      return;
    }

    setIsSubmitting(true);

    // 30-second timeout (same pattern as LoginForm)
    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        timedOut = true;
        reject(new Error('TIMEOUT'));
      }, 30_000);
    });

    try {
      // Race the sign-up flow against the 30s timeout
      await Promise.race([
        (async () => {
          // Step 1: Firebase sign-up → get idToken (Req 4.7)
          const idToken = await firebaseSignUp(email, password, displayName.trim());

          // Step 2: Exchange token via Bridge API → get AccessContext (Req 4.6)
          const context = await login(idToken);

          // Step 3: Signal sign-up before updating store (Req 15.4 — triggers upload-on-signup)
          if (onBeforeSuccess) onBeforeSuccess();

          // Step 4: Update auth store (Req 4.6)
          setAccessContext(context);

          // Step 5: Close modal on success
          onSuccess();
        })(),
        timeoutPromise,
      ]);
    } catch (error: unknown) {
      // Handle timeout
      if (timedOut || (error instanceof Error && error.message === 'TIMEOUT')) {
        onError(t('auth.errors.timeout'));
        return;
      }

      // Check for network errors first
      const networkMsg = mapNetworkError(error, t);
      if (networkMsg) {
        onError(networkMsg);
        return;
      }

      // Bridge API errors
      if (error instanceof BridgeApiError) {
        onError(mapBridgeError(error.code, t));
        return;
      }

      // Firebase errors (have a `code` property) — handles email-already-in-use, weak-password
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
      // Clear timeout if it hasn't fired
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  // Show confirm password error only when field has been touched and there's a mismatch
  const showConfirmError = touched.confirmPassword && validation.confirmMismatch;

  return (
    <div>
      {/* Error Banner (shared pattern from LoginForm) */}
      {error && (
        <div
          className="bg-error-container text-on-error-container rounded-lg p-4 mb-8 flex items-start gap-3"
          role="alert"
          data-testid="signup-error-banner"
        >
          <span className="material-symbols-outlined filled text-on-error-container">error</span>
          <span className="font-headline text-sm font-medium leading-snug">{error}</span>
        </div>
      )}

      {/* Header — Req 4.1 */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center mb-4">
          <span className="material-symbols-outlined filled text-primary text-2xl">
            edit_note
          </span>
        </div>
        <h2
          id="auth-modal-heading"
          className="font-headline text-3xl tracking-tighter font-bold text-on-surface"
        >
          {t('auth.signup.title')}
        </h2>
        <p className="font-body text-on-surface-variant text-base mt-2">
          {t('auth.signup.subtitle')}
        </p>
      </div>

      {/* Form — Req 4.2, 4.3, 4.4, 4.5 */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className={isSubmitting ? 'opacity-60 pointer-events-none' : ''}>
          {/* Display Name Field */}
          <div className="space-y-2">
            <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('auth.signup.displayNameLabel')}
            </label>
            <div className="input-glow-focus bg-surface-container-low rounded-lg transition-all duration-200 flex items-center h-12 px-4">
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                onBlur={() => handleBlur('displayName')}
                className="w-full bg-transparent border-none outline-none ring-0 text-on-surface font-headline p-0"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('auth.signup.emailLabel')}
            </label>
            <div className="input-glow-focus bg-surface-container-low rounded-lg transition-all duration-200 flex items-center h-12 px-4">
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className="w-full bg-transparent border-none outline-none ring-0 text-on-surface font-headline p-0"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('auth.signup.passwordLabel')}
            </label>
            <div className="input-glow-focus bg-surface-container-low rounded-lg transition-all duration-200 flex items-center h-12 px-4">
              <input
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className="w-full bg-transparent border-none outline-none ring-0 text-on-surface font-headline p-0"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Confirm Password Field — Req 4.3 */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('auth.signup.confirmPasswordLabel')}
            </label>
            <div className="relative">
              <div className={`rounded-lg transition-all duration-200 flex items-center h-12 px-4 ${showConfirmError
                ? 'bg-error-container'
                : 'input-glow-focus bg-surface-container-low'
                }`}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                  className={`w-full bg-transparent border-none outline-none ring-0 font-headline p-0 ${showConfirmError ? 'text-on-error-container' : 'text-on-surface'}`}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </div>
              {showConfirmError && (
                <span className="material-symbols-outlined filled text-on-error-container absolute right-4 top-1/2 -translate-y-1/2">
                  error
                </span>
              )}
            </div>
            {showConfirmError && (
              <p className="text-error text-sm font-headline">
                {t('auth.errors.passwordMismatch')}
              </p>
            )}
          </div>
        </div>

        {/* Submit Button — Req 4.4, 4.5 */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={!validation.allValid || isSubmitting}
            className={`w-full font-headline font-bold py-4 px-6 rounded-lg transition-all duration-200 ${validation.allValid && !isSubmitting
              ? 'bg-primary text-on-primary hover:opacity-90'
              : 'bg-surface-container-highest text-outline cursor-not-allowed opacity-70'
              }`}
          >
            {isSubmitting && (
              <span className="material-symbols-outlined animate-spin text-on-primary mr-2 inline-block align-middle">
                progress_activity
              </span>
            )}
            {t('auth.signup.submit')}
          </button>
        </div>
      </form>

      {/* Footer Link — Req 4.8 */}
      <div className="mt-8 text-center">
        <p className="font-headline text-sm text-on-surface-variant">
          {t('auth.signup.hasAccount')}{' '}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="text-primary font-bold hover:text-primary-container transition-colors"
          >
            {t('auth.signup.backToLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}
