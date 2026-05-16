/**
 * Unit tests for PrismToolbar component.
 * Requirements: 1.5, 9.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrismToolbar } from './PrismToolbar';

describe('PrismToolbar', () => {
  const defaultProps = {
    variantCount: 1,
    maxVariants: 3,
    syncScroll: false,
    onAddVariant: vi.fn(),
    onToggleSyncScroll: vi.fn(),
  };

  it('renders "+ Variant" button that calls onAddVariant when clicked', () => {
    const onAddVariant = vi.fn();
    render(<PrismToolbar {...defaultProps} onAddVariant={onAddVariant} />);

    const button = screen.getByRole('button', { name: /thêm biến thể mới/i });
    fireEvent.click(button);

    expect(onAddVariant).toHaveBeenCalledTimes(1);
  });

  it('disables "+ Variant" button when variantCount equals maxVariants', () => {
    render(<PrismToolbar {...defaultProps} variantCount={3} />);

    const button = screen.getByRole('button', { name: /tối đa 3 biến thể/i });
    expect(button).toBeDisabled();
  });

  it('shows tooltip "Tối đa 3 biến thể" when button is disabled', () => {
    render(<PrismToolbar {...defaultProps} variantCount={3} />);

    // The button has aria-label indicating max reached
    const button = screen.getByRole('button', { name: /tối đa 3 biến thể/i });
    expect(button).toBeInTheDocument();
  });

  it('does not call onAddVariant when button is disabled and clicked', () => {
    const onAddVariant = vi.fn();
    render(
      <PrismToolbar {...defaultProps} variantCount={3} onAddVariant={onAddVariant} />
    );

    const button = screen.getByRole('button', { name: /tối đa 3 biến thể/i });
    fireEvent.click(button);

    expect(onAddVariant).not.toHaveBeenCalled();
  });

  it('displays current variant count', () => {
    render(<PrismToolbar {...defaultProps} variantCount={2} />);

    expect(screen.getByText('2/3 variants')).toBeInTheDocument();
  });

  it('renders sync scroll toggle button', () => {
    render(<PrismToolbar {...defaultProps} />);

    const syncButton = screen.getByRole('button', { name: /bật đồng bộ scroll/i });
    expect(syncButton).toBeInTheDocument();
  });

  it('calls onToggleSyncScroll when sync button is clicked', () => {
    const onToggleSyncScroll = vi.fn();
    render(
      <PrismToolbar {...defaultProps} onToggleSyncScroll={onToggleSyncScroll} />
    );

    const syncButton = screen.getByRole('button', { name: /bật đồng bộ scroll/i });
    fireEvent.click(syncButton);

    expect(onToggleSyncScroll).toHaveBeenCalledTimes(1);
  });

  it('reflects syncScroll state with aria-pressed', () => {
    const { rerender } = render(
      <PrismToolbar {...defaultProps} syncScroll={false} />
    );

    const syncButton = screen.getByRole('button', { name: /bật đồng bộ scroll/i });
    expect(syncButton).toHaveAttribute('aria-pressed', 'false');

    rerender(<PrismToolbar {...defaultProps} syncScroll={true} />);

    const syncButtonOn = screen.getByRole('button', { name: /tắt đồng bộ scroll/i });
    expect(syncButtonOn).toHaveAttribute('aria-pressed', 'true');
  });

  it('has proper toolbar role and aria-label', () => {
    render(<PrismToolbar {...defaultProps} />);

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Prism variant toolbar');
  });
});
