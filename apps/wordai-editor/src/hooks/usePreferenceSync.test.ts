/**
 * Tests for usePreferenceSync — preference change → cloud sync wiring
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePreferenceSync, detectChangedSettings } from './usePreferenceSync';
import { defaultPreferences, type Preferences } from '../types/preferences';
import type { AccessContext } from '../types/auth';

// Mock cloudSettingsService
vi.mock('../services/cloudSettingsService', () => ({
  patchCloudSetting: vi.fn(),
}));

import { patchCloudSetting } from '../services/cloudSettingsService';

const mockPatchCloudSetting = vi.mocked(patchCloudSetting);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAccessContext(sessionId = 'session-1'): AccessContext {
  return {
    user: {
      id: 'user-1',
      firebase_uid: 'uid-1',
      email: 'test@example.com',
      display_name: 'Test',
      avatar_url: null,
      status: 'active',
      last_login_at: new Date().toISOString(),
    },
    roles: ['user'],
    permissions: ['ai.use'],
    entitlement: {
      ai_enabled: true,
      plan_code: 'free',
      monthly_quota: 100,
      used_quota: 0,
      quota_reset_at: new Date().toISOString(),
      allowed_models: ['gpt-3.5-turbo'],
      max_requests_per_minute: 10,
    },
    session: {
      id: sessionId,
      device_id: 'device-1',
      session_state: 'active',
      last_seen_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Unit tests for detectChangedSettings
// ---------------------------------------------------------------------------

describe('detectChangedSettings', () => {
  it('returns empty array when preferences are identical', () => {
    const changes = detectChangedSettings(defaultPreferences, defaultPreferences);
    expect(changes).toEqual([]);
  });

  it('detects a changed cloud setting (general.theme)', () => {
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark' },
    };
    const changes = detectChangedSettings(defaultPreferences, newPrefs);
    expect(changes).toContainEqual({ dotKey: 'general.theme', value: 'dark' });
  });

  it('detects a changed ai-engine setting with correct dot-key mapping', () => {
    const newPrefs: Preferences = {
      ...defaultPreferences,
      aiEngine: { ...defaultPreferences.aiEngine, model: 'gpt-4' },
    };
    const changes = detectChangedSettings(defaultPreferences, newPrefs);
    expect(changes).toContainEqual({ dotKey: 'ai-engine.model', value: 'gpt-4' });
  });

  it('detects a changed local setting (privacy.crashReports)', () => {
    const newPrefs: Preferences = {
      ...defaultPreferences,
      privacy: { ...defaultPreferences.privacy, crashReports: false },
    };
    const changes = detectChangedSettings(defaultPreferences, newPrefs);
    expect(changes).toContainEqual({ dotKey: 'privacy.crashReports', value: false });
  });

  it('detects multiple changes across sections', () => {
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark', focusMode: true },
      typography: { ...defaultPreferences.typography, fontSize: 'large' },
    };
    const changes = detectChangedSettings(defaultPreferences, newPrefs);
    expect(changes).toHaveLength(3);
    expect(changes).toContainEqual({ dotKey: 'general.theme', value: 'dark' });
    expect(changes).toContainEqual({ dotKey: 'general.focusMode', value: true });
    expect(changes).toContainEqual({ dotKey: 'typography.fontSize', value: 'large' });
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests
// ---------------------------------------------------------------------------

describe('usePreferenceSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call patchCloudSetting on initial mount (Req 19.1)', () => {
    renderHook(() =>
      usePreferenceSync({
        preferences: defaultPreferences,
        accessContext: buildAccessContext(),
      }),
    );

    expect(mockPatchCloudSetting).not.toHaveBeenCalled();
  });

  it('calls patchCloudSetting for cloud settings when authenticated (Req 19.2)', () => {
    const ctx = buildAccessContext('session-abc');
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: ctx,
        },
      },
    );

    // Change a cloud setting
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark' },
    };

    rerender({ preferences: newPrefs, accessContext: ctx });

    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-abc', 'general.theme', 'dark');
  });

  it('does not call patchCloudSetting for local settings when authenticated (Req 19.4)', () => {
    const ctx = buildAccessContext('session-abc');
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: ctx,
        },
      },
    );

    // Change a local-only setting
    const newPrefs: Preferences = {
      ...defaultPreferences,
      privacy: { ...defaultPreferences.privacy, crashReports: false },
    };

    rerender({ preferences: newPrefs, accessContext: ctx });

    expect(mockPatchCloudSetting).not.toHaveBeenCalled();
  });

  it('does not call patchCloudSetting when user is a guest (Req 19.4)', () => {
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: null as AccessContext | null,
        },
      },
    );

    // Change a cloud setting while guest
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark' },
    };

    rerender({ preferences: newPrefs, accessContext: null });

    expect(mockPatchCloudSetting).not.toHaveBeenCalled();
  });

  it('calls patchCloudSetting for ai-engine settings with correct dot-key (Req 19.2)', () => {
    const ctx = buildAccessContext('session-xyz');
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: ctx,
        },
      },
    );

    const newPrefs: Preferences = {
      ...defaultPreferences,
      aiEngine: { ...defaultPreferences.aiEngine, creativity: 90 },
    };

    rerender({ preferences: newPrefs, accessContext: ctx });

    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-xyz', 'ai-engine.creativity', 90);
  });

  it('batches multiple cloud setting changes in a single render (Req 19.2)', () => {
    const ctx = buildAccessContext('session-batch');
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: ctx,
        },
      },
    );

    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark', focusMode: true },
      typography: { ...defaultPreferences.typography, fontFamily: 'serif' },
    };

    rerender({ preferences: newPrefs, accessContext: ctx });

    expect(mockPatchCloudSetting).toHaveBeenCalledTimes(3);
    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-batch', 'general.theme', 'dark');
    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-batch', 'general.focusMode', true);
    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-batch', 'typography.fontFamily', 'serif');
  });

  it('only syncs cloud settings when both cloud and local settings change (Req 19.2, 19.4)', () => {
    const ctx = buildAccessContext('session-mixed');
    const { rerender } = renderHook(
      ({ preferences, accessContext }) =>
        usePreferenceSync({ preferences, accessContext }),
      {
        initialProps: {
          preferences: defaultPreferences,
          accessContext: ctx,
        },
      },
    );

    // Change both a cloud setting and a local setting
    const newPrefs: Preferences = {
      ...defaultPreferences,
      general: { ...defaultPreferences.general, theme: 'dark', defaultExportPath: '/new/path' },
    };

    rerender({ preferences: newPrefs, accessContext: ctx });

    // Only the cloud setting should be synced
    expect(mockPatchCloudSetting).toHaveBeenCalledTimes(1);
    expect(mockPatchCloudSetting).toHaveBeenCalledWith('session-mixed', 'general.theme', 'dark');
  });
});
