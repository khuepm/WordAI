/**
 * NotificationDispatcher - Event → Policy → Channel routing service
 *
 * Accepts NotificationEvents, looks up matching policies from the registry,
 * filters silent policies, resolves template variables, creates ActiveNotifications,
 * and routes them to the appropriate channels.
 *
 * Requirements: 1.6, 1.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import type {
  ActiveNotification,
  NotificationChannel,
  NotificationEvent,
  NotificationPolicy,
  ThresholdOperator,
} from '../types/notification';
import { notificationRegistry } from './notificationRegistry';

/** Maximum number of entries in the notification log (ring buffer) */
const MAX_LOG_SIZE = 200;

type ChannelListener = () => void;

/**
 * Resolve template variables in a template string.
 * Replaces `{variableName}` with values from the data record.
 * Uses `[unknown]` for variables that cannot be resolved.
 *
 * Requirements: 3.6, 3.8
 */
export function resolveTemplate(
  template: string | undefined,
  data: Record<string, unknown>
): string {
  if (!template) return '';

  return template.replace(/\{(\w+)\}/g, (_match, variableName: string) => {
    const value = data[variableName];
    if (value === undefined || value === null) {
      return '[unknown]';
    }
    return String(value);
  });
}

/**
 * Generate a unique notification ID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Evaluate a threshold condition against an event's data value.
 * Compares `event.data.value` against `policy.threshold.value` using the configured operator.
 *
 * Returns true if the threshold condition is satisfied.
 * Returns false if the policy has no threshold config, or if the values cannot be compared.
 *
 * Requirements: 4.2, 4.7
 */
export function evaluateThreshold(
  policy: NotificationPolicy,
  event: NotificationEvent
): boolean {
  if (!policy.threshold) return false;

  const { operator, value: thresholdValue } = policy.threshold;
  const eventValue = event.data.value;

  // Cannot evaluate if event value is missing
  if (eventValue === undefined || eventValue === null) return false;

  return compareValues(eventValue, operator, thresholdValue);
}

/**
 * Compare two values using the given operator.
 * Supports numeric and string comparisons.
 *
 * Requirement: 4.7
 */
function compareValues(
  actual: unknown,
  operator: ThresholdOperator,
  threshold: unknown
): boolean {
  // For == and != operators, use loose equality to handle type coercion
  if (operator === '==') return actual == threshold;
  if (operator === '!=') return actual != threshold;

  // For relational operators, both values must be numbers
  const numActual = Number(actual);
  const numThreshold = Number(threshold);

  if (isNaN(numActual) || isNaN(numThreshold)) return false;

  switch (operator) {
    case '>':
      return numActual > numThreshold;
    case '<':
      return numActual < numThreshold;
    case '>=':
      return numActual >= numThreshold;
    case '<=':
      return numActual <= numThreshold;
    default:
      return false;
  }
}

class NotificationDispatcherImpl {
  private activeNotifications: Map<string, ActiveNotification> = new Map();
  private log: ActiveNotification[] = [];
  private channelListeners: Map<NotificationChannel, Set<ChannelListener>> = new Map();
  /** Track auto-dismiss timers by notification id for cleanup. Requirement: 8.5 */
  private autoDismissTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  /** Track periodic policy timers by policy id. Requirement: 4.4 */
  private periodicTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  /**
   * Dispatch an event — looks up policies and routes to channels.
   *
   * 1. Lookup policies from registry
   * 2. Filter out silent policies (Requirement 1.6)
   * 3. For onThreshold policies, evaluate threshold condition (Requirement 4.2)
   * 4. Resolve template variables
   * 5. Create ActiveNotification for each policy
   * 6. Route to channel (notify subscribers)
   *
   * Trigger matching:
   * - onChange: matches when event.trigger === 'onChange' (Requirement 4.1)
   * - onThreshold: matches when event.trigger === 'onThreshold' AND threshold condition met (Requirement 4.2, 4.7)
   * - onError: matches when event.trigger === 'onError' (Requirement 4.3)
   * - periodic: managed by internal timer via startPeriodicPolicies() (Requirement 4.4)
   * - onEvent: matches when event.trigger === 'onEvent' AND sourceKey matches (Requirement 4.5)
   *
   * Multiple policies for the same event dispatch simultaneously (Requirement 4.8).
   *
   * Requirements: 1.6, 1.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
   */
  dispatch(event: NotificationEvent): void {
    // 1. Lookup policies from registry
    const policies = notificationRegistry.lookupPolicies(event.sourceKey, event.trigger);

    // If no policies match, do nothing (Requirement 4.6)
    if (policies.length === 0) return;

    // 2. Filter out silent policies (Requirement 1.6)
    const nonSilentPolicies = policies.filter((policy) => !policy.silent);

    // 3. For onThreshold policies, additionally check threshold condition (Requirement 4.2, 4.7)
    const activePolicies = nonSilentPolicies.filter((policy) => {
      if (policy.trigger === 'onThreshold') {
        return evaluateThreshold(policy, event);
      }
      // onChange, onError, onEvent: already matched by registry lookup
      return true;
    });

    // 4-6. For each qualifying policy, resolve template, create notification, route to channel
    const affectedChannels = new Set<NotificationChannel>();

    for (const policy of activePolicies) {
      this.dispatchPolicy(policy, event, affectedChannels);
    }

    // Notify all affected channel subscribers
    for (const channel of affectedChannels) {
      this.notifyChannelListeners(channel);
    }
  }

