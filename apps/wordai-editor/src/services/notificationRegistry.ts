/**
 * NotificationRegistry - Policy loading, validation, and merge service
 *
 * Loads notification policies from config file via Tauri IPC,
 * validates against schema, merges with bundled defaults,
 * and supports wildcard matching for sourceKey lookups.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.8
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  NotificationPolicy,
  PolicyConfigFile,
  TriggerType,
} from '../types/notification';
import defaultConfig from '../config/default-notification-policies.json';

/** Valid values for schema validation */
const VALID_CHANNELS = ['statusBar', 'toast', 'titleBar', 'badge', 'none'] as const;
const VALID_FORMATS = ['countdown', 'elapsed', 'message', 'indicator', 'progress'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_TRIGGERS = ['onChange', 'onThreshold', 'onError', 'periodic', 'onEvent'] as const;

/**
 * Validate a single policy object has all required fields with valid values.
 */
function isValidPolicy(policy: unknown): policy is NotificationPolicy {
  if (typeof policy !== 'object' || policy === null) return false;

  const p = policy as Record<string, unknown>;

  if (typeof p.id !== 'string' || p.id.length === 0) return false;
  if (typeof p.sourceKey !== 'string' || p.sourceKey.length === 0) return false;
  if (!VALID_CHANNELS.includes(p.channel as typeof VALID_CHANNELS[number])) return false;
  if (!VALID_FORMATS.includes(p.format as typeof VALID_FORMATS[number])) return false;
  if (!VALID_PRIORITIES.includes(p.priority as typeof VALID_PRIORITIES[number])) return false;
  if (typeof p.silent !== 'boolean') return false;
  if (!VALID_TRIGGERS.includes(p.trigger as typeof VALID_TRIGGERS[number])) return false;
  if (p.duration !== null && typeof p.duration !== 'number') return false;

  return true;
}

/**
 * Validate a PolicyConfigFile structure.
 */
function isValidConfigFile(data: unknown): data is PolicyConfigFile {
  if (typeof data !== 'object' || data === null) return false;

  const config = data as Record<string, unknown>;

  if (config.schemaVersion !== 1) return false;
  if (!Array.isArray(config.policies)) return false;

  return config.policies.every(isValidPolicy);
}

/**
 * Check if a sourceKey pattern matches a given event sourceKey.
 * Supports wildcard matching where `*` matches any remaining segments.
 *
 * Examples:
 * - "preference.*" matches "preference.changed.general.autoSyncInterval"
 * - "sync.error" matches "sync.error" (exact match)
 * - "preference.*" does NOT match "other.key"
 */
export function matchesSourceKey(pattern: string, eventSourceKey: string): boolean {
  // Exact match
  if (pattern === eventSourceKey) return true;

  // Wildcard matching: pattern ends with ".*"
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1); // Remove the trailing '*', keep the dot
    return eventSourceKey.startsWith(prefix);
  }

  // Wildcard in the middle: split by '*' and check segments
  if (pattern.includes('*')) {
    const parts = pattern.split('*');
    let remaining = eventSourceKey;

    for (const part of parts) {
      if (part === '') continue;
      const index = remaining.indexOf(part);
      if (index === -1) return false;
      remaining = remaining.slice(index + part.length);
    }

    return true;
  }

  return false;
}

/**
 * Merge user policies with default policies.
 * User policies override default policies with the same `id`.
 * Policies in user config not in defaults are kept.
 * Policies in defaults not in user config are kept.
 */
export function mergePolicies(
  defaults: NotificationPolicy[],
  userPolicies: NotificationPolicy[]
): NotificationPolicy[] {
  const userMap = new Map(userPolicies.map((p) => [p.id, p]));
  const merged: NotificationPolicy[] = [];
  const processedIds = new Set<string>();

  // Start with defaults, override with user policies where ids match
  for (const defaultPolicy of defaults) {
    const userPolicy = userMap.get(defaultPolicy.id);
    if (userPolicy) {
      merged.push(userPolicy);
    } else {
      merged.push(defaultPolicy);
    }
    processedIds.add(defaultPolicy.id);
  }

  // Add user policies that don't exist in defaults
  for (const userPolicy of userPolicies) {
    if (!processedIds.has(userPolicy.id)) {
      merged.push(userPolicy);
    }
  }

  return merged;
}

