/**
 * Token exchange route — pure business logic.
 *
 * Implements the core logic for POST /auth/exchange as a pure function that
 * takes in-memory state and returns a new state + response. This design makes
 * the handler fully testable without HTTP infrastructure.
 *
 * Requirements: 1.1, 1.2, 1.3, 6.2, 6.3, 6.4, 11.8, 11.10
 */

import { FirebaseClaims } from '../auth/firebaseVerifier';
import { ExchangeResponse } from '../types/index';
import { ErrorCode } from '../types/index';
import { AppError } from '../errors/AppError';
import {
  upsertUser,
} from '../services/userService';
import {
  buildAccessContext,
  FullDatabaseState,
  UserSessionRecord,
} from '../services/accessContextService';

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

/**
 * In-memory rate limiter state.
 * Maps a string key (e.g. IP address or firebase_uid) to an array of
 * request timestamps (milliseconds since epoch).
 */
export interface RateLimiterState {
  requests: Map<string, number[]>;
}

/**
 * Create an empty rate limiter state.
 */
export function createRateLimiterState(): RateLimiterState {
  return { requests: new Map() };
}

/**
 * Check whether a request from `key` is allowed under the rate limit.
 *
 * This is a pure function: it takes the current state and returns a new state
 * plus an `allowed` flag. The caller is responsible for persisting the new
 * state.
 *
 * Algorithm:
 * 1. Retrieve the list of timestamps for `key`.
 * 2. Filter out timestamps older than `now - windowMs` (sliding window).
 * 3. If the remaining count >= `limit`, the request is denied.
 * 4. Otherwise, append `now` to the list and allow the request.
 *
 * Requirements: 11.8, 11.10
 *
 * @param state     - Current rate limiter state.
 * @param key       - Identifier for the rate-limited entity (e.g. IP or UID).
 * @param limit     - Maximum number of requests allowed in the window.
 * @param windowMs  - Duration of the sliding window in milliseconds.
 * @param now       - Current timestamp in milliseconds (injectable for testing).
 * @returns New rate limiter state and whether the request is allowed.
 */
