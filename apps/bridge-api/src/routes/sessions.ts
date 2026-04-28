/**
 * Session management routes — pure business logic.
 *
 * Implements the core logic for:
 *   GET  /users/me/sessions
 *   POST /users/me/sessions/revoke
 *
 * as pure functions that take in-memory state and return a new state +
 * response. This design makes the handlers fully testable without HTTP
 * infrastructure.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 9.7, 9.8
 */

import { ErrorCode, SessionList, RevokeSessionRequest, RevokeSessionResponse } from '../types/index';
import { AppError } from '../errors/AppError';
import { FullDatabaseState } from '../services/accessContextService';
import {
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
} from '../services/sessionService';

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
// processGetSessions
// ---------------------------------------------------------------------------

/**
 * Core business logic for GET /users/me/sessions.
 *
 * Returns all active sessions for the authenticated user.
 *
 * Requirements: 6.5
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The authenticated user's UUID.
 * @returns SessionList response object.
 */
export function processGetSessions(
  state: FullDatabaseState,
  userId: string,
): SessionList {
  const activeSessions = getActiveSessions(state, userId);

  return {
    sessions: activeSessions.map((s) => ({
      id: s.id,
      device_id: s.device_id,
      session_state: 'active' as const,
      last_seen_at: s.last_seen_at,
      created_at: s.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// processRevokeSession
// ---------------------------------------------------------------------------

/**
 * Result of a session revocation operation.
 */
export interface RevokeSessionResult {
  /** Updated database state after the revocation. */
  state: FullDatabaseState;
  /** The response to return to the client. */
  response: RevokeSessionResponse;
}

/**
 * Core business logic for POST /users/me/sessions/revoke.
 *
 * Supports two modes:
 *   - Revoke a specific session by sessionId.
 *   - Revoke all sessions (revokeAll=true), optionally excluding the current session.
 *
 * Requirements: 6.6, 6.7, 6.8, 6.9, 6.10, 9.7, 9.8
 *
 * @param state            - Current in-memory full database state.
 * @param userId           - The authenticated user's UUID.
 * @param actorId          - The actor performing the revocation (usually same as userId).
 * @param request          - The revocation request body.
 * @param currentSessionId - The current session ID (excluded when revokeAll=true).
 * @returns New database state and the revocation response.
 * @throws AppError if neither sessionId nor revokeAll is provided, or session not found.
 */
export function processRevokeSession(
  state: FullDatabaseState,
  userId: string,
  actorId: string | null,
  request: RevokeSessionRequest,
  currentSessionId?: string,
): RevokeSessionResult {
  const { sessionId, revokeAll } = request;

  if (!sessionId && !revokeAll) {
    throw new AppError(
      ErrorCode.PERMISSION_DENIED,
      'Either sessionId or revokeAll must be provided',
      400,
    );
  }

  let newState = state;
  const revokedIds: string[] = [];

  if (revokeAll) {
    // Revoke all active sessions except the current one
    const activeBefore = getActiveSessions(state, userId);
    const toRevoke = activeBefore.filter((s) => s.id !== currentSessionId);

    newState = revokeAllSessions(state, actorId, userId, currentSessionId);
    revokedIds.push(...toRevoke.map((s) => s.id));
  } else if (sessionId) {
    // Revoke a specific session
    newState = revokeSession(state, actorId, sessionId);
    revokedIds.push(sessionId);
  }

  return {
    state: newState,
    response: {
      revoked_count: revokedIds.length,
      revoked_session_ids: revokedIds,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factories (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible GET /users/me/sessions handler.
 *
 * @param getState  - Function to retrieve the current in-memory state.
 * @param getUserId - Function to extract the authenticated user ID from the request.
 */
export function createGetSessionsHandler(
  getState: () => FullDatabaseState,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: { headers: Record<string, string | undefined> },
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

    try {
      const response = processGetSessions(getState(), userId);
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

/**
 * Create an Express-compatible POST /users/me/sessions/revoke handler.
 *
 * @param getState         - Function to retrieve the current in-memory state.
 * @param setState         - Function to persist the updated state.
 * @param getUserId        - Function to extract the authenticated user ID from the request.
 * @param getCurrentSession - Function to extract the current session ID from the request.
 */
export function createRevokeSessionHandler(
  getState: () => FullDatabaseState,
  setState: (state: FullDatabaseState) => void,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
  getCurrentSession: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: {
      body: RevokeSessionRequest;
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

    const currentSessionId = getCurrentSession(req) ?? undefined;

    try {
      const { state: newState, response } = processRevokeSession(
        getState(),
        userId,
        userId,
        req.body,
        currentSessionId,
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
