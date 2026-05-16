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

  describe('auto-dismiss timer (Requirement 8.5)', () => {
    it('should auto-dismiss notification after duration ms', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: 3000, template: 'Auto dismiss me' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      // Notification should be active initially
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(1);

      // Advance time by 3000ms
      vi.advanceTimersByTime(3000);

      // Notification should be dismissed
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      vi.useRealTimers();
    });

    it('should not auto-dismiss when duration is null (persistent)', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: null, template: 'Persistent' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      // Advance time significantly
      vi.advanceTimersByTime(60000);

      // Notification should still be active
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(1);
      vi.useRealTimers();
    });

    it('should notify channel listeners when auto-dismiss fires', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: 2000, channel: 'toast' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const listener = vi.fn();
      dispatcher.subscribeChannel('toast', listener);

      vi.advanceTimersByTime(2000);

      expect(listener).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should clear timer when notification is manually dismissed', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: 5000 });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const notifications = dispatcher.getChannelNotifications('statusBar');
      const notifId = notifications[0].id;

      // Manually dismiss before timer fires
      dispatcher.dismiss(notifId);

      // Advance past the original duration — should not throw or cause issues
      vi.advanceTimersByTime(5000);

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe('policy replacement (Requirement 8.5)', () => {
    it('should dismiss old notification when new one with same policyId is dispatched', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'sync-status', template: 'Synced · {seconds}s ago' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      // First dispatch
      dispatcher.dispatch(makeEvent({ data: { seconds: 5 } }));
      const firstNotifications = dispatcher.getChannelNotifications('statusBar');
      expect(firstNotifications).toHaveLength(1);
      expect(firstNotifications[0].resolvedContent).toBe('Synced · 5s ago');

      // Second dispatch with same policyId
      dispatcher.dispatch(makeEvent({ data: { seconds: 10 } }));
      const secondNotifications = dispatcher.getChannelNotifications('statusBar');
      expect(secondNotifications).toHaveLength(1);
      expect(secondNotifications[0].resolvedContent).toBe('Synced · 10s ago');
    });

    it('should not affect notifications from different policies', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy1 = makePolicy({ id: 'policy-a', template: 'A' });
      const policy2 = makePolicy({ id: 'policy-b', template: 'B' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy1, policy2]);

      dispatcher.dispatch(makeEvent());

      // Both should be active
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(2);

      // Dispatch again — each policy replaces its own old notification
      dispatcher.dispatch(makeEvent());

      // Still only 2 active (old ones replaced, new ones created)
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(2);
    });

    it('should clear auto-dismiss timer of replaced notification', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'timed-policy', duration: 5000, template: 'Timed' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      // First dispatch starts a 5s timer
      dispatcher.dispatch(makeEvent());

      // Second dispatch replaces the first (clears old timer, starts new one)
      vi.advanceTimersByTime(3000);
      dispatcher.dispatch(makeEvent());

      // After 3 more seconds (6s total from first dispatch), old timer would have fired
      // but it was cleared, so notification should still be active
      vi.advanceTimersByTime(3000);
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(1);

      // After 5s from second dispatch, new timer fires
      vi.advanceTimersByTime(2000);
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe('cleanup (Requirement 8.8)', () => {
    it('should dismiss all active notifications', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policies = [
        makePolicy({ id: 'p1', channel: 'statusBar', template: 'Status' }),
        makePolicy({ id: 'p2', channel: 'toast', template: 'Toast' }),
      ];
      vi.mocked(registry.lookupPolicies).mockReturnValue(policies);

      dispatcher.dispatch(makeEvent());

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(1);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      dispatcher.cleanup();

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0);
    });

    it('should clear all auto-dismiss timers', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ duration: 5000 });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      dispatcher.cleanup();

      // Advancing time should not cause any issues (timers cleared)
      vi.advanceTimersByTime(10000);

      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);
      vi.useRealTimers();
    });

    it('should notify channel listeners on cleanup', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ channel: 'toast' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent());

      const listener = vi.fn();
      dispatcher.subscribeChannel('toast', listener);

      dispatcher.cleanup();

      expect(listener).toHaveBeenCalled();
    });

    it('should remove window event listeners', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      dispatcher.initWindowListeners();
      dispatcher.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should clear paused timers on cleanup', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'toast-p', channel: 'toast', duration: 5000 });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Blur to pause the timer
      window.dispatchEvent(new Event('blur'));

      // Cleanup should clear paused timers
      dispatcher.cleanup();

      // Focus should not restart any timers
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(10000);

      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0);
      vi.useRealTimers();
    });
  });

  describe('pause/resume on window blur/focus (Requirement 8.7)', () => {
    it('should pause toast auto-dismiss timer on window blur', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'toast-1', channel: 'toast', duration: 5000, template: 'Toast msg' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Advance 2s, then blur
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('blur'));

      // Advance well past the original duration — toast should NOT be dismissed
      vi.advanceTimersByTime(10000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      vi.useRealTimers();
    });

    it('should resume toast auto-dismiss timer on window focus', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'toast-1', channel: 'toast', duration: 5000, template: 'Toast msg' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Advance 2s (3s remaining), then blur
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('blur'));

      // Advance 10s while blurred — should not dismiss
      vi.advanceTimersByTime(10000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      // Focus — timer resumes with ~3s remaining
      window.dispatchEvent(new Event('focus'));

      // Advance 2s — still active (3s remaining)
      vi.advanceTimersByTime(2000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      // Advance 1 more second — should now be dismissed
      vi.advanceTimersByTime(1000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should NOT pause statusBar auto-dismiss timer on window blur', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'sb-1', channel: 'statusBar', duration: 3000, template: 'Status' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Blur window
      window.dispatchEvent(new Event('blur'));

      // Advance past duration — statusBar should still auto-dismiss
      vi.advanceTimersByTime(3000);
      expect(dispatcher.getChannelNotifications('statusBar')).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should dismiss immediately on focus if remaining time was 0', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'toast-1', channel: 'toast', duration: 2000, template: 'Toast' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Advance almost to the end, then blur
      vi.advanceTimersByTime(1999);
      window.dispatchEvent(new Event('blur'));

      // The remaining time is 1ms, which gets clamped
      // Focus — should dismiss very quickly
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(1);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should store toast as paused immediately if dispatched while blurred', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({ id: 'toast-1', channel: 'toast', duration: 3000, template: 'Toast' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.initWindowListeners();

      // Blur first
      window.dispatchEvent(new Event('blur'));

      // Dispatch while blurred
      dispatcher.dispatch(makeEvent());

      // Advance well past duration — should NOT dismiss
      vi.advanceTimersByTime(10000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      // Focus — timer starts with full 3s
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(2999);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should handle multiple toast notifications pausing/resuming independently', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy1 = makePolicy({ id: 'toast-a', channel: 'toast', duration: 3000, template: 'A' });
      const policy2 = makePolicy({ id: 'toast-b', channel: 'toast', duration: 6000, template: 'B' });
      vi.mocked(registry.lookupPolicies).mockReturnValue([policy1, policy2]);

      dispatcher.initWindowListeners();
      dispatcher.dispatch(makeEvent());

      // Advance 2s (A has 1s left, B has 4s left), then blur
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new Event('blur'));

      // Advance while blurred — neither should dismiss
      vi.advanceTimersByTime(10000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(2);

      // Focus — A resumes with 1s, B resumes with 4s
      window.dispatchEvent(new Event('focus'));

      vi.advanceTimersByTime(1000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(1); // A dismissed

      vi.advanceTimersByTime(3000);
      expect(dispatcher.getChannelNotifications('toast')).toHaveLength(0); // B dismissed

      vi.useRealTimers();
    });
  });
});
