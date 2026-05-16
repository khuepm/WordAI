export type NotificationChannel = 'statusBar' | 'toast' | 'titleBar' | 'badge' | 'none';

export type NotificationFormat = 'countdown' | 'elapsed' | 'message' | 'indicator' | 'progress';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type TriggerType = 'onChange' | 'onThreshold' | 'onError' | 'periodic' | 'onEvent';

export type ThresholdOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface ThresholdConfig {
  operator: ThresholdOperator;
  value: unknown;
}

export interface PeriodicConfig {
  intervalMs: number;
}

export interface NotificationPolicy {
  /** Unique identifier for this policy */
  id: string;

  /** Preference key (e.g. "general.autoSyncInterval") or event key (e.g. "sync.error") */
  sourceKey: string;

  /** Channel to deliver notification */
  channel: NotificationChannel;

  /** Display format */
  format: NotificationFormat;

  /** Priority for ordering within same channel */
  priority: NotificationPriority;

  /** Duration in ms. null = persistent until state change */
  duration: number | null;

  /** If true, notification is suppressed entirely */
  silent: boolean;

  /** When to trigger this notification */
  trigger: TriggerType;

  /** Template string with {variable} placeholders */
  template?: string;

  /** Threshold config (required when trigger = 'onThreshold') */
  threshold?: ThresholdConfig;

  /** Periodic config (required when trigger = 'periodic') */
  periodic?: PeriodicConfig;

  /** Human-readable description for Dev Dashboard */
  description?: string;
}

export interface PolicyConfigFile {
  /** Schema version for future migration */
  schemaVersion: 1;

  /** Array of all notification policies */
  policies: NotificationPolicy[];
}

export interface NotificationEvent {
  /** Source key matching policy sourceKey */
  sourceKey: string;

  /** Event type for trigger matching */
  trigger: TriggerType;

  /** Data payload for template resolution */
  data: Record<string, unknown>;

  /** Timestamp of event */
  timestamp: number;
}

export interface ActiveNotification {
  id: string;
  policyId: string;
  channel: NotificationChannel;
  format: NotificationFormat;
  priority: NotificationPriority;
  duration: number | null;
  resolvedContent: string;
  data: Record<string, unknown>;
  state: 'pending' | 'active' | 'dismissed';
  createdAt: number;
  dismissAt: number | null;
}
