import { describe, it, expect } from 'vitest';
import { SETTING_REGISTRY } from './settingRegistry';
import type { Tab } from '../types/preferences';

/**
 * Property tests for SettingRegistry completeness
 * Validates: Requirements 5.6
 */

const VALID_TABS: Tab[] = ['general', 'ai-engine', 'typography', 'privacy', 'about'];

describe('SettingRegistry — Property 1: Every SettingEntry has all required fields non-empty', () => {
  it('every entry has a non-empty id', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(entry.id, `entry.id should be non-empty`).toBeTruthy();
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(entry.label, `entry "${entry.id}" label should be non-empty`).toBeTruthy();
      expect(entry.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty description', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(entry.description, `entry "${entry.id}" description should be non-empty`).toBeTruthy();
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid tab field', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(VALID_TABS, `entry "${entry.id}" tab should be a valid Tab`).toContain(entry.tab);
    }
  });

  it('every entry has a non-empty keywords array', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(Array.isArray(entry.keywords), `entry "${entry.id}" keywords should be an array`).toBe(true);
      expect(entry.keywords.length, `entry "${entry.id}" keywords should not be empty`).toBeGreaterThan(0);
      for (const kw of entry.keywords) {
        expect(kw.trim().length, `entry "${entry.id}" keyword "${kw}" should be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every entry has a non-empty type', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(entry.type, `entry "${entry.id}" type should be non-empty`).toBeTruthy();
      expect(entry.type.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a defined defaultValue', () => {
    for (const entry of SETTING_REGISTRY) {
      expect(entry.defaultValue, `entry "${entry.id}" defaultValue should be defined`).toBeDefined();
      expect(entry.defaultValue, `entry "${entry.id}" defaultValue should not be null`).not.toBeNull();
    }
  });
});

describe('SettingRegistry — Property 2: Every id follows "tab.settingName" format and tab field matches prefix', () => {
  it('every id contains exactly one dot separator', () => {
    for (const entry of SETTING_REGISTRY) {
      const parts = entry.id.split('.');
      expect(parts.length, `entry "${entry.id}" id should have exactly one dot`).toBe(2);
      expect(parts[0].length, `entry "${entry.id}" id prefix should be non-empty`).toBeGreaterThan(0);
      expect(parts[1].length, `entry "${entry.id}" id settingName should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('every id prefix matches the tab field', () => {
    for (const entry of SETTING_REGISTRY) {
      const prefix = entry.id.split('.')[0];
      expect(prefix, `entry "${entry.id}" id prefix should match tab "${entry.tab}"`).toBe(entry.tab);
    }
  });

  it('every id is unique across the registry', () => {
    const ids = SETTING_REGISTRY.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

/**
 * Tests for new AuraBrain Persistence & Legacy Export SettingEntries
 * Validates: Requirements 10.6, 10.7, 10.8, 10.9, 10.10
 */

function searchSettings(query: string): typeof SETTING_REGISTRY {
  const q = query.toLowerCase();
  return SETTING_REGISTRY.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.keywords.some((kw) => kw.toLowerCase().includes(q))
  );
}

describe('SettingRegistry — new AuraBrain entries: QuickSearch integration', () => {
  it('searching "auto sync" returns at least 1 new entry (Requirements 10.8, 10.9, 10.10)', () => {
    const results = searchSettings('auto sync');
    const ids = results.map((e) => e.id);
    expect(ids.some((id) => id === 'general.autoSyncEnabled' || id === 'general.autoSyncInterval')).toBe(true);
  });

  it('searching "export" returns at least 1 new entry (Requirements 10.6, 10.7, 10.10)', () => {
    const results = searchSettings('export');
    const ids = results.map((e) => e.id);
    expect(
      ids.some(
        (id) => id === 'general.defaultExportPath' || id === 'general.defaultExportFormat'
      )
    ).toBe(true);
  });

  it('general.defaultExportPath entry has correct label and keywords', () => {
    const entry = SETTING_REGISTRY.find((e) => e.id === 'general.defaultExportPath');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('Default Export Path');
    expect(entry!.keywords).toContain('export path');
    expect(entry!.keywords).toContain('thư mục xuất');
  });

  it('general.defaultExportFormat entry has correct label and keywords', () => {
    const entry = SETTING_REGISTRY.find((e) => e.id === 'general.defaultExportFormat');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('Default Export Format');
    expect(entry!.keywords).toContain('markdown');
    expect(entry!.keywords).toContain('định dạng xuất');
  });

  it('general.autoSyncEnabled entry has correct label and keywords', () => {
    const entry = SETTING_REGISTRY.find((e) => e.id === 'general.autoSyncEnabled');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('Auto Sync');
    expect(entry!.keywords).toContain('autosync');
    expect(entry!.keywords).toContain('tự động đồng bộ');
  });

  it('general.autoSyncInterval entry has correct label and keywords', () => {
    const entry = SETTING_REGISTRY.find((e) => e.id === 'general.autoSyncInterval');
    expect(entry).toBeDefined();
    expect(entry!.label).toBe('Auto Sync Interval');
    expect(entry!.keywords).toContain('sync frequency');
    expect(entry!.keywords).toContain('khoảng thời gian đồng bộ');
  });
});