  /**
   * Dismiss a specific notification by id.
   * Clears any associated auto-dismiss timer.
   * Requirement: 8.4, 8.5
   */
  dismiss(notificationId: string): void {
    const notification = this.activeNotifications.get(notificationId);
    if (!notification) return;

    // Clear auto-dismiss timer if one exists
    this.clearAutoDismissTimer(notificationId);

    notification.state = 'dismissed';
    this.activeNotifications.delete(notificationId);
    this.notifyChannelListeners(notification.channel);
  }

  /**
   * Dismiss all notifications for a channel.
   * Clears any associated auto-dismiss timers.
   */
  dismissChannel(channel: NotificationChannel): void {
    let changed = false;

    for (const [id, notification] of this.activeNotifications) {
      if (notification.channel === channel) {
        this.clearAutoDismissTimer(id);
        notification.state = 'dismissed';
        this.activeNotifications.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.notifyChannelListeners(channel);
    }
  }

  /**
   * Get active notifications for a specific channel, sorted by priority.
   * Priority order: critical > high > medium > low
   */
  getChannelNotifications(channel: NotificationChannel): ActiveNotification[] {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const notifications: ActiveNotification[] = [];

    for (const notification of this.activeNotifications.values()) {
      if (notification.channel === channel && notification.state === 'active') {
        notifications.push(notification);
      }
    }

    return notifications.sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );
  }

