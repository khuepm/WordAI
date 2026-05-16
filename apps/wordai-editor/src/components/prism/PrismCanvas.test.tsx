/**
 * PrismCanvas — Unit tests for multi-column layout, AuraSphere wiring,
 * toast notification, and disablePromote.
 * Validates: Requirements 1.1, 7.9, 8.1, 8.7, 10.9, 11.4, 11.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { PrismCanvas } from './PrismCanvas';
import type { Document } from '../../types/document';

// Mock EditorCanvas to avoid AuthStateProvider dependency
vi.mock('../EditorCanvas', () => ({
  EditorCanvas: (props: Record<string, unknown>) => (
    <div data-testid="mock-editor-canvas" data-document-id={(props.document as { id: string })?.id} />
  ),
}));

// Mock PrismCodeView
vi.mock('./PrismCodeView', () => ({
  PrismCodeView: () => <div data-testid="mock-code-view" />,
}));

// Mock PrismToolbar
vi.mock('./PrismToolbar', () => ({
  PrismToolbar: (props: Record<string, unknown>) => (
    <div data-testid="mock-toolbar" data-variant-count={props.variantCount} />
  ),
}));

// Mock markdownToBlock
const mockMarkdownToBlock = vi.fn();
vi.mock('../../utils/markdownToBlock', () => ({
  markdownToBlock: (...args: unknown[]) => mockMarkdownToBlock(...args),
  ParseError: class ParseError extends Error {
    line: number;
    constructor(message: string, line: number) {
      super(message);
      this.line = line;
    }
  },
}));

// Mock blockToMarkdown
vi.mock('../../utils/blockToMarkdown', () => ({
  blockToMarkdown: () => '# Test',
}));

// Mock usePrismState to control slot state directly
const mockAddAuraSphereVariants = vi.fn();
const mockPromoteVariant = vi.fn();
const mockDiscardVariant = vi.fn();
const mockUpdateVariantContent = vi.fn();
const mockSetViewMode = vi.fn();
const mockSetCodeSubTab = vi.fn();
const mockSetFocus = vi.fn();
const mockToggleSyncScroll = vi.fn();
const mockPinVariant = vi.fn();
const mockAddVariant = vi.fn();

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
    addVariant: mockAddVariant,
    discardVariant: mockDiscardVariant,
    promoteVariant: mockPromoteVariant,
    updateVariantContent: mockUpdateVariantContent,
    updateFromMarkdown: vi.fn(),
    setViewMode: mockSetViewMode,
    setCodeSubTab: mockSetCodeSubTab,
    setFocus: mockSetFocus,
    toggleSyncScroll: mockToggleSyncScroll,
    pinVariant: mockPinVariant,
    addAuraSphereVariants: mockAddAuraSphereVariants,
    saveError: null,
    retrySave: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkdownToBlock.mockReturnValue('[]');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CSS Grid columns (Req 1.1)', () => {
    it('renders 1 column when only slot 0 is active', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      // Grid is now a child div inside the flex container
      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv).not.toBeNull();
      expect(gridDiv.style.gridTemplateColumns).toBe('repeat(1, 1fr)');
    });

    it('renders 2 columns when 2 slots are active', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    });

    it('renders 3 columns when 3 slots are active', () => {
      mockStateReturn = createMockState(3);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    });
  });

  describe('CSS transition for layout shift (Req 11.5)', () => {
    it('applies CSS transition on grid-template-columns', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv.style.transition).toContain('grid-template-columns');
    });

    it('transition duration is <= 50ms', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      const match = gridDiv.style.transition.match(/(\d+)ms/);
      expect(match).not.toBeNull();
      const durationMs = parseInt(match![1], 10);
      expect(durationMs).toBeLessThanOrEqual(50);
    });
  });

  describe('Stable React keys — no unmount/remount (Req 11.4)', () => {
    it('renders PrismVariantPane for each active slot', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const panes = container.querySelectorAll('.prism-variant-pane');
      expect(panes).toHaveLength(2);
    });

    it('renders correct number of panes for 3 active slots', () => {
      mockStateReturn = createMockState(3);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const panes = container.querySelectorAll('.prism-variant-pane');
      expect(panes).toHaveLength(3);
    });

    it('does not render panes for null slots', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const panes = container.querySelectorAll('.prism-variant-pane');
      expect(panes).toHaveLength(1);
    });
  });

  describe('PrismToolbar integration', () => {
    it('renders PrismToolbar above the grid', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const toolbar = container.querySelector('[data-testid="mock-toolbar"]');
      expect(toolbar).not.toBeNull();
      expect(toolbar?.getAttribute('data-variant-count')).toBe('2');
    });
  });

  describe('Disable Promote when only 1 variant active (Req 7.9)', () => {
    it('passes disablePromote=true to PrismVariantPane when 1 slot active', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      // The Promote button should be disabled
      const promoteBtn = container.querySelector('[aria-label="Promote variant"]') as HTMLButtonElement;
      expect(promoteBtn).not.toBeNull();
      expect(promoteBtn.disabled).toBe(true);
    });

    it('passes disablePromote=false to PrismVariantPane when 2+ slots active', () => {
      mockStateReturn = createMockState(2);
      const { container } = render(<PrismCanvas {...baseProps} />);

      // The Promote buttons should NOT be disabled
      const promoteBtns = container.querySelectorAll('[aria-label="Promote variant"]');
      expect(promoteBtns.length).toBeGreaterThanOrEqual(1);
      promoteBtns.forEach((btn) => {
        expect((btn as HTMLButtonElement).disabled).toBe(false);
      });
    });
  });

  describe('AuraSphere suggestion wiring (Req 8.1, 8.7)', () => {
    it('calls addAuraSphereVariants when auraSuggestion prop changes', () => {
      mockStateReturn = createMockState(1);
      const suggestion = {
        variants: [
          { label: 'Formal', markdown: '# Hello', promptRef: 'p1' },
        ],
      };

      render(<PrismCanvas {...baseProps} auraSuggestion={suggestion} />);

      expect(mockAddAuraSphereVariants).toHaveBeenCalledWith(suggestion);
    });

    it('does not call addAuraSphereVariants when auraSuggestion is null', () => {
      mockStateReturn = createMockState(1);
      render(<PrismCanvas {...baseProps} auraSuggestion={null} />);

      expect(mockAddAuraSphereVariants).not.toHaveBeenCalled();
    });
  });

  describe('Toast notification for all-parse-failure (Req 10.9)', () => {
    it('shows toast when all variants in suggestion fail to parse', () => {
      vi.useFakeTimers();
      mockStateReturn = createMockState(1);
      mockMarkdownToBlock.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const suggestion = {
        variants: [
          { label: 'Bad', markdown: '<<<invalid>>>', promptRef: 'p1' },
        ],
      };

      const { container } = render(
        <PrismCanvas {...baseProps} auraSuggestion={suggestion} />
      );

      const toast = container.querySelector('.prism-canvas__toast');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toContain('AuraSphere');
    });

    it('does not show toast when at least one variant parses successfully', () => {
      mockStateReturn = createMockState(1);
      mockMarkdownToBlock.mockReturnValue('[]');

      const suggestion = {
        variants: [
          { label: 'Good', markdown: '# Hello', promptRef: 'p1' },
        ],
      };

      const { container } = render(
        <PrismCanvas {...baseProps} auraSuggestion={suggestion} />
      );

      const toast = container.querySelector('.prism-canvas__toast');
      expect(toast).toBeNull();
    });

    it('auto-dismisses toast after 5 seconds', () => {
      vi.useFakeTimers();
      mockStateReturn = createMockState(1);
      mockMarkdownToBlock.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const suggestion = {
        variants: [
          { label: 'Bad', markdown: '<<<invalid>>>', promptRef: 'p1' },
        ],
      };

      const { container } = render(
        <PrismCanvas {...baseProps} auraSuggestion={suggestion} />
      );

      // Toast should be visible
      expect(container.querySelector('.prism-canvas__toast')).not.toBeNull();

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Toast should be dismissed
      expect(container.querySelector('.prism-canvas__toast')).toBeNull();
    });
  });

  describe('Grid container properties', () => {
    it('has display: flex on root container', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const root = container.querySelector('.prism-canvas') as HTMLElement;
      expect(root.style.display).toBe('flex');
      expect(root.style.flexDirection).toBe('column');
    });

    it('grid div has width 100%', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv.style.width).toBe('100%');
    });

    it('grid div has overflow hidden', () => {
      mockStateReturn = createMockState(1);
      const { container } = render(<PrismCanvas {...baseProps} />);

      const gridDiv = container.querySelector('.prism-canvas > div:last-child') as HTMLElement;
      expect(gridDiv.style.overflow).toBe('hidden');
    });
  });
});
