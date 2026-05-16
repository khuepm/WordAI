/**
 * Notification Channels - Channel-specific behavior and configuration
 *
 * Provides an abstract NotificationChannelHandler interface and concrete
 * implementations for each channel type:
 * - StatusBar: persistent, priority-ordered, shows top notification
 * - Toast: auto-dismiss stack, max visible limit
 * - TitleBar: indicator only, single notification
 * - Badge: count-based (placeholder for future)
 * - None: no-op for silent policies
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import type {
  ActiveNotification,
  NotificationChannel,
} from '../types/notification';

// ─── Channel Configuration ─────────────────────────────────────────────────────

export interface ToastChannelConfig {
  /** Maximum number of visible toasts at once */
  maxVisible: number;
  /** Position of the toast stack */
  position: 'top-right' | 'bottom-center' | 'top-center' | 'bottom-right';
}

export interface StatusBarChannelConfig {
  /** Whether to show only the top-priority notification */
  showOnlyTop: boolean;
}

export interface TitleBarChannelConfig {
  /** Whether to show only indicator format */
  indicatorOnly: boolean;
}

export interface BadgeChannelConfig {
  /** Maximum count to display (shows "N+" when exceeded) */
  maxCount: number;
}

/** Default configuration for the Toast channel */
const DEFAULT_TOAST_CONFIG: ToastChannelConfig = {
  maxVisible: 3,
  position: 'top-right',
};

/** Default configuration for the StatusBar channel */
const DEFAULT_STATUSBAR_CONFIG: StatusBarChannelConfig = {
  showOnlyTop: true,
};

/** Default configuration for the TitleBar channel */
const DEFAULT_TITLEBAR_CONFIG: TitleBarChannelConfig = {
  indicatorOnly: true,
};

/** Default configuration for the Badge channel */
const DEFAULT_BADGE_CONFIG: BadgeChannelConfig = {
  maxCount: 99,
};

// ─── Abstract Channel Handler Interface ─────────────────────────────────────────

/**
 * Abstract interface for notification channel handlers.
 * Each channel type implements this interface to define channel-specific behavior.
 *
 * Requirement: 2.1
 */
export interface NotificationChannelHandler {
  /** The channel type this handler manages */
  readonly channel: NotificationChannel;

  /**
   * Determine which notifications should be visible given the full list
   * of active notifications for this channel (already sorted by priority).
   *
   * Returns the subset of notifications that should be rendered.
   * Requirement: 2.7
   */
  getVisibleNotifications(notifications: ActiveNotification[]): ActiveNotification[];

  /**
   * Whether this channel supports auto-dismiss behavior.
   * Requirement: 2.8, 2.9
   */
  readonly supportsAutoDismiss: boolean;

  /**
   * Whether this channel should pause dismiss timers on window blur.
   * Requirement: 8.7
   */
  readonly pauseOnBlur: boolean;

  /**
   * Whether this channel renders any UI.
   * Requirement: 2.6
   */
  readonly rendersUI: boolean;
}

// ─── StatusBar Channel ──────────────────────────────────────────────────────────

/**
 * StatusBar channel handler.
 *
 * Behavior:
 * - Shows the highest-priority notification only (top of sorted list)
 * - Persistent notifications (no auto-dismiss unless policy specifies duration)
 * - Does not pause on blur (always visible)
 *
 * Requirement: 2.2
 */
export class StatusBarChannelHandler implements NotificationChannelHandler {
  readonly channel: NotificationChannel = 'statusBar';
  readonly supportsAutoDismiss = true;
  readonly pauseOnBlur = false;
  readonly rendersUI = true;

  constructor(private config: StatusBarChannelConfig = DEFAULT_STATUSBAR_CONFIG) {}

  getVisibleNotifications(notifications: ActiveNotification[]): ActiveNotification[] {
    if (notifications.length === 0) return [];

    if (this.config.showOnlyTop) {
      // Only show the highest-priority notification
      return [notifications[0]];
    }

    return notifications;
  }

  getConfig(): StatusBarChannelConfig {
    return { ...this.config };
  }
}

// ─── Toast Channel ──────────────────────────────────────────────────────────────

/**
 * Toast channel handler.
 *
 * Behavior:
 * - Shows a stack of notifications (limited by maxVisible)
 * - Auto-dismisses based on duration
 * - Pauses dismiss timer on window blur
 * - Position configurable (top-right default)
 *
 * Requirement: 2.3
 */
export class ToastChannelHandler implements NotificationChannelHandler {
  readonly channel: NotificationChannel = 'toast';
  readonly supportsAutoDismiss = true;
  readonly pauseOnBlur = true;
  readonly rendersUI = true;

  constructor(private config: ToastChannelConfig = DEFAULT_TOAST_CONFIG) {}