  /**
   * Subscribe to channel updates.
   * Returns an unsubscribe function.
   */
  subscribeChannel(channel: NotificationChannel, listener: ChannelListener): () => void {
    let listeners = this.channelListeners.get(channel);
    if (!listeners) {
      listeners = new Set();
      this.channelListeners.set(channel, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners!.delete(listener);
      if (listeners!.size === 0) {
        this.channelListeners.delete(channel);
      }
    };
  }

  /**
   * Get notification log (ring buffer, max 200 entries).
   */
  getLog(): ActiveNotification[] {
    return [...this.log];
  }

  /**
   * Simulate an event (dev mode).
   * Same as dispatch but can be called from Dev Dashboard.
   */
  simulate(event: NotificationEvent): void {
    this.dispatch(event);
  }

  /**
   * Start periodic timers for all policies with trigger = 'periodic'.
   * Each periodic policy dispatches a notification every `policy.periodic.intervalMs` milliseconds.
   * The dispatched event uses the policy's sourceKey.
   *
   * Requirement: 4.4
   */
  startPeriodicPolicies(): void {
    const allPolicies = notificationRegistry.getAllPolicies();
    const periodicPolicies = allPolicies.filter(
      (policy) => policy.trigger === 'periodic' && policy.periodic && !policy.silent
    );

    for (const policy of periodicPolicies) {
      // Skip if already running
      if (this.periodicTimers.has(policy.id)) continue;

      const intervalMs = policy.periodic!.intervalMs;
      if (intervalMs <= 0) continue;

      const timerId = setInterval(() => {
        const event: NotificationEvent = {
          sourceKey: policy.sourceKey,
          trigger: 'periodic',
          data: {},
          timestamp: Date.now(),
        };
        this.dispatch(event);
      }, intervalMs);

      this.periodicTimers.set(policy.id, timerId);
    }
  }

  /**
   * Stop all periodic policy timers.
   * Should be called during cleanup or when policies change.
   *
   * Requirement: 4.4
   */
  stopPeriodicPolicies(): void {
    for (const timerId of this.periodicTimers.values()) {
      clearInterval(timerId);
    }
    this.periodicTimers.clear();
  }

  /**
   * Dispatch a single policy for an event.
   * Creates an ActiveNotification and stores it.
   *
   * - Dismisses any existing active notification with the same policyId (Requirement 8.5b)
   * - Starts auto-dismiss timer if duration !== null (Requirement 8.5a)
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  private dispatchPolicy(
    policy: NotificationPolicy,
    event: NotificationEvent,
    affectedChannels: Set<NotificationChannel>
  ): void {
    // Policy replacement: dismiss existing notification with same policyId
    // Requirement 8.5 — new notification replaces old for same policy
    for (const [id, existing] of this.activeNotifications) {
      if (existing.policyId === policy.id && existing.state === 'active') {
        this.clearAutoDismissTimer(id);
        existing.state = 'dismissed';
        this.activeNotifications.delete(id);
        affectedChannels.add(existing.channel);
        break; // Only one active notification per policy at a time
      }
    }

    // 3. Resolve template variables
    const resolvedContent = resolveTemplate(policy.template, event.data);

    // 4. Create ActiveNotification
    const now = Date.now();
    const notification: ActiveNotification = {
      id: generateId(),
      policyId: policy.id,
      channel: policy.channel,
      format: policy.format,
      priority: policy.priority,
      duration: policy.duration,
      resolvedContent,
      data: { ...event.data },
      state: 'active',
      createdAt: now,
      dismissAt: policy.duration !== null ? now + policy.duration : null,
    };

    // 5. Store in activeNotifications map
    this.activeNotifications.set(notification.id, notification);

    // Start auto-dismiss timer if duration is set (Requirement 8.5a)
    if (policy.duration !== null && policy.duration > 0) {
      const timerId = setTimeout(() => {
        this.autoDismissTimers.delete(notification.id);
        this.dismiss(notification.id);
      }, policy.duration);
      this.autoDismissTimers.set(notification.id, timerId);
    }

    // Add to log (ring buffer, max 200)
    this.addToLog(notification);

    // Track affected channel for batch notification
    affectedChannels.add(policy.channel);
  }

  /**
   * Clear an auto-dismiss timer for a specific notification.
   */
  private clearAutoDismissTimer(notificationId: string): void {
    const timerId = this.autoDismissTimers.get(notificationId);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.autoDismissTimers.delete(notificationId);
    }
  }

  /**
   * Cleanup all active notifications and timers.
   * Should be called when the notification system is being torn down
   * (e.g., component unmount or app close).
   *
   * Requirement: 8.8
   */
  cleanup(): void {
    // Stop all periodic timers
    this.stopPeriodicPolicies();

    // Clear all auto-dismiss timers
    for (const timerId of this.autoDismissTimers.values()) {
      clearTimeout(timerId);
    }
    this.autoDismissTimers.clear();

    // Dismiss all active notifications
    const affectedChannels = new Set<NotificationChannel>();
    for (const [id, notification] of this.activeNotifications) {
      notification.state = 'dismissed';
      affectedChannels.add(notification.channel);
      this.activeNotifications.delete(id);
    }

    // Notify all affected channel subscribers
    for (const channel of affectedChannels) {
      this.notifyChannelListeners(channel);
    }
  }

  /**
   * Add a notification to the log, maintaining the ring buffer max size.
   * Requirement: 5.6, 8.6
   */
  private addToLog(notification: ActiveNotification): void {
    this.log.push(notification);

    // Enforce ring buffer max size (FIFO)
    if (this.log.length > MAX_LOG_SIZE) {
      this.log.shift();
    }
  }

  /**
   * Notify all listeners subscribed to a specific channel.
   */
  private notifyChannelListeners(channel: NotificationChannel): void {
    const listeners = this.channelListeners.get(channel);
    if (!listeners) return;

    for (const listener of listeners) {
      listener();
    }
  }
}

/** Singleton instance of the NotificationDispatcher */
export const notificationDispatcher = new NotificationDispatcherImpl();

export type { NotificationDispatcherImpl };
