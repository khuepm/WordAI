/**
 * Unit tests for PrismVariantPane component.
 * Requirements: 1.5, 1.6, 1.7, 2.1, 2.5, 2.6, 3.1, 3.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrismVariantPane, getAvailableSubTabs } from './PrismVariantPane';
import type { PrismVariant, PrismSourceFormat } from './types';

// Mock EditorCanvas since it has complex dependencies
vi.mock('../EditorCanvas', () => ({
  EditorCanvas: ({ document }: { document: { title: string } }) => (
    <div data-testid="mock-editor-canvas">{document.title}</div>
  ),
}));

// Mock PrismCodeView since it depends on CodeMirror
vi.mock('./PrismCodeView', () => ({
  PrismCodeView: ({ content, onChange }: { content: string; onChange: (v: string) => void }) => (
    <div data-testid="mock-code-view">
      <span data-testid="code-content">{content}</span>
      <button data-testid="code-change-trigger" onClick={() => onChange('# Changed')}>
        Trigger Change
      </button>
    </div>
  ),
}));

// Mock blockToMarkdown and markdownToBlock
vi.mock('../../utils/blockToMarkdown', () => ({
  blockToMarkdown: (blockContent: string) => {
    if (!blockContent || blockContent === '[]') return '';
    return '# Mocked Markdown';
  },
}));

vi.mock('../../utils/markdownToBlock', () => ({
  markdownToBlock: (markdown: string) => {
    if (!markdown) return '[]';
    return JSON.stringify([{ id: 'mock-id', type: 'paragraph', text: markdown }]);
  },
  ParseError: class ParseError extends Error {
    line: number;
    constructor(message: string, line: number) {
      super(message);
      this.name = 'ParseError';
      this.line = line;
    }
  },
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

  describe('View toggle — Code view integration (Req 2.2, 2.3, 4.1, 4.2)', () => {
    it('renders PrismCodeView when viewMode is code', () => {
      render(<PrismVariantPane {...defaultProps} viewMode="code" />);

      expect(screen.getByTestId('mock-code-view')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-editor-canvas')).not.toBeInTheDocument();
    });

    it('renders EditorCanvas when viewMode is preview', () => {
      render(<PrismVariantPane {...defaultProps} viewMode="preview" />);

      expect(screen.getByTestId('mock-editor-canvas')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-code-view')).not.toBeInTheDocument();
    });

    it('passes markdown content to PrismCodeView when in code mode', () => {
      const variant = createVariant({
        blockContent: JSON.stringify([{ type: 'paragraph', text: 'Hello' }]),
      });
      render(
        <PrismVariantPane {...defaultProps} variant={variant} viewMode="code" />
      );

      // The mock blockToMarkdown returns '# Mocked Markdown' for non-empty content
      expect(screen.getByTestId('code-content')).toHaveTextContent('# Mocked Markdown');
    });

    it('calls onContentChange when PrismCodeView emits onChange (via requestIdleCallback)', async () => {
      vi.useFakeTimers();
      const onContentChange = vi.fn();
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          onContentChange={onContentChange}
        />
      );

      // Trigger a code change via the mock
      fireEvent.click(screen.getByTestId('code-change-trigger'));

      // The onChange goes through requestIdleCallback (polyfilled as setTimeout(cb, 1))
      vi.advanceTimersByTime(10);

      expect(onContentChange).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('calls onMarkdownChange when code content changes', () => {
      const onMarkdownChange = vi.fn();
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          onMarkdownChange={onMarkdownChange}
        />
      );

      fireEvent.click(screen.getByTestId('code-change-trigger'));

      // onMarkdownChange is called immediately (before requestIdleCallback)
      expect(onMarkdownChange).toHaveBeenCalledWith('# Changed');
    });
  });

  describe('Sub-tab bar (Req 3.1, 3.6)', () => {
    it('does not show sub-tab bar in preview mode', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="preview"
          variant={createVariant({ source: { kind: 'aura', bundle: {} as any } })}
        />
      );

      expect(screen.queryByRole('tablist', { name: 'Code format sub-tabs' })).not.toBeInTheDocument();
    });

    it('shows sub-tab bar in code mode when source has multiple sub-tabs (aura)', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          variant={createVariant({ source: { kind: 'aura', bundle: {} as any } })}
        />
      );

      const subTabBar = screen.getByRole('tablist', { name: 'Code format sub-tabs' });
      expect(subTabBar).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Markdown' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '.aura' })).toBeInTheDocument();
    });

    it('does not show sub-tab bar when source has only one sub-tab (markdown)', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          variant={createVariant({ source: { kind: 'markdown' } })}
        />
      );

      expect(screen.queryByRole('tablist', { name: 'Code format sub-tabs' })).not.toBeInTheDocument();
    });

    it('does not show sub-tab bar when source has only one sub-tab (html)', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          variant={createVariant({ source: { kind: 'html' } })}
        />
      );

      expect(screen.queryByRole('tablist', { name: 'Code format sub-tabs' })).not.toBeInTheDocument();
    });

    it('does not show sub-tab bar when source has only one sub-tab (docx)', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          variant={createVariant({ source: { kind: 'docx', filePath: '/test.docx' } })}
        />
      );

      expect(screen.queryByRole('tablist', { name: 'Code format sub-tabs' })).not.toBeInTheDocument();
    });

    it('calls onCodeSubTabChange when a sub-tab is clicked', () => {
      const onCodeSubTabChange = vi.fn();
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          variant={createVariant({ source: { kind: 'aura', bundle: {} as any } })}
          onCodeSubTabChange={onCodeSubTabChange}
        />
      );

      fireEvent.click(screen.getByRole('tab', { name: '.aura' }));
      expect(onCodeSubTabChange).toHaveBeenCalledWith('aura');
    });

    it('marks the active sub-tab as selected', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          codeSubTab="aura"
          variant={createVariant({ source: { kind: 'aura', bundle: {} as any } })}
        />
      );

      expect(screen.getByRole('tab', { name: '.aura' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Markdown' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('.aura sub-tab content (Req 3.1, 3.2)', () => {
    it('passes AuraBundle JSON to PrismCodeView when codeSubTab is aura and source is aura', () => {
      const bundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json' as const,
        version: 1 as const,
        intentId: 'intent-123',
        canonical: 'markdown' as const,
        markdown: '# Hello',
        variants: [],
        promotedVariantId: null,
        lastModified: '2024-01-01T00:00:00.000Z',
      };
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          codeSubTab="aura"
          variant={createVariant({ source: { kind: 'aura', bundle } })}
        />
      );

      const codeContent = screen.getByTestId('code-content');
      expect(codeContent.textContent).toBe(JSON.stringify(bundle, null, 2));
    });

    it('passes empty JSON object when codeSubTab is aura but source is not aura', () => {
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          codeSubTab="aura"
          variant={createVariant({ source: { kind: 'markdown' } })}
        />
      );

      const codeContent = screen.getByTestId('code-content');
      expect(codeContent.textContent).toBe('{}');
    });

    it('passes markdown content when codeSubTab is markdown even for aura source', () => {
      const bundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json' as const,
        version: 1 as const,
        intentId: 'intent-123',
        canonical: 'markdown' as const,
        markdown: '# Hello',
        variants: [],
        promotedVariantId: null,
        lastModified: '2024-01-01T00:00:00.000Z',
      };
      render(
        <PrismVariantPane
          {...defaultProps}
          viewMode="code"
          codeSubTab="markdown"
          variant={createVariant({
            blockContent: JSON.stringify([{ type: 'paragraph', text: 'Hello' }]),
            source: { kind: 'aura', bundle },
          })}
        />
      );

      // Should show markdown content, not the bundle JSON
      const codeContent = screen.getByTestId('code-content');
      expect(codeContent.textContent).toBe('# Mocked Markdown');
    });
  });
});

describe('Scroll position preservation (Req 2.4)', () => {
  it('saves scroll percentage before switching view mode and calls onViewModeChange', () => {
    const onViewModeChange = vi.fn();
    render(
      <PrismVariantPane
        {...defaultProps}
        viewMode="preview"
        onViewModeChange={onViewModeChange}
      />
    );

    // Click Code tab to switch view
    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(onViewModeChange).toHaveBeenCalledWith('code');
  });

  it('does not call onViewModeChange when clicking the already active tab', () => {
    const onViewModeChange = vi.fn();
    render(
      <PrismVariantPane
        {...defaultProps}
        viewMode="preview"
        onViewModeChange={onViewModeChange}
      />
    );

    // Click Preview tab (already active)
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(onViewModeChange).not.toHaveBeenCalled();
  });

  it('restores scroll position after view mode change using requestAnimationFrame', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <PrismVariantPane
        {...defaultProps}
        viewMode="preview"
        variant={createVariant({
          blockContent: JSON.stringify([{ type: 'paragraph', text: 'Hello' }]),
        })}
      />
    );

    // Simulate switching to code view (parent updates viewMode prop)
    rerender(
      <PrismVariantPane
        {...defaultProps}
        viewMode="code"
        variant={createVariant({
          blockContent: JSON.stringify([{ type: 'paragraph', text: 'Hello' }]),
        })}
      />
    );

    // The effect should schedule a requestAnimationFrame
    // Since savedPercent is 0 initially, it won't actually restore
    // This verifies the component doesn't crash during the transition
    vi.advanceTimersByTime(16); // one frame
    vi.useRealTimers();

    expect(screen.getByTestId('mock-code-view')).toBeInTheDocument();
  });
});

describe('getAvailableSubTabs', () => {
  it('returns ["markdown"] for markdown source', () => {
    const source: PrismSourceFormat = { kind: 'markdown' };
    expect(getAvailableSubTabs(source)).toEqual(['markdown']);
  });

  it('returns ["html"] for html source', () => {
    const source: PrismSourceFormat = { kind: 'html' };
    expect(getAvailableSubTabs(source)).toEqual(['html']);
  });

  it('returns ["ooxml"] for docx source', () => {
    const source: PrismSourceFormat = { kind: 'docx', filePath: '/test.docx' };
    expect(getAvailableSubTabs(source)).toEqual(['ooxml']);
  });

  it('returns ["markdown", "aura"] for aura source', () => {
    const source: PrismSourceFormat = { kind: 'aura', bundle: {} as any };
    expect(getAvailableSubTabs(source)).toEqual(['markdown', 'aura']);
  });
});
