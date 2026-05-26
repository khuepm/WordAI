/**
 * AuraSphere Agent Framework — Metrics Collector
 *
 * Simple in-memory metrics collection with counters and histograms.
 * Designed for consumption by the /ai/agent/health endpoint and
 * future integration with external metrics systems (Prometheus, StatsD).
 *
 * Requirements: 10.2, 10.3, 10.4, 10.5, 10.6
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Summary statistics for a histogram metric.
 */
export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

/**
 * A point-in-time snapshot of all collected metrics.
 */
export interface MetricsSnapshot {
  /** Counter values keyed by metric name + serialized labels. */
  counters: Record<string, number>;
  /** Histogram summaries keyed by metric name + serialized labels. */
  histograms: Record<string, HistogramSummary>;
  /** ISO 8601 timestamp when the snapshot was taken. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a composite key from a metric name and its labels.
 * Labels are sorted alphabetically to ensure consistent key generation.
 */
function buildKey(name: string, labels: Record<string, string>): string {
  const sortedEntries = Object.entries(labels).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (sortedEntries.length === 0) {
    return name;
  }
  const labelStr = sortedEntries
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${name}{${labelStr}}`;
}

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

/**
 * In-memory metrics collector supporting counters and histograms.
 *
 * Tracked metrics:
 * - agent_execution_duration_ms (histogram by agent_role, tier)
 * - agent_token_usage (counter by agent_role, tier)
 * - orchestration_plan_duration_ms (histogram by template_id)
 * - provider_request_count (counter by provider_id, status)
 * - tier_routing_decisions (counter by assigned_tier, reasoning)
 */
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter by 1 (or create it at 1 if it doesn't exist).
   *
   * @param name - Metric name (e.g. "agent_token_usage")
   * @param labels - Dimensional labels (e.g. { agent_role: "writer", tier: "pro" })
   */
  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const key = buildKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
  }

  /**
   * Record a value in a histogram (or create the histogram if it doesn't exist).
   *
   * @param name - Metric name (e.g. "agent_execution_duration_ms")
   * @param value - Observed value to record
   * @param labels - Dimensional labels (e.g. { agent_role: "research", tier: "turbo" })
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const key = buildKey(name, labels);
    const values = this.histograms.get(key);
    if (values) {
      values.push(value);
    } else {
      this.histograms.set(key, [value]);
    }
  }

  /**
   * Returns a point-in-time snapshot of all metrics for health endpoint consumption.
   */
  getSnapshot(): MetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const [key, value] of this.counters) {
      counters[key] = value;
    }

    const histograms: Record<string, HistogramSummary> = {};
    for (const [key, values] of this.histograms) {
      if (values.length === 0) {
        histograms[key] = { count: 0, sum: 0, min: 0, max: 0, avg: 0 };
        continue;
      }
      const count = values.length;
      const sum = values.reduce((acc, v) => acc + v, 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = sum / count;
      histograms[key] = { count, sum, min, max, avg };
    }

    return {
      counters,
      histograms,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resets all metrics. Useful for testing.
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

/** Global metrics collector instance for the agent framework. */
export const metricsCollector = new MetricsCollector();
