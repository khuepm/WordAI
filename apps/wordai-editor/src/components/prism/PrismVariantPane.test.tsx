/**
 * Unit tests for PrismVariantPane component.
 * Requirements: 1.5, 1.6, 1.7, 2.1, 2.5, 2.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrismVariantPane } from './PrismVariantPane';
import type { PrismVariant } from './types';

// Mock EditorCanvas since it has complex dependencies
vi.mock('../EditorCanvas', () => ({
  EditorCanvas: ({ document }: { document: { title: string } }) => (
    <div data-testid="mock-editor-canvas">{document.title}</div>
  ),
}));

function createVariant(overrides: Partial<PrismVariant> = {}): PrismVariant {
  return {
    id: 'variant-1',
    label: 'Test Variant',
    blockContent: '[]',
    source: { kind: 'markdown' },
    pinned: false,
    dirty: false,
    ...overrides,
  };
}

const defaultProps = {
  variant: createVariant(),
  slotIndex: 1 as const,
  viewMode: 'preview' as const,
  codeSubTab: 'markdown' as const,
  isFocused: false,
  syncScroll: false,
  onViewModeChange: vi.fn(),
  onCodeSubTabChange: vi.fn(),
  onFocus: vi.fn(),
  onContentChange: vi.fn(),
  onMarkdownChange: vi.fn(),
  onDiscard: vi.fn(),
  onPromote: vi.fn(),
  onPin: vi.fn(),
};

describe('PrismVariantPane', () => {
  describe('Discard button behavior (Req 1.6, 1.7)', () => {
    it('calls onDiscard when discard button is clicked at slot 1', () => {
      const onDiscard = vi.fn();
      render(
        <PrismVariantPane {...defaultProps} slotIndex={1} onDiscard={onDiscard} />
      );

      const discardButton = screen.getByRole('button', { name: /discard variant/i });
      fireEvent.click(discardButton);

      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('calls onDiscard when discard button is clicked at slot 2', () => {
      const onDiscard = vi.fn();
      render(
        <PrismVariantPane {...defaultProps} slotIndex={2} onDiscard={onDiscard} />
      );

      const discardButton = screen.getByRole('button', { name: /discard variant/i });
      fireEvent.click(discardButton);

      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('disables discard button at slot 0 (cannot discard main variant)', () => {
      render(
        <PrismVariantPane {...defaultProps} slotIndex={0} />
      );

      const discardButton = screen.getByRole('button', { name: /discard variant/i });
      expect(discardButton).toBeDisabled();
    });

    it('does not call onDiscard when discard button is clicked at slot 0', () => {
      const onDiscard = vi.fn();
      render(
        <PrismVariantPane {...defaultProps} slotIndex={0} onDiscard={onDiscard} />
      );

      const discardButton = screen.getByRole('button', { name: /discard variant/i });
      fireEvent.click(discardButton);

      expect(onDiscard).not.toHaveBeenCalled();
    });
  });

  describe('Tab bar (Req 2.1, 2.6)', () => {
    it('renders Preview and Code tabs', () => {
      render(<PrismVariantPane {...defaultProps} />);

      expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Code' })).toBeInTheDocument();
    });

    it('marks Preview tab as selected when viewMode is preview', () => {
      render(<PrismVariantPane {...defaultProps} viewMode="preview" />);

      expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('marks Code tab as selected when viewMode is code', () => {
      render(<PrismVariantPane {...defaultProps} viewMode="code" />);

      expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('calls onViewModeChange when a tab is clicked', () => {
      const onViewModeChange = vi.fn();
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="preview"
          onViewModeChange={onViewModeChange}
        />
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Code' }));
      expect(onViewModeChange).toHaveBeenCalledWith('code');
    });
  });

  describe('Pin badge (Req 2.5)', () => {
    it('shows pin badge when variant.pinned is true', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          variant={createVariant({ pinned: true })}
        />
      );

      expect(screen.getByLabelText('Pinned')).toBeInTheDocument();
    });

    it('does not show pin badge when variant.pinned is false', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          variant={createVariant({ pinned: false })}
        />
      );

      expect(screen.queryByLabelText('Pinned')).not.toBeInTheDocument();
    });
  });

  describe('Dirty indicator (Req 2.5)', () => {
    it('shows dirty indicator when variant.dirty is true', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          variant={createVariant({ dirty: true })}
        />
      );

      expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument();
    });

    it('does not show dirty indicator when variant.dirty is false', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          variant={createVariant({ dirty: false })}
        />
      );

      expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();
    });
  });
});
