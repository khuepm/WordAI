/**
 * Property-based tests for Retry Bound.
 *
 * Property 3: Retry Bound
 *   Validates: Requirements 8.3
 *
 * Verifies that:
 * - No operation is retried more than 3 times (4 total attempts) with default config
 * - With custom maxRetries (1-10), total attempts = maxRetries + 1
 * - The bound holds for any recoverable error code (PROVIDER_UNAVAILABLE, RATE_LIMITED)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { withRetry } from '../../../src/agent/orchestrator/withRetry';
import { AgentError } from '../../../src/agent/errors/AgentError';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Recoverable error codes that trigger retries (excluding CONTEXT_TOO_LONG which has special handling). */
const recoverableErrorCodeArb = fc.constantFrom(
  'PROVIDER_UNAVAILABLE' as const,
  'RATE_LIMITED' as const,
);

/** No-op sleep to make tests fast. */
const noSleep = async (_ms: number): Promise<void> => {};

// ---------------------------------------------------------------------------
// Property 3: Retry Bound
// Validates: Requirements 8.3
// ---------------------------------------------------------------------------

describe('Property 3: Retry Bound', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any recoverable error code, when the function always throws,
   * the total number of invocations SHALL not exceed 4 (1 original + 3 retries)
   * with the default maxRetries of 3.
   */
  it('total attempts never exceed 4 with default maxRetries (3)', () => {
    fc.assert(
      fc.asyncProperty(recoverableErrorCodeArb, async (errorCode) => {
        let invocationCount = 0;

        const alwaysFails = async (): Promise<string> => {
          invocationCount++;
          throw new AgentError(
            errorCode,
            `Simulated ${errorCode} failure`,
            undefined,
            undefined,
            true,
          );
        };

        try {
          await withRetry(alwaysFails, { sleep: noSleep });
        } catch {
          // Expected to throw after retries exhausted
        }

        // Total attempts = 1 original + 3 retries = 4
        expect(invocationCount).toBe(4);
        expect(invocationCount).toBeLessThanOrEqual(4);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * For any random maxRetries value between 1 and 10, the total number of
   * invocations SHALL equal maxRetries + 1 (1 original + maxRetries retries).
   */
  it('total attempts equal maxRetries + 1 for random maxRetries (1-10)', () => {
    fc.assert(
      fc.asyncProperty(
        recoverableErrorCodeArb,
        fc.integer({ min: 1, max: 10 }),
        async (errorCode, maxRetries) => {
          let invocationCount = 0;

          const alwaysFails = async (): Promise<string> => {
            invocationCount++;
            throw new AgentError(
              errorCode,
              `Simulated ${errorCode} failure`,
              undefined,
              undefined,
              true,
            );
          };

          try {
            await withRetry(alwaysFails, { sleep: noSleep, maxRetries });
          } catch {
            // Expected to throw after retries exhausted
          }

          // Total attempts = 1 original + maxRetries retries
          expect(invocationCount).toBe(maxRetries + 1);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * For any recoverable error code and any maxRetries value, the function
   * SHALL never be invoked more than maxRetries + 1 times, even when
   * the function always throws.
   */
  it('invocation count never exceeds maxRetries + 1 upper bound', () => {
    fc.assert(
      fc.asyncProperty(
        recoverableErrorCodeArb,
        fc.integer({ min: 0, max: 10 }),
        async (errorCode, maxRetries) => {
          let invocationCount = 0;

          const alwaysFails = async (): Promise<string> => {
            invocationCount++;
            throw new AgentError(
              errorCode,
              `Simulated ${errorCode} failure`,
              undefined,
              undefined,
              true,
            );
          };

          try {
            await withRetry(alwaysFails, { sleep: noSleep, maxRetries });
          } catch {
            // Expected to throw after retries exhausted
          }

          expect(invocationCount).toBeLessThanOrEqual(maxRetries + 1);
        },
      ),
      { numRuns: 200 },
    );
  });
});
