import { describe, expect, it } from 'vitest';
import { auraIntentToDocument, computeAuraPlainText, documentToAuraIntent } from './auraDocumentAdapter';
import type { AuraIntentDocument } from '../types/auraDocument';
import type { Document } from '../types/document';
import { extractPlainText } from '../utils/blockText';

function makeDocument(content: string, overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    title: 'Adapter Test',
    content,
    metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
    version: 3,
    lastModified: new Date('2026-04-25T00:00:00.000Z'),
    ...overrides,
  };
}

function blockEditorValue(blocks: Array<{ text: string; type?: string; inlineStyleRanges?: Array<{ offset: number; length: number; style: string }> }>): string {
  return JSON.stringify([
    {
      reactBlockTextVersion: 'test',
      id: 'block-1',
      type: 'text',
      data: JSON.stringify({ blocks, entityMap: {} }),
      metadata: '{}',
      indent: 0,
    },
  ]);
}

describe('auraDocumentAdapter', () => {
  it('converts plain text into paragraph blocks with Aura timestamps', () => {
    const result = documentToAuraIntent(makeDocument('Xin chao WordAI'));

    expect(result.warnings).toEqual([]);
    expect(result.value).toMatchObject({
      id: 'doc-1',
      intent_name: 'Adapter Test',
      version: 3,
      updated_at: Date.parse('2026-04-25T00:00:00.000Z'),
    });
    expect(result.value.content).toEqual([
      { type: 'paragraph', text: 'Xin chao WordAI', inline: [{ kind: 'text', text: 'Xin chao WordAI' }] },
    ]);
  });

  it('splits multi-paragraph plain text into paragraph blocks', () => {
    const result = documentToAuraIntent(makeDocument('Doan mot\n\nDoan hai'));

    expect(result.value.content).toEqual([
      { type: 'paragraph', text: 'Doan mot', inline: [{ kind: 'text', text: 'Doan mot' }] },
      { type: 'paragraph', text: 'Doan hai', inline: [{ kind: 'text', text: 'Doan hai' }] },
    ]);
  });

  it('detects Markdown headings, ordered lists, unordered lists, and code blocks', () => {
    const result = documentToAuraIntent(makeDocument([
      '# Heading 1',
      '## Heading 2',
      '- Bullet',
      '1. Ordered',
      '```ts',
      'const answer = 42;',
      '```',
    ].join('\n')));

    expect(result.value.content).toEqual([
      { type: 'heading', level: 1, text: 'Heading 1' },
      { type: 'heading', level: 2, text: 'Heading 2' },
      { type: 'list_item', ordered: false, text: 'Bullet', inline: [{ kind: 'text', text: 'Bullet' }] },
      { type: 'list_item', ordered: true, text: 'Ordered', inline: [{ kind: 'text', text: 'Ordered' }] },
      { type: 'code_block', language: 'ts', code: 'const answer = 42;' },
    ]);
  });

  it('keeps an empty document as an empty paragraph block', () => {
    const result = documentToAuraIntent(makeDocument(''));

    expect(result.value.content).toEqual([{ type: 'paragraph', text: '', inline: [] }]);
  });

  it('falls back from malformed block editor item data with a warning', () => {
    const malformed = JSON.stringify([
      {
        reactBlockTextVersion: 'test',
        id: 'bad-block',
        type: 'text',
        data: 'visible text from malformed JSON',
      },
    ]);

    const result = documentToAuraIntent(makeDocument(malformed));

    expect(result.warnings).toContainEqual({
      code: 'MALFORMED_CONTENT',
      message: 'Cannot parse block editor item JSON.',
    });
    expect(result.value.content).toEqual([
      {
        type: 'paragraph',
        text: 'visible text from malformed JSON',
        inline: [{ kind: 'text', text: 'visible text from malformed JSON' }],
      },
    ]);
  });

  it('preserves Vietnamese unicode text', () => {
    const text = 'Tiếng Việt có dấu: ă â ê ô ơ ư đ';
    const result = documentToAuraIntent(makeDocument(text));

    expect(result.value.content[0]).toMatchObject({ type: 'paragraph', text });
    expect(computeAuraPlainText(result.value)).toBe(text);
  });

  it('converts structured inline bold, italic, code, and bold-italic spans', () => {
    const result = documentToAuraIntent(makeDocument(blockEditorValue([
      {
        text: 'Bold Italic Code Both',
        type: 'unstyled',
        inlineStyleRanges: [
          { offset: 0, length: 4, style: 'BOLD' },
          { offset: 5, length: 6, style: 'ITALIC' },
          { offset: 12, length: 4, style: 'CODE' },
          { offset: 17, length: 4, style: 'BOLD' },
          { offset: 17, length: 4, style: 'ITALIC' },
        ],
      },
    ])));

    expect(result.value.content[0]).toEqual({
      type: 'paragraph',
      text: 'Bold Italic Code Both',
      inline: [
        { kind: 'bold', text: 'Bold' },
        { kind: 'text', text: ' ' },
        { kind: 'italic', text: 'Italic' },
        { kind: 'text', text: ' ' },
        { kind: 'code', text: 'Code' },
        { kind: 'text', text: ' ' },
        { kind: 'bold_italic', text: 'Both' },
      ],
    });
  });

  it('converts AuraDocument back to frontend Document and computes metadata', () => {
    const auraDocument: AuraIntentDocument = {
      id: 'intent-1',
      intent_name: 'Imported Intent',
      version: 7,
      created_at: Date.parse('2026-04-24T10:00:00.000Z'),
      updated_at: Date.parse('2026-04-25T10:00:00.000Z'),
      content: [
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'paragraph', text: 'Mot hai ba', inline: [{ kind: 'text', text: 'Mot hai ba' }] },
      ],
    };

    const result = auraIntentToDocument(auraDocument);

    expect(result.value).toMatchObject({
      id: 'intent-1',
      title: 'Imported Intent',
      version: 7,
      metadata: { wordCount: 4, readingTime: 1, status: 'draft', tags: [] },
    });
    expect(result.value.lastModified.toISOString()).toBe('2026-04-25T10:00:00.000Z');
    expect(extractPlainText(result.value.content)).toBe('Title\nMot hai ba');
  });
});
