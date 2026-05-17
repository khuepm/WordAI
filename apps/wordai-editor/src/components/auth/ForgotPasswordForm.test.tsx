/**
 * Unit tests for ForgotPasswordForm submission logic
 * Requirements: 5.6, 5.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ForgotPasswordForm, type ForgotPasswordFormProps } from './ForgotPasswordForm';

// Mock dependencies
vi.mock('../../services/firebaseAuthService', () => ({
  firebaseResetPassword: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { firebaseResetPassword } from '../../services/firebaseAuthService';

const mockFirebaseResetPassword = firebaseResetPassword as ReturnType<typeof vi.fn>;

function renderForgotPasswordForm(overrides: Partial<ForgotPasswordFormProps> = {}) {
  const defaultProps: ForgotPasswordFormProps = {
    email: '',
    onEmailChange: vi.fn(),
    onNavigate: vi.fn(),
    onError: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    ...overrides,
  };
  return { ...render(<ForgotPasswordForm {...defaultProps} />), props: defaultProps };
}

describe('ForgotPasswordForm — submission validation (Req 5.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when email is empty on submit', async () => {
    const onError = vi.fn();
    renderForgotPasswordForm({ email: '', onError });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onError).toHaveBeenCalledWith('auth.errors.emailRequired');
    expect(mockFirebaseResetPassword).not.toHaveBeenCalled();
  });

  it('shows error when email is only whitespace on submit', async () => {
    const onError = vi.fn();
    renderForgotPasswordForm({ email: '   ', onError });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onError).toHaveBeenCalledWith('auth.errors.emailRequired');
    expect(mockFirebaseResetPassword).not.toHaveBeenCalled();
  });
});

describe('ForgotPasswordForm — successful submission (Req 5.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls firebaseResetPassword and navigates to reset-success on success', async () => {
    mockFirebaseResetPassword.mockResolvedValue(undefined);
    const onNavigate = vi.fn();
    const setIsSubmitting = vi.fn();

    renderForgotPasswordForm({
      email: 'user@example.com',
      onNavigate,
      setIsSubmitting,
    });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockFirebaseResetPassword).toHaveBeenCalledWith('user@example.com');
    expect(onNavigate).toHaveBeenCalledWith('reset-success');
    expect(setIsSubmitting).toHaveBeenCalledWith(true);
    expect(setIsSubmitting).toHaveBeenCalledWith(false);
  });

  it('trims email before calling firebaseResetPassword', async () => {
    mockFirebaseResetPassword.mockResolvedValue(undefined);

    renderForgotPasswordForm({ email: '  user@example.com  ' });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockFirebaseResetPassword).toHaveBeenCalledWith('user@example.com');
  });
});

describe('ForgotPasswordForm — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows mapped Firebase error on failure', async () => {
    mockFirebaseResetPassword.mockRejectedValue({ code: 'auth/user-not-found' });
    const onError = vi.fn();
    const onNavigate = vi.fn();

    renderForgotPasswordForm({
      email: 'user@example.com',
      onError,
      onNavigate,
    });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onError).toHaveBeenCalledWith('auth.errors.userNotFound');
    expect(onNavigate).not.toHaveBeenCalledWith('reset-success');
  });

  it('shows network error message on network failure', async () => {
    mockFirebaseResetPassword.mockRejectedValue({ code: 'auth/network-request-failed' });
    const onError = vi.fn();

    renderForgotPasswordForm({
      email: 'user@example.com',
      onError,
    });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onError).toHaveBeenCalledWith('auth.errors.networkError');
  });

  it('shows generic error for unknown errors', async () => {
    mockFirebaseResetPassword.mockRejectedValue(new Error('Something unexpected'));
    const onError = vi.fn();

    renderForgotPasswordForm({
      email: 'user@example.com',
      onError,
    });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onError).toHaveBeenCalledWith('auth.errors.generic');
  });

  it('sets isSubmitting false after error', async () => {
    mockFirebaseResetPassword.mockRejectedValue({ code: 'auth/too-many-requests' });
    const setIsSubmitting = vi.fn();

    renderForgotPasswordForm({
      email: 'user@example.com',
      setIsSubmitting,
    });

    const submitButton = screen.getByRole('button', { name: /gửi email khôi phục/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(setIsSubmitting).toHaveBeenCalledWith(true);
    expect(setIsSubmitting).toHaveBeenCalledWith(false);
  });
});

describe('ForgotPasswordForm — error banner display', () => {
  it('displays error banner when error prop is provided', () => {
    renderForgotPasswordForm({ error: 'Some error message' });

    const banner = screen.getByTestId('forgot-password-error-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('Some error message')).toBeInTheDocument();
  });

  it('does not display error banner when error is null', () => {
    renderForgotPasswordForm({ error: null });

    expect(screen.queryByTestId('forgot-password-error-banner')).not.toBeInTheDocument();
  });

  it('clears error when email input changes', () => {
    const clearError = vi.fn();
    renderForgotPasswordForm({ error: 'Some error', clearError });

    const emailInput = screen.getByLabelText(/email liên kết/i);
    fireEvent.change(emailInput, { target: { value: 'new@email.com' } });

    expect(clearError).toHaveBeenCalled();
  });
});
