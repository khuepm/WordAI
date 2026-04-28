/**
 * AI usage route — pure business logic.
 *
 * Implements the core logic for POST /ai/usage/consume as a pure function that
 * takes in-memory state and returns a new state + response. This design makes
 * the handler fully testable without HTTP infrastructure.
 *
 * Requirements: 5.10, 5.11, 11.9
 */

import { ErrorCode, ConsumeUsageResponse } from '../types/index';
import { AppError } from '../errors/AppError';
import { FullDatabaseState } from '../services/accessContextService';
import { validateAIAccess, consumeQuota } from '../services/quotaService';
import { checkRateLimit, RateLimiterState } from './auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// processConsumeUsage
// ---------------------------------------------------------------------------

/**
 * Result of a quota consumption operation.
 */
export interface ConsumeUsageResult {
  /** Updated database state after the consumption attempt. */
  state: FullDatabaseState;
  /** The response to return to the client. */
  response: ConsumeUsageResponse;
}

/**
 * Core business logic for POST /ai/usage/consume.
 *
 * This is a pure function: it takes the current in-memory database state,
 * the authenticated user ID, and the requested model, and returns a new state
 * plus the consumption response. No HTTP, no side effects.
 *
 * Steps:
 * 1. Validate AI access (status, permission, quota, model).
 * 2. Atomically consume one quota unit.
 * 3. Return the updated quota status.
 *
 * Requirements: 5.10, 5.11
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The authenticated user's UUID.
 * @param model  - The AI model identifier being requested.
 * @returns New database state and the consumption response.
 * @throws AppError with the appropriate error code on validation failure.
 */
export function processConsumeUsage(
  state: FullDatabaseState,
  userId: string,
  model: string,
): ConsumeUsageResult {
  // Step 1: Validate AI access
  const accessResult = validateAIAccess(state, userId, model);

  if (!accessResult.allowed) {
    throw new AppError(accessResult.errorCode, accessResult.errorCode, 403);
  }

  // Step 2: Atomically consume quota
  const { state: newState, consumed, remaining_quota, quota_reset_at } =
    consumeQuota(state, userId);

  if (!consumed) {
    // Race condition: quota was exhausted between validation and consumption
    throw new AppError(
      ErrorCode.AI_QUOTA_EXCEEDED,
      'Monthly AI quota has been exhausted',
      403,
    );
  }

  // Step 3: Return updated quota status
  return {
    state: newState,
    response: {
      consumed: true,
      remaining_quota,
      quota_reset_at,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factory (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible POST /ai/usage/consume handler.
 *
 * This thin wrapper delegates to `processConsumeUsage` and handles HTTP
 * concerns (request parsing, response serialization, error mapping).
 *
 * Rate limiting is applied per user ID (Req 11.9).
 *
 * @param getState         - Function to retrieve the current in-memory state.
 * @param setState         - Function to persist the updated state.
 * @param getUserId        - Function to extract the authenticated user ID from the request.
 * @param rateLimiter      - Mutable rate limiter state container.
 * @param rateLimitConfig  - Rate limit configuration.
 */
export function createConsumeUsageHandler(
  getState: () => FullDatabaseState,
  setState: (state: FullDatabaseState) => void,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
  rateLimiter: { state: RateLimiterState },
  rateLimitConfig: { limit: number; windowMs: number } = { limit: 60, windowMs: 60_000 },
) {
  return async (
    req: {
      body: { model?: string; estimated_tokens?: number };
      headers: Record<string, string | undefined>;
    },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ) => {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: 'Authentication required',
          trace_id: generateId(),
        },
      });
      return;
    }

    const { model } = req.body;

    if (!model) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'model is required',
          trace_id: generateId(),
        },
      });
      return;
    }

    // Apply rate limiting keyed by userId (Req 11.9)
    const { allowed, state: newRateLimiterState } = checkRateLimit(
      rateLimiter.state,
      userId,
      rateLimitConfig.limit,
      rateLimitConfig.windowMs,
      Date.now(),
    );
    rateLimiter.state = newRateLimiterState;

    if (!allowed) {
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests — please try again later',
          trace_id: generateId(),
        },
      });
      return;
    }

    try {
      const { state: newState, response } = processConsumeUsage(
        getState(),
        userId,
        model,
      );
      setState(newState);
      res.json(response);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
            trace_id: generateId(),
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            trace_id: generateId(),
          },
        });
      }
    }
  };
}
