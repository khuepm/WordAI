/**
 * Unit tests for ResetSuccessView component
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResetSuccessView, type ResetSuccessViewProps } from './ResetSuccessView';

function renderResetSuccessView(overrides: Partial<ResetSuccessViewProps> = {}) {
  const defaultProps: ResetSuccessViewProps = {
    onNavigate: vi.fn(),
    ...overrides,
  };
  return { ...render(<ResetSuccessView {...defaultProps} />), props: defaultProps };
}

describe('ResetSuccessView — container styling (Req 6.1)', () => {
  it('renders a glassmorphism container with correct classes', () => {
    renderResetSuccessView();

    const container = screen.getByRole('heading', { level: 2 }).closest('div');
    expect(container).toHaveClass('bg-surface-container-lowest/80');
    expect(container).toHaveClass('backdrop-blur-[20px]');
    expect(container).toHaveClass('rounded-[24px]');
    expect(container).toHaveClass('p-12');
    expect(container).toHaveClass('ring-1');
    expect(container).toHaveClass('ring-outline-variant/15');
  });

  it('renders a top glow gradient bar', () => {
    const { container } = renderResetSuccessView();

    const glowBar = container.querySelector('.bg-gradient-to-r.from-transparent.via-primary\\/30.to-transparent.h-1');
    expect(glowBar).toBeInTheDocument();
  });
});

describe('ResetSuccessView — success icon (Req 6.2)', () => {
  it('renders a filled check_circle icon at 80px in primary color', () => {
    renderResetSuccessView();

    const icon = screen.getByText('check_circle');
    expect(icon).toHaveClass('text-[80px]');
    expect(icon).toHaveClass('text-primary');
    expect(icon).toHaveStyle({ fontVariationSettings: "'FILL' 1" });
  });

  it('renders a background glow behind the icon', () => {
    const { container } = renderResetSuccessView();

    const glow = container.querySelector('.bg-primary\\/10.rounded-full.blur-\\[20px\\].scale-150');
    expect(glow).toBeInTheDocument();
  });
});

describe('ResetSuccessView — heading (Req 6.3)', () => {
  it('displays the success heading with correct text', () => {
    renderResetSuccessView();

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Đã gửi email thành công!');
  });

  it('has correct styling classes on heading', () => {
    renderResetSuccessView();

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('font-headline');
    expect(heading).toHaveClass('font-bold');
    expect(heading).toHaveClass('tracking-tight');
  });
});

describe('ResetSuccessView — subtitle (Req 6.4)', () => {
  it('displays the subtitle text', () => {
    renderResetSuccessView();

    expect(screen.getByText('Vui lòng kiểm tra hòm thư của bạn.')).toBeInTheDocument();
  });

  it('has correct styling classes on subtitle', () => {
    renderResetSuccessView();

    const subtitle = screen.getByText('Vui lòng kiểm tra hòm thư của bạn.');
    expect(subtitle).toHaveClass('font-body');
    expect(subtitle).toHaveClass('text-lg');
    expect(subtitle).toHaveClass('text-on-surface-variant');
  });
});

describe('ResetSuccessView — back to login button (Req 6.5)', () => {
  it('renders the back to login button with correct text', () => {
    renderResetSuccessView();

    const button = screen.getByTestId('nav-to-login-from-success');
    expect(button).toHaveTextContent('Về trang Đăng nhập');
  });

  it('has correct styling classes on button', () => {
    renderResetSuccessView();

    const button = screen.getByTestId('nav-to-login-from-success');
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-on-primary');
    expect(button).toHaveClass('rounded-xl');
    expect(button).toHaveClass('font-headline');
    expect(button).toHaveClass('text-xs');
    expect(button).toHaveClass('uppercase');
    expect(button).toHaveClass('font-bold');
    expect(button).toHaveClass('px-10');
    expect(button).toHaveClass('py-4');
  });

  it('calls onNavigate with "login" when clicked', () => {
    const onNavigate = vi.fn();
    renderResetSuccessView({ onNavigate });

    const button = screen.getByTestId('nav-to-login-from-success');
    fireEvent.click(button);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('login');
  });
});
