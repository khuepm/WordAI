import { describe, it, expect } from 'vitest';
import { SETTING_REGISTRY } from './settingRegistry';
import type { Tab } from '../types/preferences';

/**
 * Property tests for SettingRegistry completeness
 * Validates: Requirements 5.6
 */

const VALID_TABS: Tab[] = ['general', 'ai-engine', 'typography', 'privacy'];

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
