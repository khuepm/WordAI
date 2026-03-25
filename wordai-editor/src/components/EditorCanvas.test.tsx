/**
 * Unit tests for EditorCanvas component
 * Requirements: 1.4, 3.1, 3.2, 3.3, 4.1, 4.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorCanvas } from './EditorCanvas';
import type { Document } from '../types/document';

// Mock @tauri-apps/api to avoid native module errors in jsdom
vi.mock('@tauri-apps/api', () => ({}));
vi.mock('@tauri-apps/plugin-opener', () => ({}));

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'test-doc',
    title: 'Test',
    content: '',
    version: 1,
    lastModified: new Date('2024-01-01T00:00:00Z'),
    metadata: {
      wordCount: 0,
      readingTime: 0,
      status: 'draft',
      tags: [],
    },
    ...overrides,
  };
}

describe('EditorCanvas', () => {
  let onDocumentChange: ReturnType<typeof vi.fn>;
  let onAITrigger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDocumentChange = vi.fn();
    onAITrigger = vi.fn();
  });

  // Req 1.4 / 3.1 — text input fires onDocumentChange with updated content
  it('fires onDocumentChange with updated content when user types', async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ content: '' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /document editor/i });
    await user.type(textarea, 'hello world');

    expect(onDocumentChange).toHaveBeenCalled();
    const lastCall = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1][0] as Document;
    expect(lastCall.content).toBe('hello world');
  });

  // Req 1.4 — onDocumentChange receives the full updated document object
  it('passes the full document object with updated content to onDocumentChange', async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ content: 'existing' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /document editor/i });
    await user.type(textarea, '!');

    const lastCall = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1][0] as Document;
    expect(lastCall.id).toBe('test-doc');
    expect(lastCall.title).toBe('Test');
    expect(lastCall.content).toContain('!');
  });

  // Req 4.1 — word count: "hello world" = 2 words
  it('displays word count of 2 for "hello world"', () => {
    const doc = makeDoc({ content: 'hello world' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText(/2 words/i)).toBeInTheDocument();
  });

  // Req 4.1 — word count: single word uses singular form
  it('displays "1 word" for a single word', () => {
    const doc = makeDoc({ content: 'hello' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText(/1 word/i)).toBeInTheDocument();
  });

  // Req 4.1 — word count: empty content = 0 words
  it('displays 0 words for empty content', () => {
    const doc = makeDoc({ content: '' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText(/0 words/i)).toBeInTheDocument();
  });

  // Req 4.2 — reading time: 200 words = 1 min read
  it('displays "1 min read" for 200 words', () => {
    const content = Array(200).fill('word').join(' ');
    const doc = makeDoc({ content });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText(/1 min read/i)).toBeInTheDocument();
  });

  // Req 4.2 — reading time: 201 words = 2 min read (ceil)
  it('displays "2 min read" for 201 words', () => {
    const content = Array(201).fill('word').join(' ');
    const doc = makeDoc({ content });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText(/2 min read/i)).toBeInTheDocument();
  });

  // Req 4.1 / 4.2 — metadata bar renders word count and reading time
  it('renders the metadata bar with word count and reading time', () => {
    const doc = makeDoc({ content: 'one two three' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const metaBar = screen.getByRole('generic', { name: /document metadata/i });
    expect(metaBar).toBeInTheDocument();
    expect(metaBar).toHaveTextContent(/3 words/i);
    expect(metaBar).toHaveTextContent(/1 min read/i);
  });

  // Req 3.3 — tags are displayed when present
  it('renders tags when document has tags', () => {
    const doc = makeDoc({ metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: ['fiction', 'sci-fi'] } });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.getByText('fiction')).toBeInTheDocument();
    expect(screen.getByText('sci-fi')).toBeInTheDocument();
  });

  // Req 3.3 — tags section is not rendered when tags array is empty
  it('does not render tags section when tags are empty', () => {
    const doc = makeDoc({ metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] } });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    expect(screen.queryByLabelText(/tags/i)).not.toBeInTheDocument();
  });

  // Req 3.2 — text selection: Cmd+A selects all and triggers AI on Cmd+K
  it('triggers onAITrigger with selected text on Cmd+K', async () => {
    const user = userEvent.setup();
    const doc = makeDoc({ content: 'select me' });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /document editor/i });
    await user.click(textarea);
    await user.keyboard('{Meta>}a{/Meta}');
    await user.keyboard('{Meta>}k{/Meta}');

    expect(onAITrigger).toHaveBeenCalledOnce();
    const sel = onAITrigger.mock.calls[0][0];
    expect(sel).toMatchObject({ start: 0, end: 9, text: 'select me' });
  });
});

describe('EditorCanvas - save error and unsaved changes (Req 2.5, 17.2, 17.3)', () => {
  let onDocumentChange: ReturnType<typeof vi.fn>;
  let onAITrigger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDocumentChange = vi.fn();
    onAITrigger = vi.fn();
  });

  it('shows error banner when saveError is set', () => {
    const doc = makeDoc();
    const saveError = { code: 'IO_ERROR', message: 'Disk full' };
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        saveError={saveError}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed: Disk full. Retrying...');
  });

  it('does not show error banner when saveError is null', () => {
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        saveError={null}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows unsaved changes indicator when hasUnsavedChanges is true', () => {
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        hasUnsavedChanges={true}
      />
    );

    expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument();
  });

  it('does not show unsaved changes indicator when hasUnsavedChanges is false', () => {
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        hasUnsavedChanges={false}
      />
    );

    expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();
  });
});
