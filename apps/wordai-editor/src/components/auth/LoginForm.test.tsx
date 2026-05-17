/**
 * Unit tests for LoginForm loading state behavior
 * Requirements: 2.8, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

import { firebaseSignIn } from '../../services/firebaseAuthService';
import { login } from '../../services/authService';

const mockFirebaseSignIn = firebaseSignIn as ReturnType<typeof vi.fn>;
const mockLogin = login as ReturnType<typeof vi.fn>;

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

describe('LoginForm — loading state (Req 10.1, 10.2)', () => {
  it('shows spinning progress_activity icon when isSubmitting is true (Req 10.1)', () => {
    renderLoginForm({ isSubmitting: true });

    const spinner = screen.getByText('progress_activity');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
    expect(spinner).toHaveClass('text-on-primary');
    expect(spinner).toHaveClass('material-symbols-rounded');
  });

  it('does not show spinner when isSubmitting is false', () => {
    renderLoginForm({ isSubmitting: false });

    expect(screen.queryByText('progress_activity')).not.toBeInTheDocument();
  });

  it('adds cursor-not-allowed to button when isSubmitting (Req 10.1)', () => {
    renderLoginForm({ isSubmitting: true });

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton).toHaveClass('cursor-not-allowed');
  });

  it('removes hover effects from button when isSubmitting (Req 10.1)', () => {
    renderLoginForm({ isSubmitting: true });

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton!.className).not.toContain('hover:bg-primary-container');
  });

  it('applies opacity-60 pointer-events-none to form container when isSubmitting (Req 10.2)', () => {
    const { container } = renderLoginForm({ isSubmitting: true });

    const disabledContainer = container.querySelector('.opacity-60.pointer-events-none');
    expect(disabledContainer).toBeInTheDocument();
  });

  it('does not apply opacity-60 pointer-events-none when not submitting', () => {
    const { container } = renderLoginForm({ isSubmitting: false });

    const disabledContainer = container.querySelector('.opacity-60.pointer-events-none');
    expect(disabledContainer).not.toBeInTheDocument();
  });

  it('disables submit button when isSubmitting', () => {
    renderLoginForm({ isSubmitting: true });

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeDisabled();
  });
});

describe('LoginForm — 30-second timeout (Req 10.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows timeout error after 30 seconds (Req 10.4)', async () => {
    // Make firebaseSignIn hang forever
    mockFirebaseSignIn.mockImplementation(
      () => new Promise(() => { }) // never resolves
    );

    const onError = vi.fn();
    const setIsSubmitting = vi.fn();

    renderLoginForm({
      email: 'test@example.com',
      onError,
      setIsSubmitting,
      isSubmitting: false,
    });

    // Type a password so validation passes
    const passwordInput = document.querySelector('input[type="password"]')!;
    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    });

    // Submit the form
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit')!;
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Advance time by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // Should call onError with timeout message
    expect(onError).toHaveBeenCalledWith('auth.errors.timeout');
    // Should re-enable form
    expect(setIsSubmitting).toHaveBeenCalledWith(false);
  });

  it('clears timeout on successful login (Req 10.5)', async () => {
    mockFirebaseSignIn.mockResolvedValue('mock-token');
    mockLogin.mockResolvedValue({ userId: '123', roles: [] });

    const onError = vi.fn();
    const onSuccess = vi.fn();
    const setIsSubmitting = vi.fn();

    renderLoginForm({
      email: 'test@example.com',
      onError,
      onSuccess,
      setIsSubmitting,
      isSubmitting: false,
    });

    // Type a password so validation passes
    const passwordInput = document.querySelector('input[type="password"]')!;
    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    });

    // Submit the form
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit')!;
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for the async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should not show timeout error
    expect(onError).not.toHaveBeenCalledWith('auth.errors.timeout');
    // Should call onSuccess
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls setIsSubmitting(true) on submit and setIsSubmitting(false) after completion', async () => {
    mockFirebaseSignIn.mockResolvedValue('mock-token');
    mockLogin.mockResolvedValue({ userId: '123', roles: [] });

    const setIsSubmitting = vi.fn();

    renderLoginForm({
      email: 'test@example.com',
      setIsSubmitting,
      isSubmitting: false,
    });

    // Type a password so validation passes
    const passwordInput = document.querySelector('input[type="password"]')!;
    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    });

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find((b) => b.getAttribute('type') === 'submit')!;
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(setIsSubmitting).toHaveBeenCalledWith(true);
    expect(setIsSubmitting).toHaveBeenCalledWith(false);
  });
});
