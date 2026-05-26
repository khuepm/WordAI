/**
 * AuraSphere Agent Framework — Retry Logic with Exponential Backoff
 *
 * Provides a generic retry wrapper for LLM provider calls with:
 * - Exponential backoff (1s, 2s, 4s, capped at 8s)
 * - Rate-limit retry-after handling (capped at 60s)
 * - Context-too-long summarization retries (up to 2 times)
 * - Non-recoverable error fast-fail
 *
 * Requirements: 1.10, 1.11, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 *
 * @module agent/orchestrator/withRetry
 */

import { AgentError, isRecoverable } from '../errors/AgentError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the retry utility.
 */
export interface RetryOptions {
  /** Maximum number of retries (default: 3). */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000). */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 8000). */
  maxDelayMs: number;
  /**
   * Optional callback invoked when a CONTEXT_TOO_LONG error occurs.
   * Should perform context summarization/reduction.
   * Called up to 2 times before the error is treated as non-recoverable.
   */
  onContextTooLong?: () => Promise<void>;
  /**
   * Optional sleep function for testing (defaults to real setTimeout-based sleep).
   */
  sleep?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum wait time for rate-limit retry-after (60 seconds). */
const MAX_RATE_LIMIT_WAIT_MS = 60_000;

/** Default wait time for rate-limit without retry-after (5 seconds). */
const DEFAULT_RATE_LIMIT_WAIT_MS = 5_000;

/** Maximum number of context summarization retries. */
const MAX_CONTEXT_RETRIES = 2;

// ---------------------------------------------------------------------------
// Default sleep implementation
// ---------------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Retry utility
// ---------------------------------------------------------------------------

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * Behavior:
 * - On recoverable errors (PROVIDER_UNAVAILABLE, RATE_LIMITED, CONTEXT_TOO_LONG):
 *   retries up to maxRetries times with exponential backoff.
 * - On RATE_LIMITED with retry_after_ms: waits for that duration (capped at 60s).
 * - On RATE_LIMITED without retry_after_ms: waits 5s.
 * - On CONTEXT_TOO_LONG: calls onContextTooLong callback (if provided) up to 2 times,
 *   then throws CONTEXT_REDUCTION_FAILED if still failing.
 * - On non-recoverable errors: throws immediately without retrying.
 * - After all retries exhausted: throws the last error.
 *
 * @param fn - The async function to execute with retry logic
 * @param options - Retry configuration options
 * @returns The result of the function on success
 * @throws AgentError on non-recoverable failure or retry exhaustion
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 8000,
    onContextTooLong,
    sleep = defaultSleep,
  } = options;

  let lastError: AgentError | undefined;
  let contextRetryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      // Ensure we're dealing with an AgentError
      if (!(error instanceof AgentError)) {
        throw error;
      }

      lastError = error;

      // Non-recoverable errors: throw immediately
      if (!isRecoverable(error.error_code)) {
        throw error;
      }

      // If this was the last attempt, break out to throw
      if (attempt >= maxRetries) {
        break;
      }

      // Handle CONTEXT_TOO_LONG with summarization
      if (error.error_code === 'CONTEXT_TOO_LONG') {
        contextRetryCount++;

        if (contextRetryCount > MAX_CONTEXT_RETRIES) {
          // Context reduction exhausted — throw CONTEXT_REDUCTION_FAILED
          throw new AgentError(
            'CONTEXT_REDUCTION_FAILED',
            'Context summarization retries exhausted; context still exceeds provider max_context_length',
            error.agent_id,
            error.task_id,
            false, // non-recoverable
          );
        }

        // Call the summarization callback if provided
        if (onContextTooLong) {
          await onContextTooLong();
        }

        // Retry immediately after summarization (no backoff needed)
        continue;
      }

      // Handle RATE_LIMITED with retry-after or default wait
      if (error.error_code === 'RATE_LIMITED') {
        const retryAfterMs = extractRetryAfterMs(error);

        if (retryAfterMs !== undefined) {
          // Wait for the specified duration, capped at 60s
          const waitMs = Math.min(retryAfterMs, MAX_RATE_LIMIT_WAIT_MS);
          await sleep(waitMs);
        } else {
          // No retry-after specified: wait 5s
          await sleep(DEFAULT_RATE_LIMIT_WAIT_MS);
        }

        continue;
      }

      // Handle PROVIDER_UNAVAILABLE and other recoverable errors with exponential backoff
      const delayMs = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
      await sleep(delayMs);
    }
  }

  // All retries exhausted — throw the last error
  throw lastError!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates exponential backoff delay for a given attempt.
 *
 * Formula: min(baseDelayMs * 2^attempt, maxDelayMs)
 * Attempt 0 → baseDelayMs (1s)
 * Attempt 1 → baseDelayMs * 2 (2s)
 * Attempt 2 → baseDelayMs * 4 (4s)
 * Capped at maxDelayMs (8s)
 */
function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Extracts retry_after_ms from an AgentError's message if encoded there,
 * or from a known property pattern.
 *
 * The retry_after_ms may be embedded in the error message as a JSON-like
 * field or passed via a custom property on the error.
 */
function extractRetryAfterMs(error: AgentError): number | undefined {
  // Check if the error has a retry_after_ms property (duck-typing for LLMProviderError-like errors)
  const errorWithRetry = error as AgentError & { retry_after_ms?: number };
  if (
    typeof errorWithRetry.retry_after_ms === 'number' &&
    errorWithRetry.retry_after_ms > 0
  ) {
    return errorWithRetry.retry_after_ms;
  }

  // Try to extract from the error message (format: "...retry_after_ms:NNNN...")
  const match = error.message.match(/retry_after_ms[:\s]+(\d+)/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}