  getVisibleNotifications(notifications: ActiveNotification[]): ActiveNotification[] {
    if (notifications.length === 0) return [];

    // Limit to maxVisible toasts, priority-ordered (already sorted by caller)
    return notifications.slice(0, this.config.maxVisible);
  }

  getConfig(): ToastChannelConfig {
    return { ...this.config };
  }
}

// ─── TitleBar Channel ───────────────────────────────────────────────────────────

/**
 * TitleBar channel handler.
 *
 * Behavior:
 * - Shows only indicator format (●, ✓, ⟳)
 * - Only one indicator at a time (highest priority)
 * - Persistent (no auto-dismiss)
 * - Does not pause on blur
 *
 * Requirement: 2.4
 */
export class TitleBarChannelHandler implements NotificationChannelHandler {
  readonly channel: NotificationChannel = 'titleBar';
  readonly supportsAutoDismiss = true;
  readonly pauseOnBlur = false;
  readonly rendersUI = true;

  constructor(private config: TitleBarChannelConfig = DEFAULT_TITLEBAR_CONFIG) {}

  getVisibleNotifications(notifications: ActiveNotification[]): ActiveNotification[] {
    if (notifications.length === 0) return [];

    // Only show one indicator at a time (highest priority)
    const filtered = this.config.indicatorOnly
      ? notifications.filter((n) => n.format === 'indicator')
      : notifications;

    if (filtered.length === 0) return [];
    return [filtered[0]];
  }

  getConfig(): TitleBarChannelConfig {
    return { ...this.config };
  }
}

// ─── Badge Channel ──────────────────────────────────────────────────────────────

/**
 * Badge channel handler (placeholder for future).
 *
 * Behavior:
 * - Count-based: shows number of active notifications
 * - No auto-dismiss (count updates as notifications come/go)
 * - Does not pause on blur
 *
 * Requirement: 2.5
 */
export class BadgeChannelHandler implements NotificationChannelHandler {
  readonly channel: NotificationChannel = 'badge';
  readonly supportsAutoDismiss = false;
  readonly pauseOnBlur = false;
  readonly rendersUI = true;

  constructor(private config: BadgeChannelConfig = DEFAULT_BADGE_CONFIG) {}

  getVisibleNotifications(notifications: ActiveNotification[]): ActiveNotification[] {
    // Badge shows all notifications (count is derived from length)
    return notifications;
  }

  /**
   * Get the badge count to display.
   * Returns the count capped at maxCount.
   */
  getBadgeCount(notifications: ActiveNotification[]): number {
    return Math.min(notifications.length, this.config.maxCount);
  }

  /**
   * Whether the badge count exceeds the max display count.
   */
  isOverflow(notifications: ActiveNotification[]): boolean {
    return notifications.length > this.config.maxCount;
  }

  getConfig(): BadgeChannelConfig {
    return { ...this.config };
  }
}

// ─── None Channel ───────────────────────────────────────────────────────────────

/**
 * None channel handler (no-op).
 *
 * Behavior:
 * - Does not render any UI
 * - Used for silent policies
 * - No auto-dismiss (nothing to dismiss visually)
 *
 * Requirement: 2.6
 */
export class NoneChannelHandler implements NotificationChannelHandler {
  readonly channel: NotificationChannel = 'none';
  readonly supportsAutoDismiss = false;
  readonly pauseOnBlur = false;
  readonly rendersUI = false;

  getVisibleNotifications(_notifications: ActiveNotification[]): ActiveNotification[] {
    // None channel never shows anything
    return [];
  }
}

// ─── Channel Registry ───────────────────────────────────────────────────────────

/**
 * Registry/factory for getting the handler for a given channel.
 * Provides a centralized way to access channel-specific behavior.
 */
class NotificationChannelRegistry {
  private handlers: Map<NotificationChannel, NotificationChannelHandler> = new Map();

  constructor() {
    // Register default handlers
    this.handlers.set('statusBar', new StatusBarChannelHandler());
    this.handlers.set('toast', new ToastChannelHandler());
    this.handlers.set('titleBar', new TitleBarChannelHandler());
    this.handlers.set('badge', new BadgeChannelHandler());
    this.handlers.set('none', new NoneChannelHandler());
  }

  /**
   * Get the handler for a specific channel.
   * Returns the NoneChannelHandler if the channel is not registered.
   */
  getHandler(channel: NotificationChannel): NotificationChannelHandler {
    return this.handlers.get(channel) ?? this.handlers.get('none')!;
  }

  /**
   * Get all registered channel handlers.
   */
  getAllHandlers(): NotificationChannelHandler[] {
    return [...this.handlers.values()];
  }

  /**
   * Register or replace a channel handler.
   * Useful for testing or custom channel implementations.
   */
  registerHandler(handler: NotificationChannelHandler): void {
    this.handlers.set(handler.channel, handler);
  }
}

/** Singleton instance of the channel registry */
export const notificationChannelRegistry = new NotificationChannelRegistry();
