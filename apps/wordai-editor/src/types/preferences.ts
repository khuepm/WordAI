export type Tab = 'general' | 'ai-engine' | 'typography' | 'privacy';

export interface SettingEntry {
  id: string;
  label: string;
  description: string;
  tab: Tab;
  keywords: string[];
  type: 'select' | 'toggle' | 'slider' | 'number' | 'radio';
  defaultValue: unknown;
}

export interface Preferences {
  general: {
    theme: string;
    autoSave: {
      enabled: boolean;
      intervalMinutes: number;
    };
    focusMode: boolean;
    language: string;
    defaultExportPath: string;
    defaultExportFormat: 'markdown' | 'docx';
    autoSyncEnabled: boolean;
    autoSyncInterval: number;
  };
  aiEngine: {
    agent: string;
    model: string;
    creativity: number;
    contextWindowTokens: number;
    responseLanguage: string;
    webAccess: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: string;
    lineSpacing: string;
    smartQuotes: boolean;
    autoCapitalize: boolean;
    ligatures: boolean;
  };
  privacy: {
    allowAITraining: boolean;
    analyticsEnabled: boolean;
    crashReports: boolean;
    localProcessingOnly: boolean;
  };
}

export const defaultPreferences: Preferences = {
  general: {
    theme: 'system',
    autoSave: {
      enabled: true,
      intervalMinutes: 5,
    },
    focusMode: false,
    language: 'en-US',
    defaultExportPath: '',
    defaultExportFormat: 'markdown',
    autoSyncEnabled: true,
    autoSyncInterval: 30,
  },
  aiEngine: {
    agent: 'claude',
    model: 'aura-turbo',
    creativity: 75,
    contextWindowTokens: 16000,
    responseLanguage: 'auto',
    webAccess: true,
  },
  typography: {
    fontFamily: 'inter',
    fontSize: 'medium',
    lineSpacing: '1.15',
    smartQuotes: true,
    autoCapitalize: false,
    ligatures: true,
  },
  privacy: {
    allowAITraining: false,
    analyticsEnabled: false,
    crashReports: true,
    localProcessingOnly: false,
  },
};
