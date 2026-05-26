/**
 * Property-based tests for CircuitBreaker activation.
 *
 * Property 10: Circuit Breaker Activation
 *   Validates: Requirements 8.10
 *
 * Verifies that exactly `failureThreshold` consecutive failures within
 * `windowMs` triggers the unhealthy state, fewer failures do NOT trigger it,
 * and failures outside the window reset the counter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CircuitBreaker } from '../../../src/agent/errors/CircuitBreaker';

// ---------------------------------------------------------------------------
// Timer setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a failure threshold between 1 and 10.
 */
const failureThresholdArb = fc.integer({ min: 1, max: 10 });

/**
 * Generates a random provider ID (alphanumeric with hyphens, 1-64 chars).
 */
const providerIdArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,30}$/)
  .filter((s) => s.length >= 1);

// ---------------------------------------------------------------------------
// Property 10: Circuit Breaker Activation
// Validates: Requirements 8.10
// ---------------------------------------------------------------------------

describe('Property 10: Circuit Breaker Activation', () => {
  /**
   * **Validates: Requirements 8.10**
   *
   * For any failureThreshold N and any provider ID, recording exactly N
   * consecutive failures within the time window SHALL mark the provider
   * as unhealthy.
   */
  it('exactly failureThreshold consecutive failures within window triggers unhealthy state', () => {
    fc.assert(
      fc.property(failureThresholdArb, providerIdArb, (threshold, providerId) => {
        const cb = new CircuitBreaker({
          failureThreshold: threshold,
          windowMs: 60_000,
          cooldownMs: 30_000,
        });

        // Record exactly `threshold` failures within the window
        for (let i = 0; i < threshold; i++) {
          cb.recordFailure(providerId);
        }

        // Provider should now be unhealthy
        expect(cb.isHealthy(providerId)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * For any failureThreshold N > 1 and any provider ID, recording fewer
   * than N consecutive failures within the time window SHALL NOT mark the
   * provider as unhealthy.
   */
  it('fewer than failureThreshold failures does NOT trigger unhealthy state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        providerIdArb,
        (threshold, providerId) => {
          const cb = new CircuitBreaker({
            failureThreshold: threshold,
            windowMs: 60_000,
            cooldownMs: 30_000,
          });

          // Record fewer than threshold failures (threshold - 1)
          for (let i = 0; i < threshold - 1; i++) {
            cb.recordFailure(providerId);
          }

          // Provider should still be healthy
          expect(cb.isHealthy(providerId)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * For any failureThreshold N and any provider ID, if failures occur
   * outside the time window (older than windowMs), the counter resets
   * and the provider remains healthy even after N total failures spread
   * across windows.
   */
  it('failures outside the window reset the counter and do not trigger unhealthy state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        providerIdArb,
        (threshold, providerId) => {
          const windowMs = 60_000;
          const cb = new CircuitBreaker({
            failureThreshold: threshold,
            windowMs,
            cooldownMs: 30_000,
          });

          // Record (threshold - 1) failures in the first window
          for (let i = 0; i < threshold - 1; i++) {
            cb.recordFailure(providerId);
          }

          // Advance time past the window so the counter resets
          vi.advanceTimersByTime(windowMs + 1);

          // Record 1 more failure — this starts a new window with count=1
          cb.recordFailure(providerId);

          // Total failures across windows = threshold, but only 1 in current window
          // Provider should still be healthy
          expect(cb.isHealthy(providerId)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * For any failureThreshold N and any provider ID, failures that span
   * across the window boundary (some inside, some outside) should only
   * count the ones within the current window toward the threshold.
   */
  it('only failures within the current window count toward the threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        providerIdArb,
        fc.integer({ min: 1, max: 5 }),
        (threshold, providerId, failuresBeforeReset) => {
          const windowMs = 60_000;
          const actualBefore = Math.min(failuresBeforeReset, threshold - 1);
          const cb = new CircuitBreaker({
            failureThreshold: threshold,
            windowMs,
            cooldownMs: 30_000,
          });

          // Record some failures in the first window
          for (let i = 0; i < actualBefore; i++) {
            cb.recordFailure(providerId);
          }

          // Advance past the window
          vi.advanceTimersByTime(windowMs + 1);

          // Now record exactly (threshold - 1) failures in the new window
          for (let i = 0; i < threshold - 1; i++) {
            cb.recordFailure(providerId);
          }

          // Should still be healthy (only threshold-1 in current window)
          expect(cb.isHealthy(providerId)).toBe(true);

          // One more failure in the current window should trip it
          cb.recordFailure(providerId);
          expect(cb.isHealthy(providerId)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
