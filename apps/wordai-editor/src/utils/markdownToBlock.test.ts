import { describe, it, expect } from 'vitest';
import { markdownToBlock, ParseError } from './markdownToBlock';

describe('markdownToBlock', () => {
  describe('empty input', () => {
    it('returns "[]" for empty string', () => {
      expect(markdownToBlock('')).toBe('[]');
    });

    it('returns "[]" for whitespace-only string', () => {
      expect(markdownToBlock('   \n\n  ')).toBe('[]');
    });
  });

  describe('headings', () => {
    it('parses h1', () => {
      const result = JSON.parse(markdownToBlock('# Hello'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('header');
      expect(result[0].level).toBe(1);
      expect(result[0].text).toBe('Hello');
      expect(result[0].id).toBeDefined();
    });

    it('parses h2 through h6', () => {
      const md = '## Level 2\n### Level 3\n#### Level 4\n##### Level 5\n###### Level 6';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(5);
      expect(result[0].level).toBe(2);
      expect(result[1].level).toBe(3);
      expect(result[2].level).toBe(4);
      expect(result[3].level).toBe(5);
      expect(result[4].level).toBe(6);
    });

    it('does not parse more than 6 hashes as heading', () => {
      const result = JSON.parse(markdownToBlock('####### Not a heading'));
      expect(result[0].type).toBe('paragraph');
    });
  });

  describe('paragraphs', () => {
    it('parses a plain text line as paragraph', () => {
      const result = JSON.parse(markdownToBlock('Hello world'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('paragraph');
      expect(result[0].text).toBe('Hello world');
    });

    it('parses multiple paragraphs separated by empty lines', () => {
      const md = 'First paragraph\n\nSecond paragraph';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('First paragraph');
      expect(result[1].text).toBe('Second paragraph');
    });
  });

  describe('code blocks', () => {
    it('parses a fenced code block with language', () => {
      const md = '```typescript\nconst x = 1;\n```';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('code');
      expect(result[0].language).toBe('typescript');
      expect(result[0].text).toBe('const x = 1;');
    });

    it('parses a fenced code block without language', () => {
      const md = '```\nhello\nworld\n```';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('code');
      expect(result[0].language).toBe('');
      expect(result[0].text).toBe('hello\nworld');
    });

    it('handles code block with empty content', () => {
      const md = '```js\n```';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('code');
      expect(result[0].text).toBe('');
    });
  });

  describe('quotes', () => {
    it('parses a blockquote', () => {
      const result = JSON.parse(markdownToBlock('> This is a quote'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('quote');
      expect(result[0].text).toBe('This is a quote');
    });
  });

  describe('todos', () => {
    it('parses an unchecked todo', () => {
      const result = JSON.parse(markdownToBlock('- [ ] Buy milk'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('todo');
      expect(result[0].checked).toBe(false);
      expect(result[0].text).toBe('Buy milk');
    });

    it('parses a checked todo', () => {
      const result = JSON.parse(markdownToBlock('- [x] Done task'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('todo');
      expect(result[0].checked).toBe(true);
      expect(result[0].text).toBe('Done task');
    });
  });

  describe('unordered lists', () => {
    it('parses unordered list items with dash', () => {
      const md = '- Item 1\n- Item 2\n- Item 3';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('list');
      expect(result[0].ordered).toBe(false);
      expect(result[0].items).toHaveLength(3);
      expect(result[0].items[0].text).toBe('Item 1');
      expect(result[0].items[1].text).toBe('Item 2');
      expect(result[0].items[2].text).toBe('Item 3');
    });

    it('parses unordered list items with asterisk', () => {
      const md = '* Alpha\n* Beta';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('list');
      expect(result[0].ordered).toBe(false);
      expect(result[0].items).toHaveLength(2);
    });

    it('assigns sequential index to unordered list items', () => {
      const md = '- A\n- B';
      const result = JSON.parse(markdownToBlock(md));
      expect(result[0].items[0].index).toBe(1);
      expect(result[0].items[1].index).toBe(2);
    });
  });

  describe('ordered lists', () => {
    it('parses ordered list items', () => {
      const md = '1. First\n2. Second\n3. Third';
      const result = JSON.parse(markdownToBlock(md));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('list');
      expect(result[0].ordered).toBe(true);
      expect(result[0].items).toHaveLength(3);
      expect(result[0].items[0]).toEqual({ index: 1, text: 'First' });
      expect(result[0].items[1]).toEqual({ index: 2, text: 'Second' });
      expect(result[0].items[2]).toEqual({ index: 3, text: 'Third' });
    });
  });

  describe('unique IDs', () => {
    it('assigns unique IDs to each block', () => {
      const md = '# Title\n\nParagraph\n\n> Quote';
      const result = JSON.parse(markdownToBlock(md));
      const ids = result.map((b: { id: string }) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('mixed content', () => {
    it('parses a document with multiple block types', () => {
      const md = [
        '# Title',
        '',
        'A paragraph.',
        '',
        '- [x] Done',
        '- [ ] Not done',
        '',
        '> A quote',
        '',
        '```js',
        'console.log("hi");',
        '```',
        '',
        '1. One',
        '2. Two',
      ].join('\n');

      const result = JSON.parse(markdownToBlock(md));
      expect(result[0].type).toBe('header');
      expect(result[1].type).toBe('paragraph');
      expect(result[2].type).toBe('todo');
      expect(result[3].type).toBe('todo');
      expect(result[4].type).toBe('quote');
      expect(result[5].type).toBe('code');
      expect(result[6].type).toBe('list');
    });
  });

  describe('ParseError class', () => {
    it('is exported and extends Error', () => {
      const err = new ParseError('test error', 5);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ParseError');
      expect(err.message).toBe('test error');
      expect(err.line).toBe(5);
    });
  });
});