export function checkRateLimit(
  state: RateLimiterState,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { allowed: boolean; state: RateLimiterState } {
  const windowStart = now - windowMs;

  // Get existing timestamps for this key, filtering out expired ones
  const existing = state.requests.get(key) ?? [];
  const withinWindow = existing.filter((ts) => ts > windowStart);

  if (withinWindow.length >= limit) {
    // Limit exceeded — return updated state (with expired entries pruned) but deny
    const newRequests = new Map(state.requests);
    newRequests.set(key, withinWindow);
    return { allowed: false, state: { requests: newRequests } };
  }

  // Allow — record this request timestamp
  const newTimestamps = [...withinWindow, now];
  const newRequests = new Map(state.requests);
  newRequests.set(key, newTimestamps);
  return { allowed: true, state: { requests: newRequests } };
}

// ---------------------------------------------------------------------------
// Token exchange result
// ---------------------------------------------------------------------------

/**
 * Result of a token exchange operation.
 */
export interface TokenExchangeResult {
  /** Updated database state after the exchange. */
  state: FullDatabaseState;
  /** The Access Context to return to the client. */
  response: ExchangeResponse;
}

// ---------------------------------------------------------------------------
// Helper: generate a simple UUID-like ID
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// processTokenExchange
// ---------------------------------------------------------------------------

/**
 * Core business logic for POST /auth/exchange.
 *
 * This is a pure function: it takes the current in-memory database state and
 * already-verified Firebase claims, and returns a new state plus the Access
 * Context response. No HTTP, no side effects.
 *
 * Steps:
 * 1. Upsert the user record (create or update via `upsertUser`).
 * 2. Upsert the session record for (user_id, device_id):
 *    - If an existing session exists for this device, update `last_seen_at`
 *      and ensure `session_state` is "active".
 *    - Otherwise, create a new session with `session_state="active"`.
 * 3. Build and return the Access Context via `buildAccessContext`.
 *
 * Requirements: 1.1, 1.2, 1.3, 6.2, 6.3, 6.4
 *
 * @param state    - Current in-memory full database state.
 * @param claims   - Already-verified Firebase claims from the ID token.
 * @param deviceId - Unique identifier for the client device.
 * @returns New database state and the Access Context response.
 */
export function processTokenExchange(
  state: FullDatabaseState,
  claims: FirebaseClaims,
  deviceId: string,
): TokenExchangeResult {
  const now = new Date().toISOString();

  // Step 1: Upsert user (create or update).
  // upsertUser returns a DatabaseState (base fields only), so we merge the
  // result back into the FullDatabaseState to preserve the extra tables
  // (roles, permissions, userRoles, rolePermissions, sessions).
  const { state: baseStateAfterUser, user } = upsertUser(state, claims);
  const stateAfterUser: FullDatabaseState = {
    ...state,
    users: baseStateAfterUser.users,
    entitlements: baseStateAfterUser.entitlements,
    auditLogs: baseStateAfterUser.auditLogs,
  };

  // Step 2: Upsert session for (user_id, device_id)
  const existingSessionIndex = stateAfterUser.sessions.findIndex(
    (s) => s.user_id === user.id && s.device_id === deviceId,
  );

  let sessionId: string;
  let updatedSessions: UserSessionRecord[];

  if (existingSessionIndex !== -1) {
    // Update existing session: refresh last_seen_at and ensure active state
    const existingSession = stateAfterUser.sessions[existingSessionIndex];
    sessionId = existingSession.id;

    const updatedSession: UserSessionRecord = {
      ...existingSession,
      session_state: 'active',
      last_seen_at: now,
      // Clear revoked_at if the session was previously revoked (re-activation)
      revoked_at: null,
    };

    updatedSessions = [...stateAfterUser.sessions];
    updatedSessions[existingSessionIndex] = updatedSession;
  } else {
    // Create new session
    sessionId = generateId();

    const newSession: UserSessionRecord = {
      id: sessionId,
      user_id: user.id,
      device_id: deviceId,
      session_state: 'active',
      last_seen_at: now,
      revoked_at: null,
      created_at: now,
    };

    updatedSessions = [...stateAfterUser.sessions, newSession];
  }

  const stateAfterSession: FullDatabaseState = {
    ...stateAfterUser,
    sessions: updatedSessions,
  };

  // Step 3: Build Access Context
  const response = buildAccessContext(stateAfterSession, user.id, sessionId);

  return {
    state: stateAfterSession,
    response,
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factory (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible POST /auth/exchange handler.
 *
 * This thin wrapper delegates to `processTokenExchange` and handles HTTP
 * concerns (request parsing, response serialization, error mapping).
 *
 * The handler is intentionally kept thin — all business logic lives in
 * `processTokenExchange` for testability.
 *
 * @param getState   - Function to retrieve the current in-memory state.
 * @param setState   - Function to persist the updated state.
 * @param verifyToken - Function to verify a Firebase ID token and return claims.
 * @param rateLimiter - Mutable rate limiter state container.
 * @param rateLimitConfig - Rate limit configuration.
 */
export function createTokenExchangeHandler(
  getState: () => FullDatabaseState,
  setState: (state: FullDatabaseState) => void,
  verifyToken: (token: string) => Promise<FirebaseClaims>,
  rateLimiter: { state: RateLimiterState },
  rateLimitConfig: { limit: number; windowMs: number } = { limit: 10, windowMs: 60_000 },
) {
  return async (req: { body: { firebaseIdToken?: string; deviceId?: string } }, res: {
    status: (code: number) => { json: (body: unknown) => void };
    json: (body: unknown) => void;
  }) => {
    const { firebaseIdToken, deviceId } = req.body;

    if (!firebaseIdToken || !deviceId) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'firebaseIdToken and deviceId are required',
          trace_id: generateId(),
        },
      });
      return;
    }

    // Apply rate limiting keyed by deviceId
    const { allowed, state: newRateLimiterState } = checkRateLimit(
      rateLimiter.state,
      deviceId,
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
      const claims = await verifyToken(firebaseIdToken);
      const { state: newState, response } = processTokenExchange(
        getState(),
        claims,
        deviceId,
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