type PolicyChangeListener = () => void;

class NotificationRegistryImpl {
  private policies: NotificationPolicy[] = [];
  private overrides: Map<string, Partial<NotificationPolicy>> = new Map();
  private initialized = false;
  private listeners: Set<PolicyChangeListener> = new Set();

  /**
   * Load policies from config file (IPC) + merge with defaults.
   * If config file doesn't exist or is invalid, falls back to bundled defaults.
   * Requirements: 1.1, 1.3, 1.8
   */
  async initialize(): Promise<void> {
    const defaults = (defaultConfig as PolicyConfigFile).policies;

    try {
      const raw = await invoke<string | null>('load_notification_policies');

      if (raw === null) {
        // Config file doesn't exist — use defaults
        this.policies = [...defaults];
      } else {
        const parsed: unknown = JSON.parse(raw);

        if (isValidConfigFile(parsed)) {
          this.policies = mergePolicies(defaults, parsed.policies);
        } else {
          // Invalid schema — log warning and fallback to defaults
          console.warn(
            '[NotificationRegistry] Config file has invalid schema, falling back to defaults'
          );
          this.policies = [...defaults];
        }
      }
    } catch (error) {
      // IPC error or JSON parse error — fallback to defaults
      console.warn('[NotificationRegistry] Failed to load config, using defaults:', error);
      this.policies = [...defaults];
    }

    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * Get all active policies with overrides applied.
   * Returns merged policies (defaults + user + overrides).
   * Requirements: 1.4, 1.5
   */
  getAllPolicies(): NotificationPolicy[] {
    return this.policies.map((policy) => {
      const override = this.overrides.get(policy.id);
      if (override) {
        return { ...policy, ...override, id: policy.id };
      }
      return policy;
    });
  }

  /**
   * Lookup policies matching a sourceKey and trigger type.
   * Supports wildcard matching for sourceKey.
   * Requirements: 1.5, 1.8
   */
  lookupPolicies(sourceKey: string, trigger: TriggerType): NotificationPolicy[] {
    const allPolicies = this.getAllPolicies();

    return allPolicies.filter((policy) => {
      const sourceMatches = matchesSourceKey(policy.sourceKey, sourceKey);
      const triggerMatches = policy.trigger === trigger;
      return sourceMatches && triggerMatches;
    });
  }

  /**
   * Override a policy at runtime (in-memory, not persisted).
   */
  overridePolicy(policyId: string, overrides: Partial<NotificationPolicy>): void {
    this.overrides.set(policyId, overrides);
    this.notifyListeners();
  }

  /**
   * Persist current policies (including overrides) to config file via IPC.
   */
  async saveToConfig(): Promise<void> {
    const policies = this.getAllPolicies();
    const configFile: PolicyConfigFile = {
      schemaVersion: 1,
      policies,
    };

    await invoke('save_notification_policies', {
      config: JSON.stringify(configFile, null, 2),
    });
  }

  /**
   * Reset all overrides, reload from bundled defaults.
   */
  async resetToDefaults(): Promise<void> {
    this.overrides.clear();
    this.policies = [...(defaultConfig as PolicyConfigFile).policies];
    this.notifyListeners();
  }

  /**
   * Subscribe to policy changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: PolicyChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current snapshot (for useSyncExternalStore).
   */
  getSnapshot(): Readonly<NotificationPolicy[]> {
    return this.getAllPolicies();
  }

  /**
   * Whether the registry has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/** Singleton instance of the NotificationRegistry */
export const notificationRegistry = new NotificationRegistryImpl();

export type { NotificationRegistryImpl };
