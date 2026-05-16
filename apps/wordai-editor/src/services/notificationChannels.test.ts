/**
 * Unit tests for NotificationChannels
 *
 * Tests channel-specific behavior:
 * - StatusBar: shows top-priority notification only
 * - Toast: limits visible to maxVisible, supports auto-dismiss
 * - TitleBar: shows only indicator format, single notification
 * - Badge: count-based, overflow detection
 * - None: no-op, returns empty
 * - Registry: handler lookup, fallback to None
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { describe, it, expect } from 'vitest';
import type { ActiveNotification } from '../types/notification';
import {
  StatusBarChannelHandler,
  ToastChannelHandler,
  TitleBarChannelHandler,
  BadgeChannelHandler,
  NoneChannelHandler,
  notificationChannelRegistry,
} from './notificationChannels';

// ─── Test Helpers ───────────────────────────────────────────────────────────────

function createNotification(overrides: Partial<ActiveNotification> = {}): ActiveNotification {
  return {
    id: `notif-${Math.random().toString(36).slice(2)}`,
    policyId: 'test-policy',
    channel: 'statusBar',
    format: 'message',
    priority: 'medium',
    duration: null,
    resolvedContent: 'Test notification',
    data: {},
    state: 'active',
    createdAt: Date.now(),
    dismissAt: null,
    ...overrides,
  };
}

function createNotifications(count: number, overrides: Partial<ActiveNotification> = {}): ActiveNotification[] {
  return Array.from({ length: count }, (_, i) =>
    createNotification({ id: `notif-${i}`, ...overrides })
  );
}

// ─── StatusBar Channel Tests ────────────────────────────────────────────────────

describe('StatusBarChannelHandler', () => {
  it('should return empty array when no notifications', () => {
    const handler = new StatusBarChannelHandler();
    expect(handler.getVisibleNotifications([])).toEqual([]);
  });

  it('should show only the top-priority notification by default', () => {
    const handler = new StatusBarChannelHandler();
    const notifications = [
      createNotification({ id: '1', priority: 'high' }),
      createNotification({ id: '2', priority: 'medium' }),
      createNotification({ id: '3', priority: 'low' }),
    ];

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('1');
  });

  it('should show all notifications when showOnlyTop is false', () => {
    const handler = new StatusBarChannelHandler({ showOnlyTop: false });
    const notifications = createNotifications(3);

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(3);
  });

  it('should have correct channel properties', () => {
    const handler = new StatusBarChannelHandler();
    expect(handler.channel).toBe('statusBar');
    expect(handler.supportsAutoDismiss).toBe(true);
    expect(handler.pauseOnBlur).toBe(false);
    expect(handler.rendersUI).toBe(true);
  });
});

// ─── Toast Channel Tests ────────────────────────────────────────────────────────

describe('ToastChannelHandler', () => {
  it('should return empty array when no notifications', () => {
    const handler = new ToastChannelHandler();
    expect(handler.getVisibleNotifications([])).toEqual([]);
  });

  it('should limit visible notifications to maxVisible (default 3)', () => {
    const handler = new ToastChannelHandler();
    const notifications = createNotifications(5);

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(3);
  });

  it('should respect custom maxVisible config', () => {
    const handler = new ToastChannelHandler({ maxVisible: 5, position: 'top-right' });
    const notifications = createNotifications(7);

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(5);
  });

  it('should return all notifications when count is below maxVisible', () => {
    const handler = new ToastChannelHandler();
    const notifications = createNotifications(2);

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(2);
  });

  it('should have correct channel properties', () => {
    const handler = new ToastChannelHandler();
    expect(handler.channel).toBe('toast');
    expect(handler.supportsAutoDismiss).toBe(true);
    expect(handler.pauseOnBlur).toBe(true);
    expect(handler.rendersUI).toBe(true);
  });

  it('should expose config with position', () => {
    const handler = new ToastChannelHandler({ maxVisible: 4, position: 'bottom-center' });
    const config = handler.getConfig();
    expect(config.position).toBe('bottom-center');
    expect(config.maxVisible).toBe(4);
  });
});

// ─── TitleBar Channel Tests ─────────────────────────────────────────────────────

describe('TitleBarChannelHandler', () => {
  it('should return empty array when no notifications', () => {
    const handler = new TitleBarChannelHandler();
    expect(handler.getVisibleNotifications([])).toEqual([]);
  });

  it('should show only one notification (highest priority)', () => {
    const handler = new TitleBarChannelHandler();
    const notifications = [
      createNotification({ id: '1', format: 'indicator', priority: 'high' }),
      createNotification({ id: '2', format: 'indicator', priority: 'low' }),
    ];

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('1');
  });

  it('should filter to indicator format only by default', () => {
    const handler = new TitleBarChannelHandler();
    const notifications = [
      createNotification({ id: '1', format: 'message', priority: 'high' }),
      createNotification({ id: '2', format: 'indicator', priority: 'medium' }),
    ];

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('2');
  });

  it('should return empty when no indicator notifications exist', () => {
    const handler = new TitleBarChannelHandler();
    const notifications = [
      createNotification({ id: '1', format: 'message' }),
      createNotification({ id: '2', format: 'countdown' }),
    ];

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(0);
  });

  it('should show non-indicator formats when indicatorOnly is false', () => {
    const handler = new TitleBarChannelHandler({ indicatorOnly: false });
    const notifications = [
      createNotification({ id: '1', format: 'message', priority: 'high' }),
    ];

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('1');
  });

  it('should have correct channel properties', () => {
    const handler = new TitleBarChannelHandler();
    expect(handler.channel).toBe('titleBar');
    expect(handler.supportsAutoDismiss).toBe(true);
    expect(handler.pauseOnBlur).toBe(false);
    expect(handler.rendersUI).toBe(true);
  });
});

// ─── Badge Channel Tests ────────────────────────────────────────────────────────

describe('BadgeChannelHandler', () => {
  it('should return empty array when no notifications', () => {
    const handler = new BadgeChannelHandler();
    expect(handler.getVisibleNotifications([])).toEqual([]);
  });

  it('should return all notifications (count derived from length)', () => {
    const handler = new BadgeChannelHandler();
    const notifications = createNotifications(5);

    const visible = handler.getVisibleNotifications(notifications);
    expect(visible).toHaveLength(5);
  });

  it('should return correct badge count', () => {
    const handler = new BadgeChannelHandler();
    const notifications = createNotifications(10);

    expect(handler.getBadgeCount(notifications)).toBe(10);
  });

  it('should cap badge count at maxCount', () => {
    const handler = new BadgeChannelHandler({ maxCount: 99 });
    const notifications = createNotifications(150);

    expect(handler.getBadgeCount(notifications)).toBe(99);
  });

  it('should detect overflow', () => {
    const handler = new BadgeChannelHandler({ maxCount: 99 });

    expect(handler.isOverflow(createNotifications(50))).toBe(false);
    expect(handler.isOverflow(createNotifications(99))).toBe(false);
    expect(handler.isOverflow(createNotifications(100))).toBe(true);
  });

  it('should have correct channel properties', () => {
    const handler = new BadgeChannelHandler();
    expect(handler.channel).toBe('badge');
    expect(handler.supportsAutoDismiss).toBe(false);
    expect(handler.pauseOnBlur).toBe(false);
    expect(handler.rendersUI).toBe(true);
  });
});

// ─── None Channel Tests ─────────────────────────────────────────────────────────

describe('NoneChannelHandler', () => {
  it('should always return empty array', () => {
    const handler = new NoneChannelHandler();
    const notifications = createNotifications(10);

    expect(handler.getVisibleNotifications(notifications)).toEqual([]);
  });

  it('should return empty even with empty input', () => {
    const handler = new NoneChannelHandler();
    expect(handler.getVisibleNotifications([])).toEqual([]);
  });

  it('should have correct channel properties', () => {
    const handler = new NoneChannelHandler();
    expect(handler.channel).toBe('none');
    expect(handler.supportsAutoDismiss).toBe(false);
    expect(handler.pauseOnBlur).toBe(false);
    expect(handler.rendersUI).toBe(false);
  });
});

// ─── Channel Registry Tests ─────────────────────────────────────────────────────

describe('NotificationChannelRegistry', () => {
  it('should return StatusBar handler for statusBar channel', () => {
    const handler = notificationChannelRegistry.getHandler('statusBar');
    expect(handler.channel).toBe('statusBar');
    expect(handler).toBeInstanceOf(StatusBarChannelHandler);
  });

  it('should return Toast handler for toast channel', () => {
    const handler = notificationChannelRegistry.getHandler('toast');
    expect(handler.channel).toBe('toast');
    expect(handler).toBeInstanceOf(ToastChannelHandler);
  });

  it('should return TitleBar handler for titleBar channel', () => {
    const handler = notificationChannelRegistry.getHandler('titleBar');
    expect(handler.channel).toBe('titleBar');
    expect(handler).toBeInstanceOf(TitleBarChannelHandler);
  });

  it('should return Badge handler for badge channel', () => {
    const handler = notificationChannelRegistry.getHandler('badge');
    expect(handler.channel).toBe('badge');
    expect(handler).toBeInstanceOf(BadgeChannelHandler);
  });

  it('should return None handler for none channel', () => {
    const handler = notificationChannelRegistry.getHandler('none');
    expect(handler.channel).toBe('none');
    expect(handler).toBeInstanceOf(NoneChannelHandler);
  });

  it('should return all 5 registered handlers', () => {
    const handlers = notificationChannelRegistry.getAllHandlers();
    expect(handlers).toHaveLength(5);

    const channels = handlers.map((h) => h.channel);
    expect(channels).toContain('statusBar');
    expect(channels).toContain('toast');
    expect(channels).toContain('titleBar');
    expect(channels).toContain('badge');
    expect(channels).toContain('none');
  });
});
