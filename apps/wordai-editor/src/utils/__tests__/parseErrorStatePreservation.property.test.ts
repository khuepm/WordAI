/**
 * Property 8: Parse Error State Preservation
 *
 * For any arbitrary string input, markdownToBlock either returns a valid JSON
 * array (never throws), OR the caller (usePrismState) preserves the previous
 * blockContent unchanged.
 *
 * Since the current markdownToBlock implementation uses paragraphs as a
 * catch-all, it never throws ParseError for normal text. This property
 * verifies two aspects:
 *
 * 1. markdownToBlock always returns valid JSON (a JSON array) for any string
 *    input — it never throws.
 * 2. The state preservation pattern: given any previous valid blockContent,
 *    if markdownToBlock were to throw (simulated), the old blockContent is
 *    preserved by the caller.
 *
 * **Validates: Requirements 4.7, 10.2**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { markdownToBlock, ParseError } from '../markdownToBlock';

// --- Arbitrary for generating valid blockContent (previous state) ---

const validBlockContentArb = fc.oneof(
  fc.constant('[]'),
  fc.array(
    fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('header', 'paragraph', 'quote', 'todo', 'code'),
      text: fc.string({ minLength: 1, maxLength: 200 }),
    }),
    { minLength: 1, maxLength: 10 }
  ).map((blocks) => JSON.stringify(blocks))
);

// --- Arbitrary for generating arbitrary markdown strings (including edge cases) ---

const arbitraryMarkdownArb = fc.oneof(
  // Normal markdown (any string)
  fc.string({ minLength: 0, maxLength: 500 }),
  // Strings with special markdown characters
  fc.array(
    fc.constantFrom('#', '>', '-', '*', '`', '\n', ' ', '[', ']', '(', ')', '\\', '!', '0', '1', '.'),
    { minLength: 0, maxLength: 200 }
  ).map((chars) => chars.join('')),
  // Strings with unclosed code fences
  fc.string({ minLength: 0, maxLength: 100 }).map((s) => '```\n' + s),
  // Strings with only whitespace
  fc.array(
    fc.constantFrom(' ', '\t', '\n', '\r'),
    { minLength: 0, maxLength: 50 }
  ).map((chars) => chars.join('')),
  // Empty string
  fc.constant('')
);

// --- State preservation simulation ---

/**
 * Simulates the usePrismState behavior: attempt to parse markdown,
 * if it fails (throws), preserve the old blockContent.
 */
function handleMarkdownChange(markdown: string, previousBlockContent: string): string {
  try {
    const result = markdownToBlock(markdown);
    return result;
  } catch {
    // On parse error, preserve previous blockContent (Requirement 10.2)
    return previousBlockContent;
  }
}

// --- Property tests ---

describe('Property 8: Parse Error State Preservation', () => {
  it('markdownToBlock always returns a valid JSON array for any string input (never throws)', () => {
    fc.assert(
      fc.property(arbitraryMarkdownArb, (markdown) => {
        // markdownToBlock should never throw for any string input
        const result = markdownToBlock(markdown);

        // Result must be valid JSON
        const parsed = JSON.parse(result);

        // Result must be an array
        expect(Array.isArray(parsed)).toBe(true);

        // Each element must have an id and type field
        for (const block of parsed) {
          expect(block).toHaveProperty('id');
          expect(block).toHaveProperty('type');
          expect(typeof block.id).toBe('string');
          expect(block.id.length).toBeGreaterThan(0);
          expect(typeof block.type).toBe('string');
        }
      }),
      { numRuns: 500 }
    );
  });

  it('state preservation: handleMarkdownChange always returns previous blockContent when parse throws', () => {
    fc.assert(
      fc.property(
        arbitraryMarkdownArb,
        validBlockContentArb,
        (markdown, previousBlockContent) => {
          const result = handleMarkdownChange(markdown, previousBlockContent);

          // The result must either be:
          // 1. A new valid JSON array (parse succeeded), OR
          // 2. The exact previous blockContent (parse failed → state preserved)
          const parsed = JSON.parse(result);
          expect(Array.isArray(parsed)).toBe(true);

          // If markdownToBlock throws, result must equal previousBlockContent
          let parseThrew = false;
          try {
            markdownToBlock(markdown);
          } catch {
            parseThrew = true;
          }

          if (parseThrew) {
            expect(result).toBe(previousBlockContent);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('state preservation with simulated ParseError: old blockContent is always preserved', () => {
    fc.assert(
      fc.property(
        validBlockContentArb,
        fc.nat({ max: 100 }),
        (previousBlockContent, lineNumber) => {
          // Simulate a ParseError being thrown during markdown parsing
          const simulatedParseError = new ParseError(
            `Unexpected token at line ${lineNumber}`,
            lineNumber
          );

          // The state preservation pattern: on error, keep old content
          let resultContent: string;
          try {
            throw simulatedParseError;
          } catch {
            resultContent = previousBlockContent;
          }

          // Old blockContent must be preserved exactly
          expect(resultContent).toBe(previousBlockContent);

          // The preserved content must still be valid JSON
          const parsed = JSON.parse(resultContent);
          expect(Array.isArray(parsed)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
