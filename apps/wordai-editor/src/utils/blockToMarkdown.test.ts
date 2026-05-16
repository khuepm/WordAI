import { describe, it, expect } from 'vitest';
import { blockToMarkdown } from './blockToMarkdown';

describe('blockToMarkdown', () => {
  describe('header blocks', () => {
    it('converts h1 header', () => {
      const blocks = JSON.stringify([{ type: 'header', level: 1, text: 'Title' }]);
      expect(blockToMarkdown(blocks)).toBe('# Title');
    });

    it('converts h2 through h6 headers', () => {
      for (let level = 2; level <= 6; level++) {
        const blocks = JSON.stringify([{ type: 'header', level, text: `Heading ${level}` }]);
        expect(blockToMarkdown(blocks)).toBe(`${'#'.repeat(level)} Heading ${level}`);
      }
    });

    it('clamps level to 1-6 range', () => {
      const tooHigh = JSON.stringify([{ type: 'header', level: 10, text: 'Clamped' }]);
      expect(blockToMarkdown(tooHigh)).toBe('###### Clamped');

      const tooLow = JSON.stringify([{ type: 'header', level: 0, text: 'Clamped' }]);
      expect(blockToMarkdown(tooLow)).toBe('# Clamped');
    });
  });

  describe('paragraph blocks', () => {
    it('converts paragraph to text with double newline', () => {
      const blocks = JSON.stringify([{ type: 'paragraph', text: 'Hello world' }]);
      expect(blockToMarkdown(blocks)).toBe('Hello world');
    });

    it('handles multiple paragraphs', () => {
      const blocks = JSON.stringify([
        { type: 'paragraph', text: 'First' },
        { type: 'paragraph', text: 'Second' },
      ]);
      expect(blockToMarkdown(blocks)).toBe('First\n\nSecond');
    });
  });

  describe('list blocks', () => {
    it('converts unordered list', () => {
      const blocks = JSON.stringify([
        { type: 'list', ordered: false, items: [{ text: 'Item 1' }, { text: 'Item 2' }] },
      ]);
      expect(blockToMarkdown(blocks)).toBe('- Item 1\n- Item 2');
    });

    it('converts ordered list', () => {
      const blocks = JSON.stringify([
        {
          type: 'list',
          ordered: true,
          items: [
            { index: 1, text: 'First' },
            { index: 2, text: 'Second' },
          ],
        },
      ]);
      expect(blockToMarkdown(blocks)).toBe('1. First\n2. Second');
    });

    it('uses fallback index for ordered list without explicit index', () => {
      const blocks = JSON.stringify([
        { type: 'list', ordered: true, items: [{ text: 'A' }, { text: 'B' }] },
      ]);
      expect(blockToMarkdown(blocks)).toBe('1. A\n2. B');
    });
  });

  describe('quote blocks', () => {
    it('converts quote block', () => {
      const blocks = JSON.stringify([{ type: 'quote', text: 'A wise saying' }]);
      expect(blockToMarkdown(blocks)).toBe('> A wise saying');
    });
  });

  describe('todo blocks', () => {
    it('converts unchecked todo', () => {
      const blocks = JSON.stringify([{ type: 'todo', checked: false, text: 'Buy milk' }]);
      expect(blockToMarkdown(blocks)).toBe('- [ ] Buy milk');
    });

    it('converts checked todo', () => {
      const blocks = JSON.stringify([{ type: 'todo', checked: true, text: 'Done task' }]);
      expect(blockToMarkdown(blocks)).toBe('- [x] Done task');
    });
  });

  describe('code blocks', () => {
    it('converts code block with language', () => {
      const blocks = JSON.stringify([{ type: 'code', language: 'typescript', text: 'const x = 1;' }]);
      expect(blockToMarkdown(blocks)).toBe('```typescript\nconst x = 1;\n```');
    });

    it('converts code block without language', () => {
      const blocks = JSON.stringify([{ type: 'code', text: 'plain code' }]);
      expect(blockToMarkdown(blocks)).toBe('```\nplain code\n```');
    });
  });

  describe('unsupported block types', () => {
    it('renders unsupported block as fenced JSON code block', () => {
      const block = { type: 'table', rows: [[1, 2], [3, 4]] };
      const blocks = JSON.stringify([block]);
      expect(blockToMarkdown(blocks)).toBe('```json\n' + JSON.stringify(block) + '\n```');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(blockToMarkdown('')).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(blockToMarkdown('[]')).toBe('');
    });

    it('returns empty string for invalid JSON', () => {
      expect(blockToMarkdown('not json')).toBe('');
    });

    it('returns empty string for non-array JSON', () => {
      expect(blockToMarkdown('{"type": "header"}')).toBe('');
    });

    it('handles null/undefined text gracefully', () => {
      const blocks = JSON.stringify([{ type: 'paragraph' }]);
      expect(blockToMarkdown(blocks)).toBe('');
    });

    it('skips null entries in the array', () => {
      const blocks = JSON.stringify([null, { type: 'paragraph', text: 'Hello' }]);
      expect(blockToMarkdown(blocks)).toBe('Hello');
    });
  });

  describe('mixed block types', () => {
    it('converts a document with multiple block types', () => {
      const blocks = JSON.stringify([
        { type: 'header', level: 1, text: 'My Document' },
        { type: 'paragraph', text: 'Introduction paragraph.' },
        { type: 'list', ordered: false, items: [{ text: 'Point A' }, { text: 'Point B' }] },
        { type: 'quote', text: 'Important note' },
        { type: 'code', language: 'js', text: 'console.log("hi")' },
      ]);

      const expected = [
        '# My Document',
        '',
        'Introduction paragraph.',
        '',
        '- Point A',
        '- Point B',
        '',
        '> Important note',
        '',
        '```js',
        'console.log("hi")',
        '```',
      ].join('\n');

      expect(blockToMarkdown(blocks)).toBe(expected);
    });
  });
});
