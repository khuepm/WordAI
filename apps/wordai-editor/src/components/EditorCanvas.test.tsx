/**
 * Unit tests for EditorCanvas component
 * Requirements: 1.4, 3.1, 3.2, 3.3, 4.1, 4.2
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorCanvas } from './EditorCanvas';
import type { Document, TextSelection } from '../types/document';
import { blockTextValueFromPlainText, extractPlainText } from '../utils/blockText';

// Mock @tauri-apps/api to avoid native module errors in jsdom
vi.mock('@tauri-apps/api', () => ({}));
vi.mock('@tauri-apps/plugin-opener', () => ({}));
// Mock authStore so EditorCanvas can render without AuthStateProvider
vi.mock('../services/authStore', () => ({
  useAIAccessState: () => 'active',
  useAuthState: () => ({ authState: { accessContext: null, aiAccessState: 'active', isLoading: false, authError: null } }),
  useAccessContext: () => null,
}));

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'test-doc',
    title: 'Test',
    content: blockTextValueFromPlainText(''),
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

function getEditable() {
  return screen.getByTestId('block-text-editor');
}

describe('EditorCanvas', () => {
  let onDocumentChange: Mock<(doc: Document) => void>;
  let onAITrigger: Mock<(selection: TextSelection) => void>;

  beforeEach(() => {
    onDocumentChange = vi.fn();
    onAITrigger = vi.fn();
  });

  // Req 1.4 / 3.1 — text input fires onDocumentChange with updated content
  it('fires onDocumentChange with updated content when user types', async () => {
    const doc = makeDoc({ content: blockTextValueFromPlainText('') });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const editable = getEditable();
    fireEvent.input(editable, {
      currentTarget: { innerText: 'hello world' },
      target: { innerText: 'hello world' },
    });

    expect(onDocumentChange).toHaveBeenCalled();
    const lastCall = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1][0] as Document;
    expect(extractPlainText(lastCall.content)).toBe('hello world');
  });

  // Req 1.4 — onDocumentChange receives the full updated document object
  it('passes the full document object with updated content to onDocumentChange', async () => {
    const doc = makeDoc({ content: blockTextValueFromPlainText('existing') });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
      />
    );

    const editable = getEditable();
    fireEvent.input(editable, {
      currentTarget: { innerText: 'existing!' },
      target: { innerText: 'existing!' },
    });

    const lastCall = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1][0] as Document;
    expect(lastCall.id).toBe('test-doc');
    expect(lastCall.title).toBe('Test');
    expect(extractPlainText(lastCall.content)).toContain('!');
  });

  // Req 4.1 — word count: "hello world" = 2 words
  it('displays word count of 2 for "hello world"', () => {
    const doc = makeDoc({ content: blockTextValueFromPlainText('hello world') });
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
    const doc = makeDoc({ content: blockTextValueFromPlainText('hello') });
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
    const doc = makeDoc({ content: blockTextValueFromPlainText('') });
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
    const doc = makeDoc({ content: blockTextValueFromPlainText(content) });
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
    const doc = makeDoc({ content: blockTextValueFromPlainText(content) });
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
    const doc = makeDoc({ content: blockTextValueFromPlainText('one two three') });
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

  // Req 21.2 — Cmd+S triggers onManualSave
  it('calls onManualSave when Cmd+S is pressed', async () => {
    const user = userEvent.setup();
    const onManualSave = vi.fn();
    const doc = makeDoc({ content: blockTextValueFromPlainText('some text') });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        onManualSave={onManualSave}
      />
    );

    const editable = getEditable();
    await user.click(editable);
    await user.keyboard('{Meta>}s{/Meta}');

    expect(onManualSave).toHaveBeenCalledOnce();
  });

  // Req 21.2 — Ctrl+S also triggers onManualSave (Windows/Linux)
  it('calls onManualSave when Ctrl+S is pressed', async () => {
    const user = userEvent.setup();
    const onManualSave = vi.fn();
    const doc = makeDoc({ content: blockTextValueFromPlainText('some text') });
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        onManualSave={onManualSave}
      />
    );

    const editable = getEditable();
    await user.click(editable);
    await user.keyboard('{Control>}s{/Control}');

    expect(onManualSave).toHaveBeenCalledOnce();
  });
});

describe('EditorCanvas - save error and unsaved changes (Req 2.5, 17.2, 17.3)', () => {
  let onDocumentChange: Mock<(doc: Document) => void>;
  let onAITrigger: Mock<(selection: TextSelection) => void>;

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

describe('EditorCanvas - font size controls (Req 19.5)', () => {
  let onDocumentChange: Mock<(doc: Document) => void>;
  let onAITrigger: Mock<(selection: TextSelection) => void>;

  beforeEach(() => {
    onDocumentChange = vi.fn();
    onAITrigger = vi.fn();
  });

  it('displays the current font size in the metadata bar', () => {
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={18}
      />
    );
    expect(screen.getByTestId('font-size-display')).toHaveTextContent('18px');
  });

  it('decreases font size when decrease button is clicked', async () => {
    const user = userEvent.setup();
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={18}
      />
    );
    await user.click(screen.getByTestId('font-size-decrease'));
    expect(screen.getByTestId('font-size-display')).toHaveTextContent('17px');
  });

  it('increases font size when increase button is clicked', async () => {
    const user = userEvent.setup();
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={18}
      />
    );
    await user.click(screen.getByTestId('font-size-increase'));
    expect(screen.getByTestId('font-size-display')).toHaveTextContent('19px');
  });

  it('does not decrease font size below 12', async () => {
    const user = userEvent.setup();
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={12}
      />
    );
    await user.click(screen.getByTestId('font-size-decrease'));
    expect(screen.getByTestId('font-size-display')).toHaveTextContent('12px');
  });

  it('does not increase font size above 28', async () => {
    const user = userEvent.setup();
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={28}
      />
    );
    await user.click(screen.getByTestId('font-size-increase'));
    expect(screen.getByTestId('font-size-display')).toHaveTextContent('28px');
  });

  it('calls onFontSizeChange when font size changes', async () => {
    const user = userEvent.setup();
    const onFontSizeChange = vi.fn();
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={18}
        onFontSizeChange={onFontSizeChange}
      />
    );
    await user.click(screen.getByTestId('font-size-increase'));
    expect(onFontSizeChange).toHaveBeenCalledWith(19);
  });

  it('applies font size as inline style to the textarea', () => {
    const doc = makeDoc();
    render(
      <EditorCanvas
        document={doc}
        onDocumentChange={onDocumentChange}
        onAITrigger={onAITrigger}
        isAIPanelOpen={false}
        fontSize={20}
      />
    );
    const editable = screen.getByRole('textbox', { name: /document editor/i });
    expect(editable).toHaveStyle({ fontSize: '20px' });
  });
});
