/**
 * NotificationRegistry unit tests
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchesSourceKey, mergePolicies } from './notificationRegistry';
import type { NotificationPolicy, PolicyConfigFile } from '../types/notification';

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Helper to create a valid policy
function createPolicy(overrides: Partial<NotificationPolicy> = {}): NotificationPolicy {
  return {
    id: 'test-policy',
    sourceKey: 'test.key',
    channel: 'toast',
    format: 'message',
    priority: 'medium',
    duration: 3000,
    silent: false,
    trigger: 'onEvent',
    template: 'Test: {value}',
    ...overrides,
  };
}

describe('matchesSourceKey', () => {
  it('matches exact sourceKey', () => {
    expect(matchesSourceKey('sync.error', 'sync.error')).toBe(true);
  });

  it('does not match different exact sourceKey', () => {
    expect(matchesSourceKey('sync.error', 'sync.success')).toBe(false);
  });

  it('matches wildcard pattern "preference.*" against nested key', () => {
    expect(
      matchesSourceKey('preference.*', 'preference.changed.general.autoSyncInterval')
    ).toBe(true);
  });

  it('matches wildcard pattern "preference.*" against direct child', () => {
    expect(matchesSourceKey('preference.*', 'preference.changed')).toBe(true);
  });

  it('does not match wildcard pattern against unrelated key', () => {
    expect(matchesSourceKey('preference.*', 'sync.error')).toBe(false);
  });

  it('matches wildcard pattern "sync.*" against sync events', () => {
    expect(matchesSourceKey('sync.*', 'sync.error')).toBe(true);
    expect(matchesSourceKey('sync.*', 'sync.success')).toBe(true);
    expect(matchesSourceKey('sync.*', 'sync.start')).toBe(true);
  });

  it('does not match wildcard when prefix does not match', () => {
    expect(matchesSourceKey('export.*', 'sync.error')).toBe(false);
  });
});

describe('mergePolicies', () => {
  it('returns defaults when user policies is empty', () => {
    const defaults = [createPolicy({ id: 'a' }), createPolicy({ id: 'b' })];
    const result = mergePolicies(defaults, []);
    expect(result).toEqual(defaults);
  });

  it('user policy overrides default policy with same id', () => {
    const defaults = [createPolicy({ id: 'a', channel: 'toast' })];
    const userPolicies = [createPolicy({ id: 'a', channel: 'statusBar' })];

    const result = mergePolicies(defaults, userPolicies);

    expect(result).toHaveLength(1);
    expect(result[0].channel).toBe('statusBar');
  });

  it('keeps user policies not in defaults', () => {
    const defaults = [createPolicy({ id: 'a' })];
    const userPolicies = [createPolicy({ id: 'b', sourceKey: 'custom.key' })];

    const result = mergePolicies(defaults, userPolicies);

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === 'b')).toBeDefined();
  });

  it('keeps default policies not in user config', () => {
    const defaults = [createPolicy({ id: 'a' }), createPolicy({ id: 'b' })];
    const userPolicies = [createPolicy({ id: 'a', channel: 'statusBar' })];

    const result = mergePolicies(defaults, userPolicies);

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === 'b')).toBeDefined();
  });

  it('merge is deterministic regardless of input order', () => {
    const defaults = [createPolicy({ id: 'a' }), createPolicy({ id: 'b' })];
    const userPolicies = [
      createPolicy({ id: 'b', channel: 'statusBar' }),
      createPolicy({ id: 'c', sourceKey: 'new.key' }),
    ];

    const result = mergePolicies(defaults, userPolicies);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    expect(result[1].channel).toBe('statusBar');
    expect(result[2].id).toBe('c');
  });
});

describe('NotificationRegistry', () => {
  // We need to re-import the registry for each test to get a fresh instance
  let registryModule: typeof import('./notificationRegistry');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to get fresh singleton
    vi.resetModules();
    // Re-mock after reset
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: mockInvoke,
    }));
    registryModule = await import('./notificationRegistry');
  });

  describe('initialize', () => {
    it('loads default config when IPC returns null (file not found)', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const policies = notificationRegistry.getAllPolicies();
      expect(policies.length).toBeGreaterThan(0);
      expect(notificationRegistry.isInitialized()).toBe(true);
    });

    it('merges user config with defaults when IPC returns valid JSON', async () => {
      const userConfig: PolicyConfigFile = {
        schemaVersion: 1,
        policies: [
          createPolicy({
            id: 'sync-error-toast',
            sourceKey: 'sync.error',
            channel: 'toast',
            format: 'message',
            priority: 'critical', // Override priority
            duration: 10000,
            silent: false,
            trigger: 'onEvent',
          }),
        ],
      };
      mockInvoke.mockResolvedValueOnce(JSON.stringify(userConfig));

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const policies = notificationRegistry.getAllPolicies();
      const overriddenPolicy = policies.find((p) => p.id === 'sync-error-toast');
      expect(overriddenPolicy?.priority).toBe('critical');
      expect(overriddenPolicy?.duration).toBe(10000);
    });

    it('falls back to defaults when IPC returns invalid JSON', async () => {
      mockInvoke.mockResolvedValueOnce('not valid json {{{');

      const { notificationRegistry } = registryModule;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await notificationRegistry.initialize();

      expect(notificationRegistry.getAllPolicies().length).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('falls back to defaults when config has invalid schema', async () => {
      const invalidConfig = JSON.stringify({
        schemaVersion: 1,
        policies: [{ id: 'bad', sourceKey: 'x' }], // Missing required fields
      });
      mockInvoke.mockResolvedValueOnce(invalidConfig);

      const { notificationRegistry } = registryModule;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await notificationRegistry.initialize();

      expect(notificationRegistry.getAllPolicies().length).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('falls back to defaults when IPC invoke rejects', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC unavailable'));

      const { notificationRegistry } = registryModule;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await notificationRegistry.initialize();

      expect(notificationRegistry.getAllPolicies().length).toBeGreaterThan(0);
      expect(notificationRegistry.isInitialized()).toBe(true);
      warnSpy.mockRestore();
    });
  });

  describe('getAllPolicies', () => {
    it('returns policies with overrides applied', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });

      const policies = notificationRegistry.getAllPolicies();
      const overridden = policies.find((p) => p.id === 'sync-error-toast');
      expect(overridden?.silent).toBe(true);
    });

    it('override does not change the policy id', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', {
        id: 'hacked-id',
        channel: 'none',
      } as Partial<NotificationPolicy>);

      const policies = notificationRegistry.getAllPolicies();
      const overridden = policies.find((p) => p.id === 'sync-error-toast');
      expect(overridden?.id).toBe('sync-error-toast');
      expect(overridden?.channel).toBe('none');
    });
  });

  describe('lookupPolicies', () => {
    it('finds policies matching exact sourceKey and trigger', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const results = notificationRegistry.lookupPolicies('sync.error', 'onEvent');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((p) => p.sourceKey === 'sync.error')).toBe(true);
      expect(results.every((p) => p.trigger === 'onEvent')).toBe(true);
    });

    it('finds policies matching wildcard sourceKey', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // "preference.*" policy should match "preference.changed.general.autoSyncInterval"
      const results = notificationRegistry.lookupPolicies(
        'preference.changed.general.autoSyncInterval',
        'onChange'
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((p) => p.id === 'preference-change-toast')).toBe(true);
    });

    it('returns empty array when no policies match', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const results = notificationRegistry.lookupPolicies('nonexistent.key', 'onEvent');
      expect(results).toEqual([]);
    });

    it('returns empty when trigger does not match', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const results = notificationRegistry.lookupPolicies('sync.error', 'onChange');
      expect(results).toEqual([]);
    });

    it('returns multiple policies for same sourceKey (1:N relationship)', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // sync.error has both toast and statusBar policies
      const results = notificationRegistry.lookupPolicies('sync.error', 'onEvent');
      expect(results.length).toBe(2);
      const channels = results.map((p) => p.channel);
      expect(channels).toContain('toast');
      expect(channels).toContain('statusBar');
    });
  });

  describe('subscribe', () => {
    it('notifies listeners when policies change via override', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const listener = vi.fn();
      notificationRegistry.subscribe(listener);

      // Clear the call from initialize
      listener.mockClear();

      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function that stops notifications', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const listener = vi.fn();
      const unsubscribe = notificationRegistry.subscribe(listener);
      listener.mockClear();

      unsubscribe();
      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies listeners on initialize', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;

      const listener = vi.fn();
      notificationRegistry.subscribe(listener);

      await notificationRegistry.initialize();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on resetToDefaults', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const listener = vi.fn();
      notificationRegistry.subscribe(listener);
      listener.mockClear();

      await notificationRegistry.resetToDefaults();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSnapshot (useSyncExternalStore compatibility)', () => {
    it('returns stable reference when policies have not changed', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const snapshot1 = notificationRegistry.getSnapshot();
      const snapshot2 = notificationRegistry.getSnapshot();

      // Must be the exact same reference (referential equality)
      expect(snapshot1).toBe(snapshot2);
    });

    it('returns new reference after overridePolicy', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const snapshotBefore = notificationRegistry.getSnapshot();
      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      const snapshotAfter = notificationRegistry.getSnapshot();

      // Must be a different reference after change
      expect(snapshotBefore).not.toBe(snapshotAfter);
    });

    it('returns new reference after resetToDefaults', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      const snapshotBefore = notificationRegistry.getSnapshot();

      await notificationRegistry.resetToDefaults();
      const snapshotAfter = notificationRegistry.getSnapshot();

      expect(snapshotBefore).not.toBe(snapshotAfter);
    });

    it('snapshot reflects current policies with overrides applied', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', { priority: 'critical' });
      const snapshot = notificationRegistry.getSnapshot();

      const policy = snapshot.find((p) => p.id === 'sync-error-toast');
      expect(policy?.priority).toBe('critical');
    });

    it('is compatible with useSyncExternalStore pattern (subscribe + getSnapshot)', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // Simulate useSyncExternalStore behavior:
      // 1. Subscribe to changes
      // 2. getSnapshot returns stable ref between changes
      // 3. After change, getSnapshot returns new ref
      const snapshots: Readonly<NotificationPolicy[]>[] = [];

      const unsubscribe = notificationRegistry.subscribe(() => {
        snapshots.push(notificationRegistry.getSnapshot());
      });

      const initialSnapshot = notificationRegistry.getSnapshot();

      // No change — same reference
      expect(notificationRegistry.getSnapshot()).toBe(initialSnapshot);

      // Trigger change
      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });

      // Listener received new snapshot
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).not.toBe(initialSnapshot);

      // getSnapshot now returns the new reference
      expect(notificationRegistry.getSnapshot()).toBe(snapshots[0]);

      unsubscribe();
    });
  });

  describe('overridePolicy', () => {
    it('does not persist to config file (in-memory only)', async () => {
      mockInvoke.mockResolvedValueOnce(null); // initialize

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // Clear mock calls from initialize
      mockInvoke.mockClear();

      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });

      // No IPC call should have been made
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('applies override immediately to getAllPolicies', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', {
        priority: 'critical',
        channel: 'none',
      });

      const policies = notificationRegistry.getAllPolicies();
      const policy = policies.find((p) => p.id === 'sync-error-toast');
      expect(policy?.priority).toBe('critical');
      expect(policy?.channel).toBe('none');
    });
  });

  describe('resetToDefaults', () => {
    it('clears overrides and restores default policies', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      await notificationRegistry.resetToDefaults();

      const policies = notificationRegistry.getAllPolicies();
      const policy = policies.find((p) => p.id === 'sync-error-toast');
      expect(policy?.silent).toBe(false);
    });

    it('notifies subscribers when resetting', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      const listener = vi.fn();
      notificationRegistry.subscribe(listener);
      listener.mockClear();

      await notificationRegistry.resetToDefaults();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reloads from bundled defaults (not from config file)', async () => {
      // Initialize with user config that overrides a policy
      const userConfig: PolicyConfigFile = {
        schemaVersion: 1,
        policies: [
          createPolicy({
            id: 'sync-error-toast',
            sourceKey: 'sync.error',
            channel: 'toast',
            format: 'message',
            priority: 'critical',
            duration: 99999,
            silent: false,
            trigger: 'onEvent',
          }),
        ],
      };
      mockInvoke.mockResolvedValueOnce(JSON.stringify(userConfig));

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // Verify user config was loaded
      let policy = notificationRegistry
        .getAllPolicies()
        .find((p) => p.id === 'sync-error-toast');
      expect(policy?.priority).toBe('critical');

      // Reset to defaults should restore bundled defaults
      await notificationRegistry.resetToDefaults();

      policy = notificationRegistry
        .getAllPolicies()
        .find((p) => p.id === 'sync-error-toast');
      expect(policy?.priority).toBe('high'); // bundled default
    });
  });

  describe('saveToConfig', () => {
    it('invokes IPC with serialized config including overrides', async () => {
      mockInvoke.mockResolvedValueOnce(null); // initialize
      mockInvoke.mockResolvedValueOnce(undefined); // save

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      notificationRegistry.overridePolicy('sync-error-toast', { priority: 'critical' });
      await notificationRegistry.saveToConfig();

      expect(mockInvoke).toHaveBeenCalledWith('save_notification_policies', {
        config: expect.stringContaining('"schemaVersion": 1'),
      });

      // Verify the saved config contains the override
      const savedArg = mockInvoke.mock.calls[1][1] as { config: string };
      const savedConfig = JSON.parse(savedArg.config) as PolicyConfigFile;
      const savedPolicy = savedConfig.policies.find((p) => p.id === 'sync-error-toast');
      expect(savedPolicy?.priority).toBe('critical');
    });

    it('persists ALL policies (defaults + user + overrides), not just overridden ones', async () => {
      mockInvoke.mockResolvedValueOnce(null); // initialize
      mockInvoke.mockResolvedValueOnce(undefined); // save

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      // Only override one policy
      notificationRegistry.overridePolicy('sync-error-toast', { silent: true });
      await notificationRegistry.saveToConfig();

      const savedArg = mockInvoke.mock.calls[1][1] as { config: string };
      const savedConfig = JSON.parse(savedArg.config) as PolicyConfigFile;

      // Should contain ALL policies, not just the overridden one
      const allPolicies = notificationRegistry.getAllPolicies();
      expect(savedConfig.policies.length).toBe(allPolicies.length);
      expect(savedConfig.policies.length).toBeGreaterThan(1);
    });

    it('uses save_notification_policies IPC command', async () => {
      mockInvoke.mockResolvedValueOnce(null); // initialize
      mockInvoke.mockResolvedValueOnce(undefined); // save

      const { notificationRegistry } = registryModule;
      await notificationRegistry.initialize();

      await notificationRegistry.saveToConfig();

      expect(mockInvoke).toHaveBeenCalledWith(
        'save_notification_policies',
        expect.objectContaining({ config: expect.any(String) })
      );
    });
  });
});
