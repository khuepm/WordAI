/**
 * AuraSphere Agent Framework — Trace ID Propagation
 *
 * Provides distributed tracing support by generating unique trace IDs and
 * propagating them through the execution chain. Each Bridge_API request
 * receives a trace_id that flows through all agent invocations, log entries,
 * and metrics.
 *
 * Requirements: 10.8
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Represents a trace context for distributed tracing.
 * A trace contains one or more spans representing units of work.
 */
export interface TraceContext {
  /** Root trace identifier — shared across all spans in a request. */
  trace_id: string;
  /** Identifier for the current unit of work. */
  span_id: string;
  /** Optional parent span for nested operations. */
  parent_span_id?: string;
}

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

/**
 * Utility class for generating and propagating trace IDs through the
 * AuraSphere agent execution chain.
 *
 * Usage:
 * 1. At the Bridge_API request boundary, call `generateTraceId()` to create
 *    a root trace ID (or extract one from incoming headers).
 * 2. For each agent invocation or significant operation, call `createSpan()`
 *    to create a child span within the trace.
 * 3. Attach the TraceContext to log entries and metrics for correlation.
 */
export class Tracer {
  /**
   * Generates a unique trace ID (UUID v4).
   * Call this once per incoming Bridge_API request to establish the root trace.
   */
  generateTraceId(): string {
    return randomUUID();
  }

  /**
   * Creates a new span within an existing trace.
   *
   * @param traceId - The root trace ID for the request
   * @param _name - Descriptive name for the span (e.g., "research-agent-execute")
   * @param parentSpanId - Optional parent span ID for nested spans
   * @returns A TraceContext with the trace_id, a new span_id, and optional parent
   */
  createSpan(
    traceId: string,
    _name: string,
    parentSpanId?: string,
  ): TraceContext {
    return {
      trace_id: traceId,
      span_id: randomUUID(),
      parent_span_id: parentSpanId,
    };
  }

  /**
   * Creates a root span for a new trace.
   * Convenience method that generates both a trace_id and an initial span.
   *
   * @param name - Descriptive name for the root span
   * @returns A TraceContext representing the start of a new trace
   */
  createRootSpan(name: string): TraceContext {
    const traceId = this.generateTraceId();
    return this.createSpan(traceId, name);
  }

  /**
   * Extracts trace_id from an existing TraceContext for attaching to
   * log entries and metrics.
   *
   * @param context - The current trace context
   * @returns The trace_id string for inclusion in structured logs/metrics
   */
  getTraceId(context: TraceContext): string {
    return context.trace_id;
  }
}
