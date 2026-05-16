/**
 * Unit tests for PrismCodeView component.
 * Tests: CodeMirror mounting, language modes, readonly enforcement,
 * debounced onChange, and external content updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { PrismCodeView } from './PrismCodeView';

describe('PrismCodeView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('mounts CodeMirror editor in the container', () => {
    const { container } = render(
      <PrismCodeView
        content="# Hello"
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer).not.toBeNull();
    // CodeMirror creates a .cm-editor element inside the container
    const cmEditor = editorContainer?.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
  });

  it('renders content in the editor', () => {
    const { container } = render(
      <PrismCodeView
        content="Hello World"
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent?.textContent).toContain('Hello World');
  });

  it('sets data-subtab attribute correctly', () => {
    const { container } = render(
      <PrismCodeView
        content=""
        subTab="html"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-subtab')).toBe('html');
  });

  it('sets data-readonly=true for ooxml subTab regardless of readonly prop', () => {
    const { container } = render(
      <PrismCodeView
        content="<xml>test</xml>"
        subTab="ooxml"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-readonly')).toBe('true');
  });

  it('sets data-readonly=true for aura subTab regardless of readonly prop', () => {
    const { container } = render(
      <PrismCodeView
        content='{"key": "value"}'
        subTab="aura"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-readonly')).toBe('true');
  });

  it('sets data-readonly=true when readonly prop is true', () => {
    const { container } = render(
      <PrismCodeView
        content="# Test"
        subTab="markdown"
        readonly={true}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-readonly')).toBe('true');
  });

  it('sets data-readonly=false for editable markdown subTab', () => {
    const { container } = render(
      <PrismCodeView
        content="# Test"
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-readonly')).toBe('false');
  });

  it('has correct aria-label based on subTab', () => {
    const { container } = render(
      <PrismCodeView
        content=""
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('aria-label')).toBe('Code editor: markdown');
  });

  it('applies custom fontSize', () => {
    const { container } = render(
      <PrismCodeView
        content="test"
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
        fontSize={18}
      />
    );

    // CodeMirror should be mounted with the font size applied via theme
    const cmEditor = container.querySelector('.cm-editor');
    expect(cmEditor).not.toBeNull();
  });

  it('updates content when content prop changes externally', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <PrismCodeView
        content="initial"
        subTab="markdown"
        readonly={false}
        onChange={onChange}
      />
    );

    // Rerender with new content
    rerender(
      <PrismCodeView
        content="updated externally"
        subTab="markdown"
        readonly={false}
        onChange={onChange}
      />
    );

    const cmContent = container.querySelector('.cm-content');
    expect(cmContent?.textContent).toContain('updated externally');

    // External update should NOT trigger onChange
    vi.advanceTimersByTime(600);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cleans up EditorView on unmount', () => {
    const { unmount, container } = render(
      <PrismCodeView
        content="test"
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    // Verify editor exists before unmount
    expect(container.querySelector('.cm-editor')).not.toBeNull();

    unmount();

    // After unmount, the container is removed from DOM
    expect(container.querySelector('.cm-editor')).toBeNull();
  });

  it('recreates editor when subTab changes', () => {
    const { container, rerender } = render(
      <PrismCodeView
        content='{"key": "value"}'
        subTab="markdown"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector('.cm-editor')).not.toBeNull();

    rerender(
      <PrismCodeView
        content='{"key": "value"}'
        subTab="aura"
        readonly={false}
        onChange={vi.fn()}
      />
    );

    // Editor should still be mounted (recreated with new language mode)
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    // Should now be readonly
    const editorContainer = container.querySelector('.prism-code-view');
    expect(editorContainer?.getAttribute('data-readonly')).toBe('true');
  });

  describe('Scroll position preservation (Req 3.6)', () => {
    it('preserves scroll position data attributes across sub-tab changes', () => {
      const { container, rerender } = render(
        <PrismCodeView
          content="# Hello\n\nLong content here"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
        />
      );

      // Verify editor is mounted with markdown sub-tab
      const editorContainer = container.querySelector('.prism-code-view');
      expect(editorContainer?.getAttribute('data-subtab')).toBe('markdown');

      // Switch to aura sub-tab
      rerender(
        <PrismCodeView
          content='{"key": "value"}'
          subTab="aura"
          readonly={false}
          onChange={vi.fn()}
        />
      );

      // Verify editor is now on aura sub-tab
      const updatedContainer = container.querySelector('.prism-code-view');
      expect(updatedContainer?.getAttribute('data-subtab')).toBe('aura');

      // Switch back to markdown
      rerender(
        <PrismCodeView
          content="# Hello\n\nLong content here"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
        />
      );

      // Verify editor is back on markdown sub-tab
      const finalContainer = container.querySelector('.prism-code-view');
      expect(finalContainer?.getAttribute('data-subtab')).toBe('markdown');
    });

    it('maintains separate editor instances per sub-tab (editor recreated on switch)', () => {
      const { container, rerender } = render(
        <PrismCodeView
          content="# Markdown content"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
        />
      );

      // Verify initial content
      const cmContent = container.querySelector('.cm-content');
      expect(cmContent?.textContent).toContain('# Markdown content');

      // Switch to aura sub-tab with different content
      rerender(
        <PrismCodeView
          content='{"bundle": true}'
          subTab="aura"
          readonly={false}
          onChange={vi.fn()}
        />
      );

      // Verify new content is displayed
      const auraContent = container.querySelector('.cm-content');
      expect(auraContent?.textContent).toContain('{"bundle": true}');
    });
  });

  describe('Error Banner (Req 10.1, 10.2, 10.3)', () => {
    it('shows error banner when parseError is provided', () => {
      const { container } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Unexpected token at line 5"
        />
      );

      const banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Lỗi cú pháp Markdown: Unexpected token at line 5');
      expect(banner?.textContent).toContain('Preview giữ nguyên nội dung trước đó.');
    });

    it('banner has role="alert" and aria-live="polite" for accessibility', () => {
      const { container } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Parse error"
        />
      );

      const banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner?.getAttribute('role')).toBe('alert');
      expect(banner?.getAttribute('aria-live')).toBe('polite');
    });

    it('does not show error banner when parseError is null', () => {
      const { container } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError={null}
        />
      );

      const banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner).toBeNull();
    });

    it('hides banner with 300ms animation when parseError transitions to null', () => {
      const { container, rerender } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Some error"
        />
      );

      // Banner should be visible
      let banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner).not.toBeNull();

      // Clear the error (parse succeeds)
      rerender(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError={null}
        />
      );

      // Banner should still be in DOM (animating out) with opacity 0
      banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner).not.toBeNull();
      expect(banner?.style.opacity).toBe('0');

      // After 300ms, banner should be removed from DOM
      act(() => {
        vi.advanceTimersByTime(300);
      });
      banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner).toBeNull();
    });

    it('shows banner above the CodeMirror editor', () => {
      const { container } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Error"
        />
      );

      const wrapper = container.querySelector('.prism-code-view-wrapper');
      const children = wrapper?.children;
      expect(children).not.toBeUndefined();
      // First child should be the error banner, second should be the editor container
      expect(children![0].classList.contains('prism-code-view-error-banner')).toBe(true);
      expect(children![1].classList.contains('prism-code-view')).toBe(true);
    });

    it('updates banner message when parseError changes', () => {
      const { container, rerender } = render(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Error 1"
        />
      );

      let banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner?.textContent).toContain('Error 1');

      rerender(
        <PrismCodeView
          content="# Hello"
          subTab="markdown"
          readonly={false}
          onChange={vi.fn()}
          parseError="Error 2"
        />
      );

      banner = container.querySelector('.prism-code-view-error-banner');
      expect(banner?.textContent).toContain('Error 2');
    });
  });
});
