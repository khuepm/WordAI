/**
 * Property 7: Source Detection Determinism
 *
 * detectSource trả về kind tương ứng extension, không throw.
 * Với cùng input, detectSource luôn trả về cùng output (deterministic).
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.6**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { detectSource, type IntentLike } from '../intentSourceService';

// Mock auraBundleService.loadBundle to return null (test extension-based detection)
vi.mock('../auraBundleService', () => ({
  auraBundleService: {
    loadBundle: () => null,
    saveBundle: async () => {},
  },
}));

// --- Valid kinds ---
const VALID_KINDS = ['markdown', 'html', 'docx', 'aura'] as const;

// --- Arbitraries ---

/** Generate safe filename characters (alphanumeric + some safe chars) */
const safeFileCharArb = fc
  .integer({ min: 97, max: 122 }) // a-z
  .map((code) => String.fromCharCode(code));

/** Generate random file name base (without extension) */
const fileNameBaseArb = fc
  .array(safeFileCharArb, { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

/** Generate random directory path */
const dirPathArb = fc
  .array(
    fc.array(safeFileCharArb, { minLength: 1, maxLength: 10 }).map((chars) => chars.join('')),
    { minLength: 0, maxLength: 3 }
  )
  .map((parts) => (parts.length > 0 ? '/' + parts.join('/') + '/' : '/'));

/** Generate .docx extension with random casing */
const docxExtArb = fc
  .tuple(
    fc.constantFrom('d', 'D'),
    fc.constantFrom('o', 'O'),
    fc.constantFrom('c', 'C'),
    fc.constantFrom('x', 'X')
  )
  .map(([d, o, c, x]) => `.${d}${o}${c}${x}`);

/** Generate .md or .markdown extension with random casing */
const markdownExtArb = fc.oneof(
  fc
    .tuple(fc.constantFrom('m', 'M'), fc.constantFrom('d', 'D'))
    .map(([m, d]) => `.${m}${d}`),
  fc
    .tuple(
      fc.constantFrom('m', 'M'),
      fc.constantFrom('a', 'A'),
      fc.constantFrom('r', 'R'),
      fc.constantFrom('k', 'K'),
      fc.constantFrom('d', 'D'),
      fc.constantFrom('o', 'O'),
      fc.constantFrom('w', 'W'),
      fc.constantFrom('n', 'N')
    )
    .map(([m, a, r, k, d, o, w, n]) => `.${m}${a}${r}${k}${d}${o}${w}${n}`)
);

/** Generate .html or .htm extension with random casing */
const htmlExtArb = fc.oneof(
  fc
    .tuple(
      fc.constantFrom('h', 'H'),
      fc.constantFrom('t', 'T'),
      fc.constantFrom('m', 'M'),
      fc.constantFrom('l', 'L')
    )
    .map(([h, t, m, l]) => `.${h}${t}${m}${l}`),
  fc
    .tuple(
      fc.constantFrom('h', 'H'),
      fc.constantFrom('t', 'T'),
      fc.constantFrom('m', 'M')
    )
    .map(([h, t, m]) => `.${h}${t}${m}`)
);

/** Generate a sourcePath with .docx extension */
const docxPathArb = fc
  .tuple(dirPathArb, fileNameBaseArb, docxExtArb)
  .map(([dir, name, ext]) => `${dir}${name}${ext}`);

/** Generate a sourcePath with .md/.markdown extension */
const markdownPathArb = fc
  .tuple(dirPathArb, fileNameBaseArb, markdownExtArb)
  .map(([dir, name, ext]) => `${dir}${name}${ext}`);

/** Generate a sourcePath with .html/.htm extension */
const htmlPathArb = fc
  .tuple(dirPathArb, fileNameBaseArb, htmlExtArb)
  .map(([dir, name, ext]) => `${dir}${name}${ext}`);

/** Generate random extension that is NOT one of the known ones */
const randomExtArb = fc
  .array(safeFileCharArb, { minLength: 1, maxLength: 6 })
  .map((chars) => chars.join(''))
  .filter((s) => {
    const lower = s.toLowerCase();
    return (
      lower !== 'docx' &&
      lower !== 'md' &&
      lower !== 'markdown' &&
      lower !== 'html' &&
      lower !== 'htm'
    );
  })
  .map((ext) => `.${ext}`);

/** Generate a sourcePath with random (unknown) extension */
const randomPathArb = fc
  .tuple(dirPathArb, fileNameBaseArb, randomExtArb)
  .map(([dir, name, ext]) => `${dir}${name}${ext}`);

/** Generate an intent with a given sourcePath */
function intentWithPath(sourcePath: string | null | undefined): IntentLike {
  return {
    id: 'test-intent-id',
    metadata: { sourcePath },
  };
}

/** Generate arbitrary intent-like inputs including edge cases */
const arbitraryIntentArb: fc.Arbitrary<IntentLike | null | undefined> = fc.oneof(
  // null/undefined intent
  fc.constant(null),
  fc.constant(undefined),
  // intent with null/undefined metadata
  fc.constant({ id: 'test', metadata: null } as IntentLike),
  fc.constant({ id: 'test', metadata: undefined } as IntentLike),
  // intent with null/undefined/empty sourcePath
  fc.constant({ id: 'test', metadata: { sourcePath: null } } as IntentLike),
  fc.constant({ id: 'test', metadata: { sourcePath: undefined } } as IntentLike),
  fc.constant({ id: 'test', metadata: { sourcePath: '' } } as IntentLike),
  // intent with random string sourcePath
  fc.string({ minLength: 0, maxLength: 200 }).map((s) => ({
    id: 'test',
    metadata: { sourcePath: s },
  }))
);

// --- Property tests ---

describe('Property 7: Source Detection Determinism', () => {
  it('.docx extension (case-insensitive) → kind is always "docx"', () => {
    fc.assert(
      fc.property(docxPathArb, (sourcePath) => {
        const intent = intentWithPath(sourcePath);
        const result = detectSource(intent);
        expect(result.kind).toBe('docx');
        expect(result).toHaveProperty('filePath', sourcePath);
      }),
      { numRuns: 200 }
    );
  });

  it('.md or .markdown extension (case-insensitive) → kind is always "markdown"', () => {
    fc.assert(
      fc.property(markdownPathArb, (sourcePath) => {
        const intent = intentWithPath(sourcePath);
        const result = detectSource(intent);
        expect(result.kind).toBe('markdown');
        expect(result).toHaveProperty('filePath', sourcePath);
      }),
      { numRuns: 200 }
    );
  });

  it('.html or .htm extension (case-insensitive) → kind is always "html"', () => {
    fc.assert(
      fc.property(htmlPathArb, (sourcePath) => {
        const intent = intentWithPath(sourcePath);
        const result = detectSource(intent);
        expect(result.kind).toBe('html');
        expect(result).toHaveProperty('filePath', sourcePath);
      }),
      { numRuns: 200 }
    );
  });

  it('detectSource NEVER throws for any input (including null, undefined, random strings)', () => {
    fc.assert(
      fc.property(arbitraryIntentArb, (intent) => {
        // Should never throw
        const result = detectSource(intent);
        // Should always return a valid PrismSourceFormat
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(VALID_KINDS).toContain(result.kind);
      }),
      { numRuns: 500 }
    );
  });

  it('detectSource always returns exactly one of the 4 valid kinds', () => {
    const allInputsArb = fc.oneof(
      docxPathArb.map((p) => intentWithPath(p)),
      markdownPathArb.map((p) => intentWithPath(p)),
      htmlPathArb.map((p) => intentWithPath(p)),
      randomPathArb.map((p) => intentWithPath(p)),
      fc.constant(intentWithPath(null)),
      fc.constant(intentWithPath(undefined)),
      fc.constant(intentWithPath('')),
      fc.string({ minLength: 0, maxLength: 200 }).map((s) => intentWithPath(s))
    );

    fc.assert(
      fc.property(allInputsArb, (intent) => {
        const result = detectSource(intent);
        expect(VALID_KINDS).toContain(result.kind);
        expect(typeof result.kind).toBe('string');
      }),
      { numRuns: 500 }
    );
  });

  it('detectSource is deterministic: same input always produces same output', () => {
    const allInputsArb = fc.oneof(
      docxPathArb.map((p) => intentWithPath(p)),
      markdownPathArb.map((p) => intentWithPath(p)),
      htmlPathArb.map((p) => intentWithPath(p)),
      randomPathArb.map((p) => intentWithPath(p)),
      fc.string({ minLength: 0, maxLength: 200 }).map((s) => intentWithPath(s))
    );

    fc.assert(
      fc.property(allInputsArb, (intent) => {
        const result1 = detectSource(intent);
        const result2 = detectSource(intent);
        expect(result1).toEqual(result2);
      }),
      { numRuns: 300 }
    );
  });
});
