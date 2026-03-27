import { describe, it, expect } from 'vitest';
import {
  blockTextValueFromPlainText,
  ensureBlockValue,
  extractPlainText,
  replaceTextInBlockValue,
} from './blockText';

describe('blockText utilities', () => {
  it('creates a block-text value that round-trips to plain text', () => {
    const value = blockTextValueFromPlainText('hello world');
    expect(extractPlainText(value)).toBe('hello world');
  });

  it('ensures plain text is converted to block-text format', () => {
    const ensured = ensureBlockValue('just text');
    expect(extractPlainText(ensured)).toBe('just text');
  });

  it('replaces text inside a block-text value', () => {
    const value = blockTextValueFromPlainText('replace me');
    const updated = replaceTextInBlockValue(value, 'replace', 'keep');
    expect(extractPlainText(updated)).toBe('keep me');
  });
});
