/**
 * Unit tests for FileSizeWarningDialog
 * Requirements: 25.2, 25.5, 25.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileSizeWarningDialog } from './FileSizeWarningDialog';

describe('FileSizeWarningDialog', () => {
  const defaultProps = {
    isOpen: true,
    fileSizeMB: 45.2,
    estimatedSeconds: Math.ceil(45.2 / 5),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <FileSizeWarningDialog {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the dialog when isOpen is true', () => {
    render(<FileSizeWarningDialog {...defaultProps} />);
    expect(screen.getByTestId('file-size-warning-dialog')).toBeInTheDocument();
  });

  it('displays file size in "X.X MB" format (Req 25.5)', () => {
    render(<FileSizeWarningDialog {...defaultProps} fileSizeMB={45.2} />);
    expect(screen.getByText(/45\.2 MB/)).toBeInTheDocument();
  });

  it('displays estimated seconds based on ceil(fileSizeMB / 5) (Req 25.6)', () => {
    const fileSizeMB = 45.2;
    const estimatedSeconds = Math.ceil(fileSizeMB / 5); // 10
    render(
      <FileSizeWarningDialog
        {...defaultProps}
        fileSizeMB={fileSizeMB}
        estimatedSeconds={estimatedSeconds}
      />
    );
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('has a "Continue" button (Tiếp tục) that calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(<FileSizeWarningDialog {...defaultProps} onConfirm={onConfirm} />);
    const confirmBtn = screen.getByTestId('btn-confirm-import');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('has a "Cancel" button (Hủy) that calls onCancel', () => {
    const onCancel = vi.fn();
    render(<FileSizeWarningDialog {...defaultProps} onCancel={onCancel} />);
    const cancelBtn = screen.getByTestId('btn-cancel-import');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the overlay backdrop', () => {
    const onCancel = vi.fn();
    render(<FileSizeWarningDialog {...defaultProps} onCancel={onCancel} />);
    const overlay = screen.getByTestId('file-size-warning-dialog');
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('formats file size with one decimal place', () => {
    render(<FileSizeWarningDialog {...defaultProps} fileSizeMB={20} />);
    expect(screen.getByText(/20\.0 MB/)).toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<FileSizeWarningDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'fsw-title');
  });
});
