import { describe, it, expect } from 'vitest';
import { applyArchiveFilters, sortVersionsByDate, truncateReason } from './archiveFilters';
import type { ArchivedIntentSummary, ArchivedVersion, ArchiveFilters } from '../types/archiveTypes';

function makeSummary(overrides: Partial<ArchivedIntentSummary> = {}): ArchivedIntentSummary {
  return {
    id: 'test-id',
    intent_name: 'Test Document',
    archived_at: 1700000000,
    archive_reason: 'Outdated content',
    archive_type: 'draft',
    related_current_id: null,
    memory_access_enabled: true,
    created_at: 1690000000,
    updated_at: 1695000000,
    version: 1,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<ArchivedVersion> = {}): ArchivedVersion {
  return {
    id: 'ver-1',
    intent_name: 'Doc v1',
    version: 1,
    archived_at: 1700000000,
    archive_reason: 'Superseded',
    related_current_id: null,
    ...overrides,
  };
}

const defaultFilters: ArchiveFilters = { types: [], dateRange: 'all' };

describe('applyArchiveFilters', () => {
  it('returns all items sorted when no query and no filters', () => {
    const items = [
      makeSummary({ id: 'a', archived_at: 100 }),
      makeSummary({ id: 'b', archived_at: 300 }),
      makeSummary({ id: 'c', archived_at: 200 }),
    ];
    const result = applyArchiveFilters(items, '', defaultFilters);
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by case-insensitive query on intent_name', () => {
    const items = [
      makeSummary({ id: 'a', intent_name: 'Hello World' }),
      makeSummary({ id: 'b', intent_name: 'Goodbye' }),
    ];
    const result = applyArchiveFilters(items, 'hello', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('filters by case-insensitive query on archive_reason', () => {
    const items = [
      makeSummary({ id: 'a', archive_reason: 'No longer needed' }),
      makeSummary({ id: 'b', archive_reason: 'Still relevant' }),
    ];
    const result = applyArchiveFilters(items, 'NEEDED', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('ignores whitespace-only query', () => {
    const items = [makeSummary({ id: 'a' }), makeSummary({ id: 'b' })];
    const result = applyArchiveFilters(items, '   ', defaultFilters);
    expect(result).toHaveLength(2);
  });

  it('filters by type', () => {
    const items = [
      makeSummary({ id: 'a', archive_type: 'draft' }),
      makeSummary({ id: 'b', archive_type: 'version' }),
      makeSummary({ id: 'c', archive_type: 'project_doc' }),
    ];
    const filters: ArchiveFilters = { types: ['versions'], dateRange: 'all' };
    const result = applyArchiveFilters(items, '', filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('filters by multiple types', () => {
    const items = [
      makeSummary({ id: 'a', archive_type: 'draft' }),
      makeSummary({ id: 'b', archive_type: 'version' }),
      makeSummary({ id: 'c', archive_type: 'project_doc' }),
    ];
    const filters: ArchiveFilters = { types: ['suggestions', 'paused_projects'], dateRange: 'all' };
    const result = applyArchiveFilters(items, '', filters);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id).sort()).toEqual(['a', 'c']);
  });

  it('filters by date range', () => {
    const now = Math.floor(Date.now() / 1000);
    const items = [
      makeSummary({ id: 'recent', archived_at: now - 3 * 86400 }), // 3 days ago
      makeSummary({ id: 'old', archived_at: now - 10 * 86400 }), // 10 days ago
    ];
    const filters: ArchiveFilters = { types: [], dateRange: 'last_7_days' };
    const result = applyArchiveFilters(items, '', filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('recent');
  });

  it('combines query and type filter', () => {
    const items = [
      makeSummary({ id: 'a', intent_name: 'Draft Report', archive_type: 'draft' }),
      makeSummary({ id: 'b', intent_name: 'Version Report', archive_type: 'version' }),
      makeSummary({ id: 'c', intent_name: 'Draft Notes', archive_type: 'draft' }),
    ];
    const filters: ArchiveFilters = { types: ['suggestions'], dateRange: 'all' };
    const result = applyArchiveFilters(items, 'report', filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('does not mutate the original array', () => {
    const items = [
      makeSummary({ id: 'a', archived_at: 100 }),
      makeSummary({ id: 'b', archived_at: 200 }),
    ];
    const original = [...items];
    applyArchiveFilters(items, '', defaultFilters);
    expect(items).toEqual(original);
  });
});

describe('sortVersionsByDate', () => {
  it('sorts versions by archived_at descending', () => {
    const versions = [
      makeVersion({ id: 'a', archived_at: 100 }),
      makeVersion({ id: 'b', archived_at: 300 }),
      makeVersion({ id: 'c', archived_at: 200 }),
    ];
    const result = sortVersionsByDate(versions);
    expect(result.map((v) => v.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns empty array for empty input', () => {
    expect(sortVersionsByDate([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const versions = [
      makeVersion({ id: 'a', archived_at: 100 }),
      makeVersion({ id: 'b', archived_at: 200 }),
    ];
    const original = [...versions];
    sortVersionsByDate(versions);
    expect(versions).toEqual(original);
  });

  it('handles equal timestamps', () => {
    const versions = [
      makeVersion({ id: 'a', archived_at: 100 }),
      makeVersion({ id: 'b', archived_at: 100 }),
    ];
    const result = sortVersionsByDate(versions);
    expect(result).toHaveLength(2);
    // Both have same timestamp, order is stable
    expect(result[0].archived_at).toBe(100);
    expect(result[1].archived_at).toBe(100);
  });
});

describe('truncateReason', () => {
  it('returns placeholder for null', () => {
    expect(truncateReason(null)).toBe('No reason provided');
  });

  it('returns placeholder for undefined', () => {
    expect(truncateReason(undefined)).toBe('No reason provided');
  });

  it('returns placeholder for empty string', () => {
    expect(truncateReason('')).toBe('No reason provided');
  });

  it('returns reason unchanged when <= 200 chars', () => {
    const reason = 'Short reason';
    expect(truncateReason(reason)).toBe(reason);
  });

  it('returns reason unchanged when exactly 200 chars', () => {
    const reason = 'a'.repeat(200);
    expect(truncateReason(reason)).toBe(reason);
  });

  it('truncates with ellipsis when > 200 chars', () => {
    const reason = 'a'.repeat(250);
    const result = truncateReason(reason);
    expect(result).toBe('a'.repeat(200) + '…');
    expect(result.length).toBe(201); // 200 chars + 1 ellipsis char
  });

  it('uses custom placeholder', () => {
    expect(truncateReason(null, 200, 'Custom placeholder')).toBe('Custom placeholder');
  });

  it('uses custom maxLength', () => {
    const reason = 'Hello World';
    expect(truncateReason(reason, 5)).toBe('Hello…');
  });
});
