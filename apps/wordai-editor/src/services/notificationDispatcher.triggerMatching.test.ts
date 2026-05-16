/**
 * Unit tests for trigger matching logic in NotificationDispatcher
 *
 * Tests:
 * - onChange trigger matching (Requirement 4.1)
 * - onThreshold trigger with threshold evaluation (Requirements 4.2, 4.7)
 * - onError trigger matching (Requirement 4.3)
 * - periodic trigger via internal timer (Requirement 4.4)
 * - onEvent trigger matching (Requirement 4.5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationEvent, NotificationPolicy } from '../types/notification';
import { evaluateThreshold } from './notificationDispatcher';

// Mock the notificationRegistry module
vi.mock('./notificationRegistry', () => ({
  notificationRegistry: {
    lookupPolicies: vi.fn(() => []),
    getAllPolicies: vi.fn(() => []),
  },
}));

// Factory to get fresh dispatcher instance for each test
async function createFreshDispatcher() {
  vi.resetModules();

  vi.doMock('./notificationRegistry', () => ({
    notificationRegistry: {
      lookupPolicies: vi.fn(() => []),
      getAllPolicies: vi.fn(() => []),
    },
  }));

  const mod = await import('./notificationDispatcher');
  const regMod = await import('./notificationRegistry');
  return { dispatcher: mod.notificationDispatcher, registry: regMod.notificationRegistry };
}

function makePolicy(overrides: Partial<NotificationPolicy> = {}): NotificationPolicy {
  return {
    id: 'test-policy',
    sourceKey: 'test.source',
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
    sourceKey: 'test.source',
    trigger: 'onEvent',
    data: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('evaluateThreshold', () => {
  it('should return false when policy has no threshold config', () => {
    const policy = makePolicy({ trigger: 'onThreshold' });
    const event = makeEvent({ trigger: 'onThreshold', data: { value: 10 } });
    expect(evaluateThreshold(policy, event)).toBe(false);
  });

  it('should return false when event data has no value field', () => {
    const policy = makePolicy({
      trigger: 'onThreshold',
      threshold: { operator: '>', value: 5 },
    });
    const event = makeEvent({ trigger: 'onThreshold', data: {} });
    expect(evaluateThreshold(policy, event)).toBe(false);
  });

  it('should return false when event data value is null', () => {
    const policy = makePolicy({
      trigger: 'onThreshold',
      threshold: { operator: '>', value: 5 },
    });
    const event = makeEvent({ trigger: 'onThreshold', data: { value: null } });
    expect(evaluateThreshold(policy, event)).toBe(false);
  });

  describe('operator >', () => {
    it('should return true when value > threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 5 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 10 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when value == threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 5 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 5 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });

    it('should return false when value < threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 5 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 3 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  describe('operator <', () => {
    it('should return true when value < threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '<', value: 10 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 5 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when value >= threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '<', value: 10 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 10 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  describe('operator >=', () => {
    it('should return true when value >= threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '>=', value: 5 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 5 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when value < threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '>=', value: 5 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 4 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  describe('operator <=', () => {
    it('should return true when value <= threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '<=', value: 10 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 10 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when value > threshold', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '<=', value: 10 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 11 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  describe('operator ==', () => {
    it('should return true when values are equal', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '==', value: 42 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 42 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when values are not equal', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '==', value: 42 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 43 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  describe('operator !=', () => {
    it('should return true when values are not equal', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '!=', value: 0 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 5 } });
      expect(evaluateThreshold(policy, event)).toBe(true);
    });

    it('should return false when values are equal', () => {
      const policy = makePolicy({
        trigger: 'onThreshold',
        threshold: { operator: '!=', value: 0 },
      });
      const event = makeEvent({ trigger: 'onThreshold', data: { value: 0 } });
      expect(evaluateThreshold(policy, event)).toBe(false);
    });
  });

  it('should return false for non-numeric values with relational operators', () => {
    const policy = makePolicy({
      trigger: 'onThreshold',
      threshold: { operator: '>', value: 5 },
    });
    const event = makeEvent({ trigger: 'onThreshold', data: { value: 'abc' } });
    expect(evaluateThreshold(policy, event)).toBe(false);
  });
});

describe('Trigger Matching in Dispatch', () => {
  describe('onChange trigger (Requirement 4.1)', () => {
    it('should dispatch when event.trigger === onChange', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'on-change-policy',
        trigger: 'onChange',
        template: 'Value changed',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(makeEvent({ trigger: 'onChange' }));

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].policyId).toBe('on-change-policy');
    });
  });

  describe('onThreshold trigger (Requirements 4.2, 4.7)', () => {
    it('should dispatch when threshold condition is met', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'threshold-policy',
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 100 },
        template: 'Value exceeded threshold',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(
        makeEvent({ trigger: 'onThreshold', data: { value: 150 } })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].resolvedContent).toBe('Value exceeded threshold');
    });

    it('should NOT dispatch when threshold condition is NOT met', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'threshold-policy',
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 100 },
        template: 'Value exceeded threshold',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(
        makeEvent({ trigger: 'onThreshold', data: { value: 50 } })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(0);
    });

    it('should NOT dispatch when threshold policy has no threshold config', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'threshold-no-config',
        trigger: 'onThreshold',
        // No threshold config
        template: 'Should not fire',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(
        makeEvent({ trigger: 'onThreshold', data: { value: 999 } })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(0);
    });

    it('should dispatch multiple threshold policies independently', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policyHigh = makePolicy({
        id: 'threshold-high',
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 50 },
        template: 'High threshold',
      });
      const policyLow = makePolicy({
        id: 'threshold-low',
        trigger: 'onThreshold',
        threshold: { operator: '>', value: 200 },
        template: 'Low threshold',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policyHigh, policyLow]);

      // Value 100 passes first threshold (>50) but not second (>200)
      dispatcher.dispatch(
        makeEvent({ trigger: 'onThreshold', data: { value: 100 } })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].policyId).toBe('threshold-high');
    });
  });

  describe('onError trigger (Requirement 4.3)', () => {
    it('should dispatch when event.trigger === onError', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'error-policy',
        trigger: 'onError',
        template: 'Error: {error}',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(
        makeEvent({ trigger: 'onError', data: { error: 'SQLITE_FULL' } })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].resolvedContent).toBe('Error: SQLITE_FULL');
    });
  });

  describe('onEvent trigger (Requirement 4.5)', () => {
    it('should dispatch when event.trigger === onEvent and sourceKey matches', async () => {
      const { dispatcher, registry } = await createFreshDispatcher();
      const policy = makePolicy({
        id: 'event-policy',
        trigger: 'onEvent',
        sourceKey: 'sync.success',
        template: 'Synced',
      });

      vi.mocked(registry.lookupPolicies).mockReturnValue([policy]);

      dispatcher.dispatch(
        makeEvent({ sourceKey: 'sync.success', trigger: 'onEvent' })
      );

      const notifications = dispatcher.getChannelNotifications('statusBar');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].resolvedContent).toBe('Synced');
    });
  });

  describe('periodic trigger (Requirement 4.4)', () => {
    it('should dispatch notifications at configured interval', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const periodicPolicy = makePolicy({
        id: 'periodic-countdown',
        trigger: 'periodic',
        sourceKey: 'general.autoSyncInterval',
        periodic: { intervalMs: 1000 },
        template: 'Tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([periodicPolicy]);
      vi.mocked(registry.lookupPolicies).mockReturnValue([periodicPolicy]);

      dispatcher.startPeriodicPolicies();

      // No notification yet (interval hasn't fired)
      expect(dispatcher.getLog()).toHaveLength(0);

      // Advance 1 second — first tick
      vi.advanceTimersByTime(1000);
      expect(dispatcher.getLog()).toHaveLength(1);

      // Advance another second — second tick
      vi.advanceTimersByTime(1000);
      expect(dispatcher.getLog()).toHaveLength(2);

      dispatcher.stopPeriodicPolicies();
      vi.useRealTimers();
    });

    it('should not start timers for silent periodic policies', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const silentPeriodicPolicy = makePolicy({
        id: 'silent-periodic',
        trigger: 'periodic',
        silent: true,
        periodic: { intervalMs: 500 },
        template: 'Silent tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([silentPeriodicPolicy]);

      dispatcher.startPeriodicPolicies();

      vi.advanceTimersByTime(2000);

      // No notifications dispatched because policy is silent
      expect(dispatcher.getLog()).toHaveLength(0);

      dispatcher.stopPeriodicPolicies();
      vi.useRealTimers();
    });

    it('should stop periodic timers on stopPeriodicPolicies()', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const periodicPolicy = makePolicy({
        id: 'periodic-stop-test',
        trigger: 'periodic',
        sourceKey: 'test.periodic',
        periodic: { intervalMs: 1000 },
        template: 'Tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([periodicPolicy]);
      vi.mocked(registry.lookupPolicies).mockReturnValue([periodicPolicy]);

      dispatcher.startPeriodicPolicies();

      vi.advanceTimersByTime(1000);
      expect(dispatcher.getLog()).toHaveLength(1);

      dispatcher.stopPeriodicPolicies();

      // No more ticks after stopping
      vi.advanceTimersByTime(5000);
      expect(dispatcher.getLog()).toHaveLength(1);

      vi.useRealTimers();
    });

    it('should stop periodic timers on cleanup()', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const periodicPolicy = makePolicy({
        id: 'periodic-cleanup-test',
        trigger: 'periodic',
        sourceKey: 'test.periodic',
        periodic: { intervalMs: 1000 },
        template: 'Tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([periodicPolicy]);
      vi.mocked(registry.lookupPolicies).mockReturnValue([periodicPolicy]);

      dispatcher.startPeriodicPolicies();

      vi.advanceTimersByTime(1000);

      dispatcher.cleanup();

      // No more ticks after cleanup
      vi.advanceTimersByTime(5000);
      // Log should still have 1 entry from before cleanup
      expect(dispatcher.getLog()).toHaveLength(1);

      vi.useRealTimers();
    });

    it('should not start duplicate timers for same policy', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const periodicPolicy = makePolicy({
        id: 'periodic-no-dup',
        trigger: 'periodic',
        sourceKey: 'test.periodic',
        periodic: { intervalMs: 1000 },
        template: 'Tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([periodicPolicy]);
      vi.mocked(registry.lookupPolicies).mockReturnValue([periodicPolicy]);

      // Start twice
      dispatcher.startPeriodicPolicies();
      dispatcher.startPeriodicPolicies();

      vi.advanceTimersByTime(1000);

      // Should only have 1 notification (not 2 from duplicate timers)
      expect(dispatcher.getLog()).toHaveLength(1);

      dispatcher.stopPeriodicPolicies();
      vi.useRealTimers();
    });

    it('should not start timer for periodic policy with intervalMs <= 0', async () => {
      vi.useFakeTimers();
      const { dispatcher, registry } = await createFreshDispatcher();

      const invalidPolicy = makePolicy({
        id: 'periodic-invalid',
        trigger: 'periodic',
        sourceKey: 'test.periodic',
        periodic: { intervalMs: 0 },
        template: 'Should not tick',
      });

      vi.mocked(registry.getAllPolicies).mockReturnValue([invalidPolicy]);

      dispatcher.startPeriodicPolicies();

      vi.advanceTimersByTime(5000);
      expect(dispatcher.getLog()).toHaveLength(0);

      dispatcher.stopPeriodicPolicies();
      vi.useRealTimers();
    });
  });
});
