/**
 * Unit tests for NotificationDispatcher
 *
 * Tests dispatch routing, silent policy filtering, template resolution,
 * priority ordering, log ring buffer, and channel subscriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationEvent, NotificationPolicy } from '../types/notification';
import { resolveTemplate } from './notificationDispatcher';

// Mock the notificationRegistry module
vi.mock('./notificationRegistry', () => ({
  notificationRegistry: {
    lookupPolicies: vi.fn(() => []),
  },
}));

import { notificationRegistry } from './notificationRegistry';

// We need to re-import the dispatcher fresh for each test to reset state
// Since it's a singleton, we'll use a factory approach
async function createFreshDispatcher() {
  // Reset modules to get a fresh singleton
  vi.resetModules();

  // Re-mock the registry
  vi.doMock('./notificationRegistry', () => ({
    notificationRegistry: {
      lookupPolicies: vi.fn(() => []),
    },
  }));

  const mod = await import('./notificationDispatcher');
  const regMod = await import('./notificationRegistry');
  return { dispatcher: mod.notificationDispatcher, registry: regMod.notificationRegistry };
}

function makePolicy(overrides: Partial<NotificationPolicy> = {}): NotificationPolicy {
  return {
    id: 'test-policy',
    sourceKey: 'sync.success',
    channel: 'statusBar',
    format: 'message',
    priority: 'medium',
    duration: null,
    silent: false,
    trigger: 'onEvent',
    template: 'Test message',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    sourceKey: 'sync.success',
    trigger: 'onEvent',
    data: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('resolveTemplate', () => {
  it('should replace variables with values from data', () => {
    const result = resolveTemplate('Hello {name}, you have {count} items', {
      name: 'World',
      count: 5,
    });
    expect(result).toBe('Hello World, you have 5 items');
  });

  it('should use [unknown] for missing variables', () => {
    const result = resolveTemplate('Hello {name}, status: {status}', {
      name: 'World',
    });
    expect(result).toBe('Hello World, status: [unknown]');
  });

  it('should use [unknown] for null values', () => {
    const result = resolveTemplate('Value: {val}', { val: null });
    expect(result).toBe('Value: [unknown]');
  });

  it('should use [unknown] for undefined values', () => {
    const result = resolveTemplate('Value: {val}', { val: undefined });
    expect(result).toBe('Value: [unknown]');
  });

  it('should return empty string for undefined template', () => {
    const result = resolveTemplate(undefined, { name: 'test' });
    expect(result).toBe('');
  });

  it('should return template as-is when no variables present', () => {
    const result = resolveTemplate('No variables here', {});
    expect(result).toBe('No variables here');
  });

  it('should handle numeric values', () => {
    const result = resolveTemplate('Synced · {seconds}s ago', { seconds: 15 });
    expect(result).toBe('Synced · 15s ago');
  });
});

describe('NotificationDispatcher', () => {
  describe('dispatch', () => {
    it('should create notifications for matching non-silent policies', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'p1', template: 'Synced' });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].policyId).toBe('p1');
      expect(notifications[0].resolvedContent).toBe('Synced');
      expect(notifications[0].state).toBe('active');
    });

    it('should filter out silent policies (Requirement 1.6)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const silentPolicy = makePolicy({ id: 'silent', silent: true });
      const activePolicy = makePolicy({ id: 'active', silent: false, template: 'Active' });

      vi.mocked(registry.lookupPolicies).mockReturnValue([silentPolicy, activePolicy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].policyId).toBe('active');
    });

    it('should dispatch all non-silent policies simultaneously (Requirement 4.8)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policies = [
        makePolicy({ id: 'p1', channel: 'statusBar', template: 'Status' }),
        makePolicy({ id: 'p2', channel: 'toast', template: 'Toast' }),
        makePolicy({ id: 'p3', channel: 'titleBar', template: 'Title' }),
      ];

      vi.mocked(registry.lookupPolicies).mockReturnValue(policies);

      dispatcher.dispatch(makeEvent());

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(1);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);
      expect(dispatcher.getChannelNotifications('titleBar')).toHaveLength(1);
    });

    it('should do nothing when no policies match (Requirement 4.6)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      vi.mocked(registry.lookupPolicies).mockReturnValue([]);

      dispatcher.dispatch(makeEvent());

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      expect(dispatcher.getLog()).toHaveLength(0);
    });

    it('should resolve template variables from event data', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ template: 'Sync failed: {error}' });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent({ data: { error: 'SQLITE_FULL' } }));

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications[0].resolvedContent).toBe('Sync failed: SQLITE_FULL');
    });

    it('should use [unknown] for missing template variables', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ template: 'Exported to {path}' });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent({ data: {} }));

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications[0].resolvedContent).toBe('Exported to [unknown]');
    });

    it('should set dismissAt based on policy duration', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: 5000 });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications[0].dismissAt).not.toBeNull();
      expect(notifications[0].dismissAt! - notifications[0].createdAt).toBe(5000);
    });

    it('should set dismissAt to null for persistent notifications', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: null });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications[0].dismissAt).toBeNull();
    });

    it('should notify channel subscribers when dispatching', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ channel: 'toast' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      const listener = vi.fn();
      dispatcher.subscribeChannel('toast', listener);

      dispatcher.dispatch(makeEvent());

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getChannelNotifications', () => {
    it('should return notifications sorted by priority (critical > high > medium > low)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policies = [
        makePolicy({ id: 'low', priority: 'low', template: 'Low' }),
        makePolicy({ id: 'critical', priority: 'critical', template: 'Critical' }),
        makePolicy({ id: 'high', priority: 'high', template: 'High' }),
        makePolicy({ id: 'medium', priority: 'medium', template: 'Medium' }),
      ];

      vi.mocked(registry.lookupPolicies).mockReturnValue(policies);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications.map((n) => n.priority)).toEqual([
        'critical',
        'high',
        'medium',
        'low',
      ]);
    });
  });

  describe('dismiss', () => {
    it('should remove notification from active map', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy();
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);

      dispatcher.dismiss(notifications[0].id);

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
    });

    it('should notify channel listeners on dismiss', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy();
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const listener = vi.fn();
      dispatcher.subscribeChannel('statusBar', listener);

      const notifications = dispatcher.getChannelNotifications('statusBar');
      dispatcher.dismiss(notifications[0].id);

      expect(listener).toHaveBeenCalled();
    });

    it('should do nothing for non-existent notification id', async () => {
      const { dispatcher } = await createFreshDispatcher();
      // Should not throw
      dispatcher.dismiss('non-existent-id');
    });
  });

  describe('dismissChannel', () => {
    it('should dismiss all notifications in a channel', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policies = [
        makePolicy({ id: 'p1', template: 'First' }),
        makePolicy({ id: 'p2', template: 'Second' }),
      ];
      vi.mocked(registry.lookupPolicies).mockReturnValue(policies);

      dispatcher.dispatch(makeEvent());

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(2);

      dispatcher.dismissChannel('statusBar');

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
    });

    it('should not affect other channels', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policies = [
        makePolicy({ id: 'p1', channel: 'statusBar', template: 'Status' }),
        makePolicy({ id: 'p2', channel: 'toast', template: 'Toast' }),
      ];
      vi.mocked(registry.lookupPolicies).mockReturnValue(policies);

      dispatcher.dispatch(makeEvent());

      dispatcher.dismissChannel('statusBar');

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);
    });
  });

  describe('subscribeChannel', () => {
    it('should return an unsubscribe function', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy();
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      const listener = vi.fn();
      const unsubscribe = dispatcher.subscribeChannel('statusBar', listener);

      dispatcher.dispatch(makeEvent());
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      dispatcher.dispatch(makeEvent());
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('log (ring buffer)', () => {
    it('should add dispatched notifications to the log', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy();
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const log = dispatcher.getLog();
      expect(log).toHaveLength(1);
      expect(log[0].policyId).toBe('test-policy');
    });

    it('should not exceed 200 entries (ring buffer)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy();
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      // Dispatch 210 events
      for (let i = 0; i < 210; i++) {
        dispatcher.dispatch(makeEvent());
      }

      const log = dispatcher.getLog();
      expect(log.length).toBeLessThanOrEqual(200);
    });

    it('should remove oldest entries when exceeding max size (FIFO)', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      vi.mocked(registry.lookupPolicies).mockImplementation(() => [
        makePolicy({ template: 'Event' }),
      ]);

      // Dispatch 201 events
      for (let i = 0; i < 201; i++) {
        dispatcher.dispatch(makeEvent({ data: { index: i } }));
      }

      const log = dispatcher.getLog();
      expect(log).toHaveLength(200);
      // First entry should be index 1 (index 0 was evicted)
      expect(log[0].data.index).toBe(1);
    });
  });

  describe('simulate', () => {
    it('should behave the same as dispatch', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ template: 'Simulated' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.simulate(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].resolvedContent).toBe('Simulated');
    });
  });
});
