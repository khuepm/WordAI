/**
 * AI entitlement route — pure business logic.
 *
 * Implements the core logic for GET /ai/entitlement as a pure function that
 * takes in-memory state and returns the user's current AI entitlement and
 * quota status. This design makes the handler fully testable without HTTP
 * infrastructure.
 *
 * Requirements: 5.1, 5.2
 */

import { ErrorCode, UserEntitlement } from '../types/index';
import { AppError } from '../errors/AppError';
import { FullDatabaseState } from '../services/accessContextService';
import { isSessionRevoked } from '../services/sessionService';

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
// processGetEntitlement
// ---------------------------------------------------------------------------

/**
 * Core business logic for GET /ai/entitlement.
 *
 * Retrieves the current AI entitlement and quota status for the authenticated
 * user. Includes a computed `remaining_quota` field (monthly_quota - used_quota).
 *
 * Steps:
 * 1. Validate that userId and sessionId are present.
 * 2. Verify the session exists and is not revoked.
 * 3. Find the user's entitlement record in state.entitlements.
 * 4. Return a UserEntitlement object with remaining_quota computed.
 *
 * Requirements: 5.1, 5.2
 *
 * @param state     - Current in-memory full database state.
 * @param userId    - The authenticated user's UUID (from session, NOT from client body).
 * @param sessionId - The authenticated session's UUID (from session, NOT from client body).
 * @returns UserEntitlement object with computed remaining_quota field.
 * @throws AppError(AUTH_REQUIRED, 401) if userId or sessionId is missing.
 * @throws AppError(AUTH_REQUIRED, 401) if the session is not found.
 * @throws AppError(SESSION_REVOKED, 403) if the session has been revoked.
 * @throws AppError(AUTH_REQUIRED, 401) if no entitlement record is found for the user.
 */
export function processGetEntitlement(
  state: FullDatabaseState,
  userId: string,
  sessionId: string,
): UserEntitlement {
  // Step 1: Validate that userId and sessionId are present
  if (!userId || userId.trim() === '') {
    throw new AppError(
      ErrorCode.AUTH_REQUIRED,
      'Authentication is required',
      401,
    );
  }

  if (!sessionId || sessionId.trim() === '') {
    throw new AppError(
      ErrorCode.AUTH_REQUIRED,
      'Authentication is required',
      401,
    );
  }

  // Step 2: Verify the session exists and is not revoked
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new AppError(
      ErrorCode.AUTH_REQUIRED,
      'Authentication is required',
      401,
    );
  }

  if (isSessionRevoked(state, sessionId)) {
    throw new AppError(
      ErrorCode.SESSION_REVOKED,
      'This session has been revoked',
      403,
    );
  }

  // Step 3: Find the user's entitlement record
  const entitlement = state.entitlements.find((e) => e.user_id === userId);
  if (!entitlement) {
    throw new AppError(
      ErrorCode.AUTH_REQUIRED,
      'Authentication is required',
      401,
    );
  }

  // Step 4: Return UserEntitlement with computed remaining_quota
  return {
    ai_enabled: entitlement.ai_enabled,
    plan_code: entitlement.plan_code,
    monthly_quota: entitlement.monthly_quota,
    used_quota: entitlement.used_quota,
    remaining_quota: entitlement.monthly_quota - entitlement.used_quota,
    quota_reset_at: entitlement.quota_reset_at,
    allowed_models: entitlement.allowed_models,
    max_requests_per_minute: entitlement.max_requests_per_minute,
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factory (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible GET /ai/entitlement handler.
 *
 * This thin wrapper delegates to `processGetEntitlement` and handles HTTP
 * concerns (request parsing, response serialization, error mapping).
 *
 * The handler is intentionally kept thin — all business logic lives in
 * `processGetEntitlement` for testability.
 *
 * @param getState    - Function to retrieve the current in-memory state.
 * @param getUserId   - Function to extract the authenticated user ID from the request.
 * @param getSessionId - Function to extract the authenticated session ID from the request.
 */
export function createGetEntitlementHandler(
  getState: () => FullDatabaseState,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
  getSessionId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: { headers: Record<string, string | undefined> },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ) => {
    const userId = getUserId(req);
    const sessionId = getSessionId(req);

    if (!userId || !sessionId) {
      res.status(401).json({
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: 'Authentication is required',
          trace_id: generateId(),
        },
      });
      return;
    }

    try {
      const entitlement = processGetEntitlement(getState(), userId, sessionId);
      res.json(entitlement);
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
