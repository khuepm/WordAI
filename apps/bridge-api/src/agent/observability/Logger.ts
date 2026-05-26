/**
 * AuraSphere Agent Framework — Structured Logger
 *
 * Provides structured logging for agent invocations and execution plan summaries.
 * Leverages the existing winston logger from bridge-api.
 *
 * - Development mode: includes full prompt/response content for debugging
 * - Production mode: metadata only, structured JSON format
 * - All logging is async and non-blocking (fire-and-forget)
 *
 * Requirements: 10.1, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12
 */

import logger from '../../utils/logger';
import type { AgentStatus } from '../types';

/**
 * Data structure for logging an individual agent invocation.
 */
export interface AgentInvocationLogData {
  task_id: string;
  agent_id: string;
  tier: string;
  provider_id: string;
  tokens_used: number;
  execution_time_ms: number;
  status: AgentStatus;
  trace_id: string;
  /** Full prompt content (included only in development mode). */
  prompt?: string;
  /** Full response content (included only in development mode). */
  response?: string;
}

/**
 * Data structure for logging an execution plan summary.
 */
export interface PlanSummaryLogData {
  task_id: string;
  total_agents_invoked: number;
  total_tokens_used: number;
  total_execution_time_ms: number;
  final_status: string;
  trace_id: string;
}

/**
 * Structured logger for the AuraSphere Agent Framework.
 *
 * Emits structured logs for agent invocations and plan summaries.
 * Logging is fire-and-forget to ensure it never blocks agent execution.
 */
export class AgentLogger {
  private mode: 'development' | 'production';

  constructor(mode: 'development' | 'production') {
    this.mode = mode;
  }

  /**
   * Log an individual agent invocation with structured metadata.
   *
   * In development mode, includes full prompt and response content.
   * In production mode, logs metadata only (no prompt/response content).
   *
   * Validates: Requirements 10.1, 10.8, 10.9, 10.10, 10.11
   */
  logAgentInvocation(data: AgentInvocationLogData): void {
    // Fire-and-forget: use setImmediate to ensure non-blocking behavior
    setImmediate(() => {
      try {
        const metadata: Record<string, unknown> = {
          event: 'agent_invocation',
          task_id: data.task_id,
          agent_id: data.agent_id,
          tier: data.tier,
          provider_id: data.provider_id,
          tokens_used: data.tokens_used,
          execution_time_ms: data.execution_time_ms,
          status: data.status,
          trace_id: data.trace_id,
        };

        // In development mode, include full prompt/response for debugging
        if (this.mode === 'development') {
          if (data.prompt !== undefined) {
            metadata.prompt = data.prompt;
          }
          if (data.response !== undefined) {
            metadata.response = data.response;
          }
        }

        // Use warn for degraded states (partial, max_iterations_reached, error)
        if (data.status === 'error' || data.status === 'partial' || data.status === 'max_iterations_reached') {
          logger.warn('Agent invocation completed with degraded status', metadata);
        } else {
          logger.info('Agent invocation completed', metadata);
        }
      } catch {
        // Requirement 10.12: If log emission fails, continue without interruption.
        // Record failure in a local fallback log (stderr).
        try {
          process.stderr.write(
            `[AgentLogger] Failed to emit agent invocation log for task_id=${data.task_id}\n`
          );
        } catch {
          // Absolute last resort: silently swallow to never block execution
        }
      }
    });
  }

  /**
   * Log an execution plan summary with aggregated metrics.
   *
   * Emitted when an Execution_Plan reaches a terminal state.
   *
   * Validates: Requirements 10.7, 10.8, 10.11
   */
  logPlanSummary(data: PlanSummaryLogData): void {
    // Fire-and-forget: use setImmediate to ensure non-blocking behavior
    setImmediate(() => {
      try {
        const metadata: Record<string, unknown> = {
          event: 'plan_summary',
          task_id: data.task_id,
          total_agents_invoked: data.total_agents_invoked,
          total_tokens_used: data.total_tokens_used,
          total_execution_time_ms: data.total_execution_time_ms,
          final_status: data.final_status,
          trace_id: data.trace_id,
        };

        // Use warn for non-success terminal states
        if (data.final_status !== 'success') {
          logger.warn('Execution plan completed with non-success status', metadata);
        } else {
          logger.info('Execution plan completed', metadata);
        }
      } catch {
        // Requirement 10.12: If log emission fails, continue without interruption.
        try {
          process.stderr.write(
            `[AgentLogger] Failed to emit plan summary log for task_id=${data.task_id}\n`
          );
        } catch {
          // Absolute last resort: silently swallow to never block execution
        }
      }
    });
  }
}
