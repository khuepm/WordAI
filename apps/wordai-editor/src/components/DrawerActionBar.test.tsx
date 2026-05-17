/**
 * Unit tests for DrawerActionBar component
 * Requirements: 11.1–11.3, 11.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawerActionBar } from './DrawerActionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  itemId: 'item-1',
  hasRelatedFile: true,
  onRestore: vi.fn(),
  onCompare: vi.fn(),
  onOpenReadOnly: vi.fn(),
  onSaveToLibrary: vi.fn(),
  onDelete: vi.fn(),
};

// ---------------------------------------------------------------------------
// Req 11.1 — Sticky footer with frosted-glass background and top border
// ---------------------------------------------------------------------------
describe('DrawerActionBar sticky footer styling (Req 11.1)', () => {
  it('renders with sticky positioning at bottom', () => {
    const { container } = render(<DrawerActionBar {...defaultProps} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.position).toBe('sticky');
    expect(bar.style.bottom).toBe('0px');
  });

  it('renders with backdrop blur for frosted-glass effect', () => {
    const { container } = render(<DrawerActionBar {...defaultProps} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.backdropFilter).toBe('blur(12px)');
  });

  it('renders with a top border', () => {
    const { container } = render(<DrawerActionBar {...defaultProps} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.borderTop).toContain('1px solid');
  });
});

// ---------------------------------------------------------------------------
// Req 11.2 — Primary row buttons
// ---------------------------------------------------------------------------
describe('DrawerActionBar primary row (Req 11.2)', () => {
  it('renders "Restore to Drafts" button', () => {
    render(<DrawerActionBar {...defaultProps} />);
    expect(screen.getByText('archive.actions.restoreToDrafts')).toBeInTheDocument();
  });

  it('renders "Compare with Current" button', () => {
    render(<DrawerActionBar {...defaultProps} />);
    expect(screen.getByText('archive.actions.compareWithCurrent')).toBeInTheDocument();
  });

  it('renders "Open Read-only" button', () => {
    render(<DrawerActionBar {...defaultProps} />);
    expect(screen.getByText('archive.actions.openReadOnly')).toBeInTheDocument();
  });

  it('calls onRestore when "Restore to Drafts" is clicked', () => {
    const onRestore = vi.fn();
    render(<DrawerActionBar {...defaultProps} onRestore={onRestore} />);
    fireEvent.click(screen.getByText('archive.actions.restoreToDrafts'));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('calls onCompare when "Compare with Current" is clicked', () => {
    const onCompare = vi.fn();
    render(<DrawerActionBar {...defaultProps} onCompare={onCompare} />);
    fireEvent.click(screen.getByText('archive.actions.compareWithCurrent'));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenReadOnly when "Open Read-only" is clicked', () => {
    const onOpenReadOnly = vi.fn();
    render(<DrawerActionBar {...defaultProps} onOpenReadOnly={onOpenReadOnly} />);
    fireEvent.click(screen.getByText('archive.actions.openReadOnly'));
    expect(onOpenReadOnly).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Req 11.6 — Compare button disabled when no related file
// ---------------------------------------------------------------------------
describe('DrawerActionBar compare disabled state (Req 11.6)', () => {
  it('disables "Compare with Current" when hasRelatedFile is false', () => {
    render(<DrawerActionBar {...defaultProps} hasRelatedFile={false} />);
    const compareBtn = screen.getByText('archive.actions.compareWithCurrent').closest('button')!;
    expect(compareBtn).toBeDisabled();
    expect(compareBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('applies reduced opacity when compare is disabled', () => {
    render(<DrawerActionBar {...defaultProps} hasRelatedFile={false} />);
    const compareBtn = screen.getByText('archive.actions.compareWithCurrent').closest('button')!;
    expect(compareBtn.style.opacity).toBe('0.5');
  });

  it('enables "Compare with Current" when hasRelatedFile is true', () => {
    render(<DrawerActionBar {...defaultProps} hasRelatedFile={true} />);
    const compareBtn = screen.getByText('archive.actions.compareWithCurrent').closest('button')!;
    expect(compareBtn).not.toBeDisabled();
  });

  it('does not call onCompare when disabled button is clicked', () => {
    const onCompare = vi.fn();
    render(<DrawerActionBar {...defaultProps} hasRelatedFile={false} onCompare={onCompare} />);
    const compareBtn = screen.getByText('archive.actions.compareWithCurrent').closest('button')!;
    fireEvent.click(compareBtn);
    expect(onCompare).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Req 11.3 — Secondary row buttons
// ---------------------------------------------------------------------------
describe('DrawerActionBar secondary row (Req 11.3)', () => {
  it('renders "Save to Library" button with bookmark_add icon', () => {
    render(<DrawerActionBar {...defaultProps} />);
    expect(screen.getByText('archive.actions.saveToLibrary')).toBeInTheDocument();
    expect(screen.getByText('bookmark_add')).toBeInTheDocument();
  });

  it('renders "Delete Permanently" button with delete_forever icon', () => {
    render(<DrawerActionBar {...defaultProps} />);
    expect(screen.getByText('archive.actions.deletePermanently')).toBeInTheDocument();
    expect(screen.getByText('delete_forever')).toBeInTheDocument();
  });

  it('calls onSaveToLibrary when "Save to Library" is clicked', () => {
    const onSaveToLibrary = vi.fn();
    render(<DrawerActionBar {...defaultProps} onSaveToLibrary={onSaveToLibrary} />);
    fireEvent.click(screen.getByText('archive.actions.saveToLibrary'));
    expect(onSaveToLibrary).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when "Delete Permanently" is clicked', () => {
    const onDelete = vi.fn();
    render(<DrawerActionBar {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('archive.actions.deletePermanently'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('"Delete Permanently" button uses error color', () => {
    render(<DrawerActionBar {...defaultProps} />);
    const deleteBtn = screen.getByText('archive.actions.deletePermanently').closest('button')!;
    expect(deleteBtn.style.color).toContain('error');
  });
});
