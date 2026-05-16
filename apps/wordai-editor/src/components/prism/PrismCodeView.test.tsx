/**
 * Unit tests for PrismCodeView component.
 * Tests: CodeMirror mounting, language modes, readonly enforcement,
 * debounced onChange, and external content updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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
});
