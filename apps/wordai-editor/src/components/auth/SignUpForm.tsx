/**
 * SignUpForm - Sign-up form component rendered inside AuthModal.
 * Displays display name, email, password, confirm password inputs with validation,
 * submit button, and navigation link back to login.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8
 */

import { useState, useMemo, type FormEvent } from 'react';

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

    // Placeholder for task 4.2 — full submission logic will be implemented there
    setIsSubmitting(true);
    try {
      // TODO: Task 4.2 will implement:
      // 1. firebaseSignUp(email, password, displayName.trim())
      // 2. authService.login(idToken)
      // 3. setAccessContext(context)
      // 4. onSuccess()
      onSuccess();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
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
          <span className="material-symbols-rounded filled text-on-error-container">error</span>
          <span className="font-headline text-sm font-medium leading-snug">{error}</span>
        </div>
      )}

      {/* Header — Req 4.1 */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center mb-4">
          <span className="material-symbols-rounded filled text-primary text-2xl">
            edit_note
          </span>
        </div>
        <h2
          id="auth-modal-heading"
          className="font-headline text-3xl tracking-tighter font-bold text-on-surface"
        >
          Tạo tài khoản
        </h2>
        <p className="font-body text-on-surface-variant text-base mt-2">
          Đăng ký để sử dụng đầy đủ tính năng AI
        </p>
      </div>

      {/* Form — Req 4.2, 4.3, 4.4, 4.5 */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className={isSubmitting ? 'opacity-60 pointer-events-none' : ''}>
          {/* Display Name Field */}
          <div className="space-y-2">
            <label className="block font-headline text-label-md tracking-wider uppercase text-on-surface-variant">
              Tên hiển thị
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              onBlur={() => handleBlur('displayName')}
              className="w-full bg-surface-container-low border-0 rounded-lg px-4 py-3.5 text-on-surface font-headline outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme('colors.primary')]"
              autoComplete="name"
              disabled={isSubmitting}
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-label-md tracking-wider uppercase text-on-surface-variant">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => handleBlur('email')}
              className="w-full bg-surface-container-low border-0 rounded-lg px-4 py-3.5 text-on-surface font-headline outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme('colors.primary')]"
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-label-md tracking-wider uppercase text-on-surface-variant">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => handleBlur('password')}
              className="w-full bg-surface-container-low border-0 rounded-lg px-4 py-3.5 text-on-surface font-headline outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme('colors.primary')]"
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>

          {/* Confirm Password Field — Req 4.3 */}
          <div className="space-y-2 mt-5">
            <label className="block font-headline text-label-md tracking-wider uppercase text-on-surface-variant">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`w-full border-0 rounded-lg px-4 py-3.5 font-headline outline-none transition-all duration-200 ${showConfirmError
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-surface-container-low text-on-surface focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme(\'colors.primary\')]'
                  }`}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              {showConfirmError && (
                <span className="material-symbols-rounded filled text-on-error-container absolute right-4 top-1/2 -translate-y-1/2">
                  error
                </span>
              )}
            </div>
            {showConfirmError && (
              <p className="text-error text-sm font-headline">
                Mật khẩu xác nhận không khớp
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
              <span className="material-symbols-rounded animate-spin text-on-primary mr-2 inline-block align-middle">
                progress_activity
              </span>
            )}
            Tạo tài khoản
          </button>
        </div>
      </form>

      {/* Footer Link — Req 4.8 */}
      <div className="mt-8 text-center">
        <p className="font-headline text-sm text-on-surface-variant">
          Đã có tài khoản?{' '}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="text-primary font-bold hover:text-primary-container transition-colors"
          >
            Quay lại đăng nhập
          </button>
        </p>
      </div>
    </div>
  );
}
