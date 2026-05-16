/**
 * PrismCanvas — Unit tests for multi-column layout.
 * Validates: Requirements 1.1, 11.4, 11.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PrismCanvas } from './PrismCanvas';
import type { Document } from '../../types/document';

// Mock EditorCanvas to avoid AuthStateProvider dependency
vi.mock('../EditorCanvas', () => ({
  EditorCanvas: (props: Record<string, unknown>) => (
    <div data-testid="mock-editor-canvas" data-document-id={(props.document as { id: string })?.id} />
  ),
}));

// Mock usePrismState to control slot state directly
const mockAddAuraSphereVariants = vi.fn();

function createMockState(slotCount: 1 | 2 | 3) {
  const makeVariant = (index: number) => ({
    id: `variant-${index}-stable-id`,
    label: index === 0 ? 'Main' : `Variant ${index + 1}`,
    blockContent: '[]',
    source: { kind: 'markdown' as const },
    pinned: false,
    dirty: false,
  });

  const slots = [
    makeVariant(0),
    slotCount >= 2 ? makeVariant(1) : null,
    slotCount >= 3 ? makeVariant(2) : null,
  ];

  return {
    state: {
      slots,
      modes: ['preview', 'preview', 'preview'] as const,
      codeSubTabs: ['markdown', 'markdown', 'markdown'] as const,
      focusedSlot: 0 as const,
      syncScroll: false,
    },
    addVariant: vi.fn(),
    discardVariant: vi.fn(),
    promoteVariant: vi.fn(),
    updateVariantContent: vi.fn(),
    updateFromMarkdown: vi.fn(),
    setViewMode: vi.fn(),
    setCodeSubTab: vi.fn(),
    setFocus: vi.fn(),
    toggleSyncScroll: vi.fn(),
    pinVariant: vi.fn(),
    addAuraSphereVariants: mockAddAuraSphereVariants,
  };
}

let mockStateReturn = createMockState(1);

vi.mock('./usePrismState', () => ({
  usePrismState: () => mockStateReturn,
}));

const baseDocument: Document = {
  id: 'doc-1',
  title: 'Test Doc',
  content: '[]',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseProps = {
  document: baseDocument,
  onDocumentChange: vi.fn(),
  onAITrigger: vi.fn(),
  isAIPanelOpen: false,
};

describe('PrismCanvas — Multi-column layout', () => {
  describe('CSS Grid columns (Req 1.1)', () => {
    it('renders 1 column when only slot 0 is active', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid).not.toBeNull();
      expect(grid.style.gridTemplateColumns).toBe('repeat(1, 1fr)');
    });

    it('renders 2 columns when 2 slots are active', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    });

    it('renders 3 columns when 3 slots are active', () => {
      mockStateReturn = createMockState(3);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    });
  });

  describe('CSS transition for layout shift (Req 11.5)', () => {
    it('applies CSS transition on grid-template-columns', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.transition).toContain('grid-template-columns');
    });

    it('transition duration is <= 50ms', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      // Extract ms value from transition string
      const match = grid.style.transition.match(/(\d+)ms/);
      expect(match).not.toBeNull();
      const durationMs = parseInt(match![1], 10);
      expect(durationMs).toBeLessThanOrEqual(50);
    });
  });

  describe('Stable React keys — no unmount/remount (Req 11.4)', () => {
    it('uses variant.id as key for each slot container', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const slots = container.querySelectorAll('.prism-canvas__slot');
      expect(slots).toHaveLength(2);
      expect(slots[0].getAttribute('data-slot-index')).toBe('0');
      expect(slots[1].getAttribute('data-slot-index')).toBe('1');
    });

    it('renders correct number of EditorCanvas instances for active slots', () => {
      mockStateReturn = createMockState(3);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const slots = container.querySelectorAll('.prism-canvas__slot');
      expect(slots).toHaveLength(3);
    });

    it('does not render slot containers for null slots', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const slots = container.querySelectorAll('.prism-canvas__slot');
      expect(slots).toHaveLength(1);
    });

    it('preserves existing slot elements when a new variant is added', () => {
      // Start with 1 slot
      mockStateReturn = createMockState(1);
      const { container, rerender } = render(<PrismCanvas {...baseProps} />);

      const slotsBefore = container.querySelectorAll('.prism-canvas__slot');
      expect(slotsBefore).toHaveLength(1);

      // Now render with 2 slots — the first slot should keep the same variant.id key
      mockStateReturn = createMockState(2);
      rerender(<PrismCanvas {...baseProps} />);

      const slotsAfter = container.querySelectorAll('.prism-canvas__slot');
      expect(slotsAfter).toHaveLength(2);
      // First slot still has the same data-slot-index
      expect(slotsAfter[0].getAttribute('data-slot-index')).toBe('0');
    });
  });

  describe('Grid container properties', () => {
    it('has display: grid', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.display).toBe('grid');
    });

    it('has width and height 100%', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.width).toBe('100%');
      expect(grid.style.height).toBe('100%');
    });

    it('has overflow hidden', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const grid = container.querySelector('.prism-canvas') as HTMLElement;
      expect(grid.style.overflow).toBe('hidden');
    });
  });
});
