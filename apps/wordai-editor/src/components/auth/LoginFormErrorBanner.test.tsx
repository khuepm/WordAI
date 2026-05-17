/**
 * Unit tests for LoginForm error banner behavior
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm, type LoginFormProps } from './LoginForm';

// Mock dependencies
vi.mock('../../services/firebaseAuthService', () => ({
  firebaseSignIn: vi.fn(),
}));

vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  BridgeApiError: class BridgeApiError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock('../../services/authStore', () => ({
  useAuthState: () => ({
    setAccessContext: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderLoginForm(overrides: Partial<LoginFormProps> = {}) {
  const defaultProps: LoginFormProps = {
    email: 'test@example.com',
    onEmailChange: vi.fn(),
    onNavigate: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    ...overrides,
  };
  return { ...render(<LoginForm {...defaultProps} />), props: defaultProps };
}

describe('LoginForm — error banner (Req 3.1, 3.2, 3.8)', () => {
  it('renders error banner when error prop is provided (Req 3.1)', () => {
    renderLoginForm({ error: 'Invalid credentials' });

    const banner = screen.getByTestId('login-error-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass('bg-error-container');
    expect(banner).toHaveClass('text-on-error-container');
    expect(banner).toHaveClass('rounded-lg');
    expect(banner).toHaveClass('p-4');
    expect(banner).toHaveClass('mb-8');
    expect(banner).toHaveClass('flex');
    expect(banner).toHaveClass('items-start');
    expect(banner).toHaveClass('gap-3');
  });

  it('does not render error banner when error is null', () => {
    renderLoginForm({ error: null });

    expect(screen.queryByTestId('login-error-banner')).not.toBeInTheDocument();
  });

  it('does not render error banner when error is undefined (default)', () => {
    renderLoginForm();

    expect(screen.queryByTestId('login-error-banner')).not.toBeInTheDocument();
  });

  it('displays a filled error Material Symbol icon (Req 3.1)', () => {
    renderLoginForm({ error: 'Some error' });

    const banner = screen.getByTestId('login-error-banner');
    const icon = banner.querySelector('.material-symbols-rounded');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('error');
    expect(icon).toHaveClass('filled');
  });

  it('displays error text with correct styling (Req 3.2)', () => {
    renderLoginForm({ error: 'Invalid email or password' });

    const banner = screen.getByTestId('login-error-banner');
    const textEl = banner.querySelector('.font-headline.text-sm.font-medium.leading-snug');
    expect(textEl).toBeInTheDocument();
    expect(textEl).toHaveTextContent('Invalid email or password');
  });

  it('has role="alert" for accessibility', () => {
    renderLoginForm({ error: 'Error message' });

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
  });

  it('calls clearError when email input changes (Req 3.8)', () => {
    const clearError = vi.fn();
    renderLoginForm({ error: 'Some error', clearError });

    const emailInput = screen.getByRole('textbox');
    fireEvent.change(emailInput, { target: { value: 'new@email.com' } });

    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it('calls clearError when password input changes (Req 3.8)', () => {
    const clearError = vi.fn();
    renderLoginForm({ error: 'Some error', clearError });

    const passwordInput = document.querySelector('input[type="password"]')!;
    fireEvent.change(passwordInput, { target: { value: 'newpassword' } });

    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it('still calls onEmailChange when email changes with clearError', () => {
    const onEmailChange = vi.fn();
    const clearError = vi.fn();
    renderLoginForm({ error: 'Some error', onEmailChange, clearError });

    const emailInput = screen.getByRole('textbox');
    fireEvent.change(emailInput, { target: { value: 'new@email.com' } });

    expect(onEmailChange).toHaveBeenCalledWith('new@email.com');
    expect(clearError).toHaveBeenCalled();
  });

  it('does not throw when clearError is not provided and input changes', () => {
    renderLoginForm({ error: 'Some error' });

    const emailInput = screen.getByRole('textbox');
    expect(() => {
      fireEvent.change(emailInput, { target: { value: 'new@email.com' } });
    }).not.toThrow();
  });
});
