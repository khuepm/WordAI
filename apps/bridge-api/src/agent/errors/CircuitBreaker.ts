/**
 * AuraSphere Agent Framework — Circuit Breaker
 *
 * Tracks LLM provider failures and marks providers as unhealthy after
 * consecutive failures within a time window. Implements a cooldown period
 * before allowing probe requests to re-check provider health.
 *
 * @module agent/errors/CircuitBreaker
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the circuit breaker behavior.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures required to trip the breaker. */
  failureThreshold: number;
  /** Time window (ms) in which failures must occur to count as consecutive. */
  windowMs: number;
  /** Cooldown period (ms) before a probe request is allowed. */
  cooldownMs: number;
}

/** Default circuit breaker configuration. */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs: 60_000,
  cooldownMs: 30_000,
};

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/**
 * Tracks consecutive failure state for a single provider.
 */
interface FailureRecord {
  /** Number of consecutive failures within the current window. */
  count: number;
  /** Timestamp (ms) of the first failure in the current window. */
  firstFailureAt: number;
}

// ---------------------------------------------------------------------------
// CircuitBreaker Class
// ---------------------------------------------------------------------------

/**
 * Circuit breaker for LLM providers.
 *
 * After `failureThreshold` consecutive failures within `windowMs`, the
 * provider is marked unhealthy for `cooldownMs`. Once the cooldown expires,
 * the next call to `isHealthy()` returns true to allow a probe request.
 * If the probe fails (another `recordFailure`), the provider is marked
 * unhealthy again for another cooldown period.
 *
 * Fulfills Requirements 8.10, 8.11, 8.12.
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;

  /** Tracks consecutive failures per provider ID. */
  private failures: Map<string, FailureRecord> = new Map();

  /** Maps provider ID → timestamp (ms) until which the provider is unhealthy. */
  private unhealthyUntil: Map<string, number> = new Map();

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Returns whether the provider is considered healthy.
   *
   * - If the provider has no unhealthy record, returns true.
   * - If the provider is unhealthy and cooldown has NOT expired, returns false.
   * - If the provider is unhealthy and cooldown HAS expired, returns true
   *   (allowing a probe request).
   */
  isHealthy(providerId: string): boolean {
    const until = this.unhealthyUntil.get(providerId);
    if (until === undefined) {
      return true;
    }
    // Cooldown expired — allow probe
    if (Date.now() >= until) {
      return true;
    }
    return false;
  }

  /**
   * Records a failure for the given provider.
   *
   * - If the first failure in the current window is older than `windowMs`,
   *   the window is reset and this failure starts a new window.
   * - If the failure count reaches `failureThreshold` within the window,
   *   the provider is marked unhealthy for `cooldownMs`.
   */
  recordFailure(providerId: string): void {
    const now = Date.now();
    const existing = this.failures.get(providerId);

    if (existing) {
      // If the first failure is outside the window, reset
      if (now - existing.firstFailureAt > this.config.windowMs) {
        this.failures.set(providerId, { count: 1, firstFailureAt: now });
      } else {
        existing.count += 1;
      }
    } else {
      this.failures.set(providerId, { count: 1, firstFailureAt: now });
    }

    const record = this.failures.get(providerId)!;

    // Trip the breaker if threshold reached
    if (record.count >= this.config.failureThreshold) {
      this.unhealthyUntil.set(providerId, now + this.config.cooldownMs);
      // Reset failure count so the next window starts fresh after cooldown
      this.failures.delete(providerId);
    }
  }

  /**
   * Records a successful call for the given provider.
   *
   * Clears the failure count and removes the provider from the unhealthy map.
   */
  recordSuccess(providerId: string): void {
    this.failures.delete(providerId);
    this.unhealthyUntil.delete(providerId);
  }

  /**
   * Resets all circuit breaker state for the given provider.
   */
  reset(providerId: string): void {
    this.failures.delete(providerId);
    this.unhealthyUntil.delete(providerId);
  }
}
