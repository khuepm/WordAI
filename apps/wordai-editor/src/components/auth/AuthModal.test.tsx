/**
 * Unit tests for AuthModal component
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthModal } from './AuthModal';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
};

function renderModal(overrides: Partial<React.ComponentProps<typeof AuthModal>> = {}) {
  const props = { ...defaultProps, onClose: vi.fn(), ...overrides };
  const result = render(<AuthModal {...props} />);
  return { ...result, props };
}

// ---------------------------------------------------------------------------
// isOpen=false — renders nothing (Req 1.1)
// ---------------------------------------------------------------------------
describe('Returns null when isOpen is false', () => {
  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auth-modal-backdrop')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isOpen=true — renders modal with correct structure (Req 1.1, 1.6, 1.7)
// ---------------------------------------------------------------------------
describe('Renders modal when isOpen is true', () => {
  it('renders the dialog with role="dialog"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby referencing the heading', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'auth-modal-heading');
  });

  it('renders the backdrop', () => {
    renderModal();
    expect(screen.getByTestId('auth-modal-backdrop')).toBeInTheDocument();
  });

  it('renders the modal container', () => {
    renderModal();
    expect(screen.getByTestId('auth-modal-container')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    renderModal({ children: <p data-testid="custom-content">Hello</p> });
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders default placeholder heading when no children', () => {
    renderModal();
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Backdrop click closes modal (Req 1.3)
// ---------------------------------------------------------------------------
describe('Backdrop click closes modal (Req 1.3)', () => {
  it('calls onClose when backdrop is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByTestId('auth-modal-backdrop'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when modal container is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByTestId('auth-modal-container'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose on backdrop click when isSubmitting is true', () => {
    const { props } = renderModal({ isSubmitting: true });
    fireEvent.click(screen.getByTestId('auth-modal-backdrop'));
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Escape key closes modal (Req 1.4)
// ---------------------------------------------------------------------------
describe('Escape key closes modal (Req 1.4)', () => {
  it('calls onClose when Escape is pressed', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose on Escape when isSubmitting is true', () => {
    const { props } = renderModal({ isSubmitting: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose for non-Escape keys', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Modal does not reset when already open (Req 1.8)
// ---------------------------------------------------------------------------
describe('Modal remains stable when already open (Req 1.8)', () => {
  it('keeps children rendered on re-render with isOpen=true', () => {
    const { rerender } = render(
      <AuthModal isOpen={true} onClose={vi.fn()}>
        <p data-testid="form-content">Form</p>
      </AuthModal>,
    );

    expect(screen.getByTestId('form-content')).toBeInTheDocument();

    rerender(
      <AuthModal isOpen={true} onClose={vi.fn()}>
        <p data-testid="form-content">Form</p>
      </AuthModal>,
    );

    expect(screen.getByTestId('form-content')).toBeInTheDocument();
  });
});
