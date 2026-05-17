/**
 * LoginForm - Login form component rendered inside AuthModal.
 * Displays email/password inputs, submit button, and navigation links.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useState, useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { firebaseSignIn } from '../../services/firebaseAuthService';
import { login, BridgeApiError } from '../../services/authService';
import { useAuthState } from '../../services/authStore';
import {
  mapFirebaseError,
  mapNetworkError,
  mapBridgeError,
} from '../../utils/authErrorMapper';

export interface LoginFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'signup' | 'forgot-password') => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

export function LoginForm({
  email,
  onEmailChange,
  onNavigate,
  onSuccess,
  onError,
  isSubmitting,
  setIsSubmitting,
}: LoginFormProps) {
  const [password, setPassword] = useState('');
  const { t } = useTranslation();
  const { setAccessContext } = useAuthState();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side validation: non-empty email and password (Req 2.7)
    if (!email.trim()) {
      onError(t('auth.errors.emailRequired'));
      return;
    }
    if (!password) {
      onError(t('auth.errors.passwordRequired'));
      return;
    }

    setIsSubmitting(true);

    // 30-second timeout (Req 10.4)
    let timedOut = false;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        timedOut = true;
        reject(new Error('TIMEOUT'));
      }, 30_000);
    });

    try {
      // Race the login flow against the 30s timeout
      await Promise.race([
        (async () => {
          // Step 1: Firebase sign-in → get idToken (Req 2.5)
          const idToken = await firebaseSignIn(email, password);

          // Step 2: Exchange token via Bridge API → get AccessContext (Req 2.5)
          const context = await login(idToken);

          // Step 3: Update auth store (Req 2.6)
          setAccessContext(context);

          // Step 4: Close modal on success (Req 2.6)
          onSuccess();
        })(),
        timeoutPromise,
      ]);
    } catch (error: unknown) {
      // Handle timeout (Req 10.4)
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
      // Clear timeout if it hasn't fired (Req 10.5)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Heading — Req 2.1 */}
      <h2
        id="auth-modal-heading"
        className="font-headline text-[2rem] font-bold text-on-surface tracking-tight mb-8"
      >
        Đăng nhập
      </h2>

      {/* Form — Req 2.2, 2.3, 2.4, 10.1, 10.2 */}
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Form container with disabled state (Req 10.2) */}
        <div className={isSubmitting ? 'opacity-60 pointer-events-none' : ''}>
          {/* Email Field — Req 2.2 */}
          <div className="space-y-2">
            <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Email
            </label>
            <div className="input-glow-focus bg-surface-container-low rounded-lg transition-all duration-200 flex items-center h-12 px-4">
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full bg-transparent border-none outline-none ring-0 text-on-surface font-headline p-0"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password Field — Req 2.3 */}
          <div className="space-y-2 mt-6">
            <div className="flex justify-between items-end">
              <label className="block font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Mật khẩu
              </label>
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="font-headline text-xs text-primary hover:text-primary-container transition-colors font-medium"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="input-glow-focus bg-surface-container-low rounded-lg transition-all duration-200 flex items-center h-12 px-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-none outline-none ring-0 text-on-surface font-headline p-0"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Submit Button — Req 2.4, 10.1 */}
        <div className="pt-4">
          <button
            type="submit"
            className={`w-full bg-primary text-on-primary rounded-xl h-12 flex items-center justify-center gap-3 transition-all duration-200 font-headline font-semibold tracking-wide ${isSubmitting
                ? 'cursor-not-allowed'
                : 'hover:bg-primary-container hover:shadow-[0_0_12px_-2px_rgba(67,67,213,0.4)] active:bg-surface-tint'
              }`}
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <span className="material-symbols-rounded animate-spin text-on-primary">
                progress_activity
              </span>
            )}
            Đăng nhập
          </button>
        </div>
      </form>

      {/* Footer Links — Req 2.9 */}
      <div className="mt-8 text-center">
        <p className="font-headline text-sm text-on-surface-variant">
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="text-primary font-bold hover:text-primary-container transition-colors"
          >
            Đăng ký
          </button>
        </p>
      </div>
    </div>
  );
}
