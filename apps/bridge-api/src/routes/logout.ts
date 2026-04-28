/**
 * Logout route — pure business logic.
 *
 * Implements the core logic for POST /auth/logout as a pure function that
 * takes in-memory state and returns a new state + response. This design makes
 * the handler fully testable without HTTP infrastructure.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.6, 15.3
 */

import { ErrorCode, LogoutRequest, LogoutResponse } from '../types/index';
import { AppError } from '../errors/AppError';
import { FullDatabaseState } from '../services/accessContextService';
import { isSessionRevoked, revokeSession } from '../services/sessionService';

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
// processLogout
// ---------------------------------------------------------------------------

/**
 * Result of a logout operation.
 */
export interface LogoutResult {
  /** Updated database state after the logout. */
  state: FullDatabaseState;
  /** The response to return to the client. */
  response: LogoutResponse;
}

/**
 * Core business logic for POST /auth/logout.
 *
 * Revokes the specified session. If the session is already revoked, returns
 * idempotent success with the existing revoked_at timestamp. Creates an
 * audit_log entry with action "session_revoked" only when the session
 * transitions from active to revoked (not on repeat calls).
 *
 * Steps:
 * 1. Validate that sessionId is present.
 * 2. Find the session record.
 * 3. If the session is already revoked, return idempotent success.
 * 4. Otherwise, revoke the session (sets revoked_at, session_state="revoked")
 *    and create an audit_log entry.
 * 5. Return the updated state and response.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.6, 15.3
 *
 * @param state   - Current in-memory full database state.
 * @param actorId - ID of the user performing the logout (null for system).
 * @param request - The logout request body containing sessionId.
 * @returns New database state and the logout response.
 * @throws AppError if sessionId is missing or the session is not found.
 */
export function processLogout(
  state: FullDatabaseState,
  actorId: string | null,
  request: LogoutRequest,
): LogoutResult {
  const { sessionId } = request;

  // Step 1: Validate sessionId is present
  if (!sessionId || sessionId.trim() === '') {
    throw new AppError(
      ErrorCode.AUTH_REQUIRED,
      'sessionId is required',
      400,
    );
  }

  // Step 2: Find the session record
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new AppError(
      ErrorCode.SESSION_REVOKED,
      'Session not found',
      404,
    );
  }

  // Step 3: Idempotent — if already revoked, return success without re-revoking
  if (isSessionRevoked(state, sessionId)) {
    const revokedAt = session.revoked_at ?? new Date().toISOString();
    return {
      state,
      response: {
        revoked: true,
        revoked_at: revokedAt,
      },
    };
  }

  // Step 4: Revoke the session (creates audit log entry internally)
  const newState = revokeSession(state, actorId, sessionId);

  // Retrieve the revoked_at timestamp from the updated session record
  const revokedSession = newState.sessions.find((s) => s.id === sessionId);
  const revokedAt = revokedSession?.revoked_at ?? new Date().toISOString();

  // Step 5: Return updated state and response
  return {
    state: newState,
    response: {
      revoked: true,
      revoked_at: revokedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factory (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible POST /auth/logout handler.
 *
 * This thin wrapper delegates to `processLogout` and handles HTTP concerns
 * (request parsing, response serialization, error mapping).
 *
 * The handler is intentionally kept thin — all business logic lives in
 * `processLogout` for testability.
 *
 * @param getState  - Function to retrieve the current in-memory state.
 * @param setState  - Function to persist the updated state.
 * @param getActorId - Function to extract the authenticated user ID from the request.
 */
export function createLogoutHandler(
  getState: () => FullDatabaseState,
  setState: (state: FullDatabaseState) => void,
  getActorId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: {
      body: LogoutRequest;
      headers: Record<string, string | undefined>;
    },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ) => {
    const actorId = getActorId(req);

    try {
      const { state: newState, response } = processLogout(
        getState(),
        actorId,
        req.body,
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
