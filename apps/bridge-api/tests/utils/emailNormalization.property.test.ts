/**
 * Property-based tests for email normalization.
 *
 * Property 7: Email Normalization Idempotence
 *   Validates: Requirements 2.9
 *
 * For any email address string, normalizing it twice SHALL produce the same
 * result as normalizing it once: normalize(normalize(email)) = normalize(email).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeEmail } from '../../src/utils/emailUtils';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates arbitrary email-like strings including:
 * - Mixed case characters
 * - Leading/trailing whitespace
 * - Tabs and newlines as whitespace variants
 * - Valid email addresses
 */
const emailWithVariousWhitespaceArb = fc.oneof(
  // Standard email addresses with mixed case
  fc.emailAddress(),
  // Email with leading/trailing spaces
  fc.emailAddress().map((e) => `  ${e}  `),
  // Email with leading/trailing tabs
  fc.emailAddress().map((e) => `\t${e}\t`),
  // Mixed case email
  fc.emailAddress().map((e) =>
    e
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
      .join(''),
  ),
  // Arbitrary strings (non-whitespace content preserved)
  fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 10 }).map((s) => s.replace(/\S/g, ' ')),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.string({ minLength: 0, maxLength: 10 }).map((s) => s.replace(/\S/g, ' ')),
    )
    .map(([leading, content, trailing]) => `${leading}${content}${trailing}`),
);

// ---------------------------------------------------------------------------
// Property 7: Email Normalization Idempotence
// Validates: Requirements 2.9
// ---------------------------------------------------------------------------

describe('Property 7: Email Normalization Idempotence', () => {
  /**
   * **Validates: Requirements 2.9**
   *
   * For any email address string, normalizing it twice SHALL produce the same
   * result as normalizing it once: normalize(normalize(email)) = normalize(email).
   */
  it('normalize(normalize(email)) === normalize(email) for any input', () => {
    fc.assert(
      fc.property(emailWithVariousWhitespaceArb, (email) => {
        const once = normalizeEmail(email);
        const twice = normalizeEmail(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });

  it('result is always lowercase for any input', () => {
    fc.assert(
      fc.property(emailWithVariousWhitespaceArb, (email) => {
        const normalized = normalizeEmail(email);
        expect(normalized).toBe(normalized.toLowerCase());
      }),
      { numRuns: 100 },
    );
  });

  it('result has no leading or trailing whitespace for any input', () => {
    fc.assert(
      fc.property(emailWithVariousWhitespaceArb, (email) => {
        const normalized = normalizeEmail(email);
        expect(normalized).toBe(normalized.trim());
      }),
      { numRuns: 100 },
    );
  });

  it('non-whitespace content is preserved after normalization', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (email) => {
          const normalized = normalizeEmail(email);
          // The trimmed, lowercased version of the original should equal the normalized result
          expect(normalized).toBe(email.toLowerCase().trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based tests for clarity
  it('lowercases uppercase email', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  it('trims leading whitespace', () => {
    expect(normalizeEmail('  user@example.com')).toBe('user@example.com');
  });

  it('trims trailing whitespace', () => {
    expect(normalizeEmail('user@example.com  ')).toBe('user@example.com');
  });

  it('trims both leading and trailing whitespace', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('is idempotent on already-normalized email', () => {
    const email = 'user@example.com';
    expect(normalizeEmail(normalizeEmail(email))).toBe(normalizeEmail(email));
  });
});
