/**
 * Agent Context Manager
 *
 * Manages per-task context state including conversation history,
 * intermediate results, and shared knowledge between agents in a pipeline.
 * Implements configurable retention with automatic cleanup of expired contexts.
 *
 * Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 5.11
 */

import type { AgentMessage, AgentResult } from '../types';

/**
 * The full state of an agent context for a single task execution.
 */
export interface AgentContextState {
  task_id: string;
  conversation_history: AgentMessage[];
  intermediate_results: Map<string, AgentResult>;
  task_metadata: Record<string, unknown>;
  shared_knowledge: Record<string, string>;
  created_at: string;
  expires_at: string;
}

/**
 * Serializable representation of AgentContextState for JSON persistence.
 * Maps are converted to plain objects for JSON compatibility.
 */
interface SerializedAgentContextState {
  task_id: string;
  conversation_history: AgentMessage[];
  intermediate_results: Record<string, AgentResult>;
  task_metadata: Record<string, unknown>;
  shared_knowledge: Record<string, string>;
  created_at: string;
  expires_at: string;
}

/**
 * ContextManager maintains per-task agent context with automatic expiration.
 *
 * Contexts are stored in-memory and automatically disposed when their
 * retention period expires. The cleanup interval runs every 60 seconds.
 */
export class ContextManager {
  private contexts: Map<string, AgentContextState> = new Map();
  private retentionMinutes: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private static readonly MIN_RETENTION_MINUTES = 1;
  private static readonly MAX_RETENTION_MINUTES = 1440; // 24 hours
  private static readonly DEFAULT_RETENTION_MINUTES = 30;
  private static readonly CLEANUP_INTERVAL_MS = 60_000; // 60 seconds

  /**
   * Create a new ContextManager.
   *
   * @param retentionMinutes - How long contexts are retained after creation.
   *   Must be between 1 and 1440 (24 hours). Defaults to 30 minutes.
   */
  constructor(retentionMinutes?: number) {
    this.retentionMinutes = this.validateRetention(retentionMinutes);
    this.startCleanupInterval();
  }

  /**
   * Create a new context for a task.
   *
   * @param taskId - Unique identifier for the task
   * @param metadata - Arbitrary metadata to associate with the context
   * @returns The newly created AgentContextState
   */
  create(taskId: string, metadata: Record<string, unknown>): AgentContextState {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.retentionMinutes * 60_000);

    const context: AgentContextState = {
      task_id: taskId,
      conversation_history: [],
      intermediate_results: new Map(),
      task_metadata: metadata,
      shared_knowledge: {},
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    this.contexts.set(taskId, context);
    return context;
  }

  /**
   * Retrieve a context by task ID.
   *
   * @param taskId - The task ID to look up
   * @returns The context state, or null if not found
   */
  get(taskId: string): AgentContextState | null {
    return this.contexts.get(taskId) ?? null;
  }

  /**
   * Add an intermediate result from a pipeline step to the context.
   *
   * @param taskId - The task ID
   * @param stepId - The step identifier (used as key)
   * @param result - The AgentResult produced by the step
   */
  addIntermediateResult(taskId: string, stepId: string, result: AgentResult): void {
    const context = this.contexts.get(taskId);
    if (!context) {
      return;
    }
    context.intermediate_results.set(stepId, result);
  }

  /**
   * Add a shared knowledge entry accessible to all agents in the pipeline.
   *
   * @param taskId - The task ID
   * @param key - Knowledge key
   * @param value - Knowledge value
   */
  addSharedKnowledge(taskId: string, key: string, value: string): void {
    const context = this.contexts.get(taskId);
    if (!context) {
      return;
    }
    context.shared_knowledge[key] = value;
  }

  /**
   * Dispose of a context, releasing its memory.
   *
   * @param taskId - The task ID to dispose
   */
  dispose(taskId: string): void {
    this.contexts.delete(taskId);
  }

  /**
   * Serialize a context to a JSON string for persistence.
   *
   * Converts the intermediate_results Map to a plain object for JSON compatibility.
   *
   * @param taskId - The task ID to serialize
   * @returns JSON string representation, or null if context not found
   */
  serialize(taskId: string): string | null {
    const context = this.contexts.get(taskId);
    if (!context) {
      return null;
    }

    const serializable: SerializedAgentContextState = {
      task_id: context.task_id,
      conversation_history: context.conversation_history,
      intermediate_results: Object.fromEntries(context.intermediate_results),
      task_metadata: context.task_metadata,
      shared_knowledge: context.shared_knowledge,
      created_at: context.created_at,
      expires_at: context.expires_at,
    };

    return JSON.stringify(serializable);
  }

  /**
   * Deserialize a JSON string back into an AgentContextState.
   *
   * Converts the intermediate_results plain object back to a Map.
   *
   * @param json - JSON string previously produced by serialize()
   * @returns The deserialized AgentContextState
   */
  deserialize(json: string): AgentContextState {
    const parsed: SerializedAgentContextState = JSON.parse(json);

    return {
      task_id: parsed.task_id,
      conversation_history: parsed.conversation_history,
      intermediate_results: new Map(Object.entries(parsed.intermediate_results)),
      task_metadata: parsed.task_metadata,
      shared_knowledge: parsed.shared_knowledge,
      created_at: parsed.created_at,
      expires_at: parsed.expires_at,
    };
  }

  /**
   * Destroy the ContextManager, clearing the cleanup interval and all contexts.
   * Call this when shutting down the application.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.contexts.clear();
  }

  /**
   * Get the number of active contexts (useful for metrics/testing).
   */
  get size(): number {
    return this.contexts.size;
  }

  /**
   * Get the configured retention duration in minutes.
   */
  get retention(): number {
    return this.retentionMinutes;
  }

  /**
   * Validate and clamp the retention value to the allowed range.
   */
  private validateRetention(minutes?: number): number {
    if (minutes === undefined || minutes === null) {
      return ContextManager.DEFAULT_RETENTION_MINUTES;
    }

    return Math.max(
      ContextManager.MIN_RETENTION_MINUTES,
      Math.min(ContextManager.MAX_RETENTION_MINUTES, Math.round(minutes)),
    );
  }

  /**
   * Start the periodic cleanup interval that disposes expired contexts.
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, ContextManager.CLEANUP_INTERVAL_MS);

    // Allow the process to exit even if the interval is still running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove all contexts whose expires_at timestamp has passed.
   */
  private cleanupExpired(): void {
    const now = Date.now();

    for (const [taskId, context] of this.contexts) {
      const expiresAt = new Date(context.expires_at).getTime();
      if (expiresAt <= now) {
        this.contexts.delete(taskId);
      }
    }
  }
}
