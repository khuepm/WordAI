/**
 * Unit tests for ConfirmationDialog component
 * Requirements: 9.2, 9.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from './ConfirmationDialog';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const defaultProps = {
  isOpen: true,
  title: 'Delete Document',
  message: 'Are you sure you want to delete this document?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  isDangerous: false as boolean | undefined,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderDialog(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, onConfirm: vi.fn(), onCancel: vi.fn(), ...overrides };
  render(<ConfirmationDialog {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// isOpen=false — renders nothing
// ---------------------------------------------------------------------------
describe('Returns null when isOpen is false', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isOpen=true — renders all content
// ---------------------------------------------------------------------------
describe('Renders dialog content when isOpen is true (Req 9.2)', () => {
  it('renders the dialog with role="dialog"', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
  });

  it('renders the title', () => {
    renderDialog({ title: 'Delete Document' });

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
  });

  it('renders the message', () => {
    renderDialog({ message: 'Are you sure you want to delete this document?' });

    expect(screen.getByText('Are you sure you want to delete this document?')).toBeInTheDocument();
  });

  it('renders the confirmLabel on the confirm button', () => {
    renderDialog({ confirmLabel: 'Delete' });

    expect(screen.getByTestId('confirmation-dialog-confirm')).toHaveTextContent('Delete');
  });

  it('renders the cancelLabel on the cancel button', () => {
    renderDialog({ cancelLabel: 'Cancel' });

    expect(screen.getByTestId('confirmation-dialog-cancel')).toHaveTextContent('Cancel');
  });
});

// ---------------------------------------------------------------------------
// Clicking confirm calls onConfirm (Req 9.5)
// ---------------------------------------------------------------------------
describe('Clicking confirm calls onConfirm (Req 9.5)', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('confirmation-dialog-confirm'));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when confirm is clicked', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByTestId('confirmation-dialog-confirm'));

    expect(onCancel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Clicking cancel calls onCancel (Req 9.5)
// ---------------------------------------------------------------------------
describe('Clicking cancel calls onCancel (Req 9.5)', () => {
  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    fireEvent.click(screen.getByTestId('confirmation-dialog-cancel'));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when cancel is clicked', () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    fireEvent.click(screen.getByTestId('confirmation-dialog-cancel'));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isDangerous=true — applies error color to confirm button (Req 9.2)
// ---------------------------------------------------------------------------
describe('isDangerous applies error color to confirm button (Req 9.2)', () => {
  it('applies error background color when isDangerous is true', () => {
    renderDialog({ isDangerous: true });

    const confirmBtn = screen.getByTestId('confirmation-dialog-confirm');
    expect(confirmBtn).toHaveStyle({
      background: 'var(--md-sys-color-error, #ba1a1a)',
    });
  });

  it('applies primary background color when isDangerous is false', () => {
    renderDialog({ isDangerous: false });

    const confirmBtn = screen.getByTestId('confirmation-dialog-confirm');
    expect(confirmBtn).toHaveStyle({
      background: 'var(--md-sys-color-primary, #4343d5)',
    });
  });

  it('applies primary background color when isDangerous is not provided', () => {
    renderDialog();

    const confirmBtn = screen.getByTestId('confirmation-dialog-confirm');
    expect(confirmBtn).toHaveStyle({
      background: 'var(--md-sys-color-primary, #4343d5)',
    });
  });
});
