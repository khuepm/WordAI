import { describe, it, expect } from 'vitest';
import { CLOUD_SETTINGS, LOCAL_SETTINGS, isCloudSetting } from './settingClassification';
import { SETTING_REGISTRY } from './settingRegistry';

/**
 * Tests for settingClassification.ts
 * Validates: Requirements 14.1, 14.2
 */

describe('settingClassification — CLOUD_SETTINGS', () => {
  it('contains all expected cloud-synced setting keys', () => {
    const expected = [
      'general.theme',
      'general.language',
      'general.focusMode',
      'general.autoSave',
      'general.autoSyncEnabled',
      'general.autoSyncInterval',
      'general.defaultExportFormat',
      'ai-engine.agent',
      'ai-engine.model',
      'ai-engine.creativity',
      'ai-engine.contextWindowTokens',
      'ai-engine.responseLanguage',
      'ai-engine.webAccess',
      'typography.fontFamily',
      'typography.fontSize',
      'typography.lineSpacing',
      'typography.smartQuotes',
      'typography.autoCapitalize',
      'typography.ligatures',
      'privacy.allowAITraining',
      'privacy.localProcessingOnly',
    ];
    expect(CLOUD_SETTINGS).toEqual(expected);
  });

  it('has no duplicates', () => {
    const unique = new Set(CLOUD_SETTINGS);
    expect(unique.size).toBe(CLOUD_SETTINGS.length);
  });
});

describe('settingClassification — LOCAL_SETTINGS', () => {
  it('contains all expected local-only setting keys', () => {
    const expected = [
      'general.defaultExportPath',
      'about.auraBrainStoragePath',
      'privacy.crashReports',
      'privacy.analyticsEnabled',
    ];
    expect(LOCAL_SETTINGS).toEqual(expected);
  });

  it('has no duplicates', () => {
    const unique = new Set(LOCAL_SETTINGS);
    expect(unique.size).toBe(LOCAL_SETTINGS.length);
  });
});

describe('settingClassification — completeness', () => {
  it('every setting in SETTING_REGISTRY is classified as either cloud or local', () => {
    const allClassified = new Set([...CLOUD_SETTINGS, ...LOCAL_SETTINGS]);
    for (const entry of SETTING_REGISTRY) {
      expect(
        allClassified.has(entry.id),
        `Setting "${entry.id}" is not classified as cloud or local`
      ).toBe(true);
    }
  });

  it('no setting appears in both CLOUD_SETTINGS and LOCAL_SETTINGS', () => {
    const cloudSet = new Set(CLOUD_SETTINGS);
    for (const key of LOCAL_SETTINGS) {
      expect(
        cloudSet.has(key),
        `Setting "${key}" appears in both CLOUD_SETTINGS and LOCAL_SETTINGS`
      ).toBe(false);
    }
  });
});

describe('settingClassification — isCloudSetting helper', () => {
  it('returns true for cloud settings', () => {
    expect(isCloudSetting('general.theme')).toBe(true);
    expect(isCloudSetting('ai-engine.model')).toBe(true);
    expect(isCloudSetting('typography.fontFamily')).toBe(true);
    expect(isCloudSetting('privacy.allowAITraining')).toBe(true);
  });

  it('returns false for local settings', () => {
    expect(isCloudSetting('general.defaultExportPath')).toBe(false);
    expect(isCloudSetting('about.auraBrainStoragePath')).toBe(false);
    expect(isCloudSetting('privacy.crashReports')).toBe(false);
    expect(isCloudSetting('privacy.analyticsEnabled')).toBe(false);
  });

  it('returns false for unknown keys', () => {
    expect(isCloudSetting('unknown.setting')).toBe(false);
    expect(isCloudSetting('')).toBe(false);
  });
});
