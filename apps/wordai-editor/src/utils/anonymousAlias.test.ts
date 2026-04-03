/**
 * Unit tests for anonymousAlias utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getAnonymousAlias, clearAnonymousAlias } from './anonymousAlias';

const ALIAS_KEY = 'wordai_anonymous_alias';

beforeEach(() => {
  localStorage.clear();
});

describe('getAnonymousAlias', () => {
  it('returns a non-empty string', () => {
    const alias = getAnonymousAlias();
    expect(alias).toBeTruthy();
    expect(typeof alias).toBe('string');
  });

  it('returns a two-word alias (adjective + animal)', () => {
    const alias = getAnonymousAlias();
    const parts = alias.split(' ');
    expect(parts).toHaveLength(2);
  });

  it('persists the same alias across multiple calls', () => {
    const first = getAnonymousAlias();
    const second = getAnonymousAlias();
    expect(first).toBe(second);
  });

  it('stores the alias in localStorage', () => {
    const alias = getAnonymousAlias();
    expect(localStorage.getItem(ALIAS_KEY)).toBe(alias);
  });

  it('reuses an existing alias from localStorage', () => {
    localStorage.setItem(ALIAS_KEY, 'Brave Capybara');
    const alias = getAnonymousAlias();
    expect(alias).toBe('Brave Capybara');
  });
});

describe('clearAnonymousAlias', () => {
  it('removes the alias from localStorage', () => {
    getAnonymousAlias();
    clearAnonymousAlias();
    expect(localStorage.getItem(ALIAS_KEY)).toBeNull();
  });

  it('getAnonymousAlias generates a new alias after clearing', () => {
    localStorage.setItem(ALIAS_KEY, 'Brave Capybara');
    clearAnonymousAlias();
    const alias = getAnonymousAlias();
    expect(alias).not.toBe('Brave Capybara');
  });
});
