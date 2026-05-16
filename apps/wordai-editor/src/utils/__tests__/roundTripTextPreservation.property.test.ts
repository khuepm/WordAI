/**
 * Property 1: Round-trip Text Preservation
 *
 * For any valid blockContent (array of supported block types),
 * converting to markdown via blockToMarkdown and back via markdownToBlock
 * SHALL preserve ALL plain text content. Block structure/formatting may
 * change slightly, but text MUST be preserved.
 *
 * **Validates: Requirements 4.4, 4.5, 4.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { blockToMarkdown } from '../blockToMarkdown';
import { markdownToBlock } from '../markdownToBlock';

// ---------------------------------------------------------------------------
// Arbitraries — generate blocks with supported types
// ---------------------------------------------------------------------------

/**
 * Generate safe plain text that does NOT contain markdown syntax characters.
 * This avoids text being reinterpreted as markdown on round-trip.
 */
const safeCharArb = fc
  .integer({ min: 32, max: 126 })
  .filter((code) => {
    const c = String.fromCharCode(code);
    const forbidden = '#>-*`[]()\\!|~_=+';
    return !forbidden.includes(c);
  })
  .map((code) => String.fromCharCode(code));

const safeTextArb = fc
  .array(safeCharArb, { minLength: 1, maxLength: 80 })
  .map((chars) => chars.join('').trim())
  .filter((s) => s.length > 0);

/**
 * Generate a safe text that also avoids starting with digits followed by a dot
 * (which would be interpreted as an ordered list item).
 */
const safeParagraphTextArb = safeTextArb.filter((s) => !/^\d+\.\s/.test(s));

const headerBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('header' as const),
  level: fc.integer({ min: 1, max: 6 }),
  text: safeTextArb,
});

const paragraphBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('paragraph' as const),
  text: safeParagraphTextArb,
});

const listItemArb = fc.record({
  index: fc.integer({ min: 1, max: 99 }),
  text: safeTextArb,
});

const listBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('list' as const),
  ordered: fc.boolean(),
  items: fc.array(listItemArb, { minLength: 1, maxLength: 5 }),
});

const quoteBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('quote' as const),
  text: safeTextArb,
});

const todoBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('todo' as const),
  checked: fc.boolean(),
  text: safeTextArb,
});

const codeBlockArb = fc.record({
  id: fc.uuid(),
  type: fc.constant('code' as const),
  language: fc.constantFrom('', 'javascript', 'typescript', 'python', 'rust'),
  text: safeTextArb,
});

const blockArb = fc.oneof(
  headerBlockArb,
  paragraphBlockArb,
  listBlockArb,
  quoteBlockArb,
  todoBlockArb,
  codeBlockArb
);

const blockContentArb = fc
  .array(blockArb, { minLength: 1, maxLength: 10 })
  .map((blocks) => JSON.stringify(blocks));

// ---------------------------------------------------------------------------
// Helper — extract plain text from blocks
// ---------------------------------------------------------------------------

interface BlockLike {
  type: string;
  text?: string;
  items?: { text?: string }[];
  [key: string]: unknown;
}

/**
 * Recursively extract all plain text from a block content JSON string.
 * Collects text from `text` fields and list item `text` fields.
 */
function extractPlainText(blockContentJson: string): string {
  let blocks: BlockLike[];
  try {
    blocks = JSON.parse(blockContentJson);
  } catch {
    return '';
  }

  if (!Array.isArray(blocks)) return '';

  const texts: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;

    if (block.type === 'list' && Array.isArray(block.items)) {
      for (const item of block.items) {
        if (item && typeof item.text === 'string') {
          texts.push(item.text);
        }
      }
    } else if (typeof block.text === 'string') {
      texts.push(block.text);
    }
  }

  return texts.join('\n');
}

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Property 1: Round-trip Text Preservation', () => {
  it('blockToMarkdown → markdownToBlock preserves all plain text content', () => {
    fc.assert(
      fc.property(blockContentArb, (content) => {
        const markdown = blockToMarkdown(content);
        const roundTripped = markdownToBlock(markdown);

        const originalText = extractPlainText(content);
        const roundTrippedText = extractPlainText(roundTripped);

        expect(roundTrippedText).toBe(originalText);
      }),
      { numRuns: 300 }
    );
  });
});
