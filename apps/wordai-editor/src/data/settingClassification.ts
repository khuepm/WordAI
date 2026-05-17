/**
 * Setting Classification — Cloud vs Local
 *
 * Classifies settings into cloud-synced (synced to user account via Bridge API)
 * and local-only (device-specific, never synced).
 *
 * Requirements: 14.1, 14.2
 */

export const CLOUD_SETTINGS: string[] = [
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

export const LOCAL_SETTINGS: string[] = [
  'general.defaultExportPath',
  'about.auraBrainStoragePath',
  'privacy.crashReports',
  'privacy.analyticsEnabled',
];

export function isCloudSetting(key: string): boolean {
  return CLOUD_SETTINGS.includes(key);
}
