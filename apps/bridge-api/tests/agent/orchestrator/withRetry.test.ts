/**
 * Unit tests for withRetry() utility — exponential backoff retry logic.
 *
 * Tests cover:
 * - Successful execution without retries
 * - Exponential backoff on recoverable errors
 * - Rate-limit handling with and without retry_after_ms
 * - Context-too-long with summarization callback
 * - CONTEXT_REDUCTION_FAILED after exhaustion
 * - Non-recoverable errors throw immediately
 * - Retry exhaustion throws last error
 *
 * Requirements: 1.10, 1.11, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry, RetryOptions } from '../../../src/agent/orchestrator/withRetry';
import { AgentError } from '../../../src/agent/errors/AgentError';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** No-op sleep for fast tests. */
const noSleep = vi.fn().mockResolvedValue(undefined);

/** Creates a function that fails N times then succeeds. */
function failThenSucceed<T>(
  failures: AgentError[],
  successValue: T,
): () => Promise<T> {
  let callCount = 0;
  return async () => {
    if (callCount < failures.length) {
      const error = failures[callCount];
      callCount++;
      throw error;
    }
    callCount++;
    return successValue;
  };
}

/** Creates a PROVIDER_UNAVAILABLE error. */
function providerUnavailableError(agentId?: string, taskId?: string): AgentError {
  return new AgentError('PROVIDER_UNAVAILABLE', 'Provider is down', agentId, taskId, true);
}

/** Creates a RATE_LIMITED error with optional retry_after_ms in message. */
function rateLimitedError(retryAfterMs?: number): AgentError {
  const message = retryAfterMs
    ? `Rate limited. retry_after_ms: ${retryAfterMs}`
    : 'Rate limited. Please try again later.';
  return new AgentError('RATE_LIMITED', message, undefined, undefined, true);
}

/** Creates a RATE_LIMITED error with retry_after_ms as a property. */
function rateLimitedErrorWithProperty(retryAfterMs: number): AgentError & { retry_after_ms: number } {
  const error = new AgentError('RATE_LIMITED', 'Rate limited', undefined, undefined, true);
  (error as AgentError & { retry_after_ms: number }).retry_after_ms = retryAfterMs;
  return error as AgentError & { retry_after_ms: number };
}

/** Creates a CONTEXT_TOO_LONG error. */
function contextTooLongError(agentId?: string, taskId?: string): AgentError {
  return new AgentError('CONTEXT_TOO_LONG', 'Context exceeds max length', agentId, taskId, true);
}

/** Creates a non-recoverable INVALID_REQUEST error. */
function invalidRequestError(): AgentError {
  return new AgentError('INVALID_REQUEST', 'Bad request', undefined, undefined, false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  describe('successful execution', () => {
    it('should return result on first attempt success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { sleep: noSleep });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should return result after recoverable failures', async () => {
      const fn = failThenSucceed(
        [providerUnavailableError(), providerUnavailableError()],
        'recovered',
      );

      const result = await withRetry(fn, { sleep: noSleep });

      expect(result).toBe('recovered');
    });
  });

  describe('exponential backoff', () => {
    it('should apply exponential backoff delays (1s, 2s, 4s)', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed(
        [providerUnavailableError(), providerUnavailableError(), providerUnavailableError()],
        'ok',
      );

      await withRetry(fn, { sleep: sleepFn, baseDelayMs: 1000, maxDelayMs: 8000 });

      expect(sleepFn).toHaveBeenCalledTimes(3);
      expect(sleepFn).toHaveBeenNthCalledWith(1, 1000); // 1000 * 2^0
      expect(sleepFn).toHaveBeenNthCalledWith(2, 2000); // 1000 * 2^1
      expect(sleepFn).toHaveBeenNthCalledWith(3, 4000); // 1000 * 2^2
    });

    it('should cap delay at maxDelayMs', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed(
        [providerUnavailableError(), providerUnavailableError(), providerUnavailableError()],
        'ok',
      );

      await withRetry(fn, { sleep: sleepFn, baseDelayMs: 4000, maxDelayMs: 8000 });

      expect(sleepFn).toHaveBeenNthCalledWith(1, 4000); // 4000 * 2^0 = 4000
      expect(sleepFn).toHaveBeenNthCalledWith(2, 8000); // 4000 * 2^1 = 8000
      expect(sleepFn).toHaveBeenNthCalledWith(3, 8000); // 4000 * 2^2 = 16000, capped at 8000
    });
  });

  describe('rate-limit handling', () => {
    it('should wait for retry_after_ms from error message', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed([rateLimitedError(3000)], 'ok');

      await withRetry(fn, { sleep: sleepFn });

      expect(sleepFn).toHaveBeenCalledWith(3000);
    });

    it('should wait for retry_after_ms from error property', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed([rateLimitedErrorWithProperty(2500)], 'ok');

      await withRetry(fn, { sleep: sleepFn });

      expect(sleepFn).toHaveBeenCalledWith(2500);
    });

    it('should cap retry_after_ms at 60 seconds', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed([rateLimitedErrorWithProperty(120_000)], 'ok');

      await withRetry(fn, { sleep: sleepFn });

      expect(sleepFn).toHaveBeenCalledWith(60_000);
    });

    it('should wait 5s when no retry_after_ms is provided', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed([rateLimitedError()], 'ok');

      await withRetry(fn, { sleep: sleepFn });

      expect(sleepFn).toHaveBeenCalledWith(5000);
    });
  });

  describe('context-too-long handling', () => {
    it('should call onContextTooLong callback and retry', async () => {
      const onContextTooLong = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed([contextTooLongError()], 'summarized');

      const result = await withRetry(fn, { sleep: noSleep, onContextTooLong });

      expect(result).toBe('summarized');
      expect(onContextTooLong).toHaveBeenCalledTimes(1);
    });

    it('should retry context summarization up to 2 times', async () => {
      const onContextTooLong = vi.fn().mockResolvedValue(undefined);
      const fn = failThenSucceed(
        [contextTooLongError(), contextTooLongError()],
        'reduced',
      );

      const result = await withRetry(fn, { sleep: noSleep, onContextTooLong });

      expect(result).toBe('reduced');
      expect(onContextTooLong).toHaveBeenCalledTimes(2);
    });

    it('should throw CONTEXT_REDUCTION_FAILED after 2 context retries exhausted', async () => {
      const onContextTooLong = vi.fn().mockResolvedValue(undefined);
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw contextTooLongError('agent-1', 'task-1');
      };

      await expect(
        withRetry(fn, { sleep: noSleep, onContextTooLong }),
      ).rejects.toMatchObject({
        error_code: 'CONTEXT_REDUCTION_FAILED',
        agent_id: 'agent-1',
        task_id: 'task-1',
        recoverable: false,
      });

      // 1 initial + 2 context retries = 3 calls to onContextTooLong before the 3rd triggers failure
      expect(onContextTooLong).toHaveBeenCalledTimes(2);
    });

    it('should work without onContextTooLong callback (still retries)', async () => {
      const fn = failThenSucceed([contextTooLongError()], 'ok');

      const result = await withRetry(fn, { sleep: noSleep });

      expect(result).toBe('ok');
    });
  });

  describe('non-recoverable errors', () => {
    it('should throw immediately on INVALID_REQUEST', async () => {
      const fn = vi.fn().mockRejectedValue(invalidRequestError());

      await expect(withRetry(fn, { sleep: noSleep })).rejects.toMatchObject({
        error_code: 'INVALID_REQUEST',
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw immediately on PROVIDER_ERROR', async () => {
      const error = new AgentError('PROVIDER_ERROR', 'Internal error', undefined, undefined, false);
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { sleep: noSleep })).rejects.toMatchObject({
        error_code: 'PROVIDER_ERROR',
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should re-throw non-AgentError errors without retrying', async () => {
      const error = new Error('unexpected');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { sleep: noSleep })).rejects.toBe(error);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry exhaustion', () => {
    it('should throw last error after maxRetries exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(providerUnavailableError('agent-x', 'task-y'));

      await expect(
        withRetry(fn, { sleep: noSleep, maxRetries: 3 }),
      ).rejects.toMatchObject({
        error_code: 'PROVIDER_UNAVAILABLE',
        agent_id: 'agent-x',
        task_id: 'task-y',
      });

      // 1 initial + 3 retries = 4 total attempts
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should respect custom maxRetries', async () => {
      const fn = vi.fn().mockRejectedValue(providerUnavailableError());

      await expect(
        withRetry(fn, { sleep: noSleep, maxRetries: 1 }),
      ).rejects.toMatchObject({
        error_code: 'PROVIDER_UNAVAILABLE',
      });

      // 1 initial + 1 retry = 2 total attempts
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('mixed error scenarios', () => {
    it('should handle rate-limit then provider-unavailable then success', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const errors = [rateLimitedError(2000), providerUnavailableError()];
      const fn = failThenSucceed(errors, 'mixed-recovery');

      const result = await withRetry(fn, { sleep: sleepFn });

      expect(result).toBe('mixed-recovery');
      // First: rate-limit wait of 2000ms, Second: backoff of 1000 * 2^1 = 2000ms
      expect(sleepFn).toHaveBeenNthCalledWith(1, 2000);
      expect(sleepFn).toHaveBeenNthCalledWith(2, 2000);
    });

    it('should handle context-too-long followed by provider-unavailable', async () => {
      const sleepFn = vi.fn().mockResolvedValue(undefined);
      const onContextTooLong = vi.fn().mockResolvedValue(undefined);
      const errors = [contextTooLongError(), providerUnavailableError()];
      const fn = failThenSucceed(errors, 'ok');

      const result = await withRetry(fn, { sleep: sleepFn, onContextTooLong });

      expect(result).toBe('ok');
      expect(onContextTooLong).toHaveBeenCalledTimes(1);
    });
  });
});
