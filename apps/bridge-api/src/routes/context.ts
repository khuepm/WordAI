/**
 * Auth context route — pure business logic.
 *
 * Implements the core logic for GET /auth/context as a pure function that
 * takes in-memory state and returns the Access Context. This design makes
 * the handler fully testable without HTTP infrastructure.
 *
 * Authorization Source of Truth (Requirements 8.6, 8.7, 8.8):
 * - The Bridge API NEVER trusts role, permission, or quota data provided by
 *   the Client_App in request bodies or headers.
 * - All authorization data is retrieved from the in-memory state (which
 *   mirrors Directus) on every request.
 * - GET /auth/context always fetches fresh data — no caching.
 *
 * Requirements: 8.6, 8.7, 8.8
 */

import { ErrorCode, ExchangeResponse } from '../types/index';
import { AppError } from '../errors/AppError';
import {
  buildAccessContext,
  FullDatabaseState,
} from '../services/accessContextService';
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
// processGetContext
// ---------------------------------------------------------------------------

/**
 * Core business logic for GET /auth/context.
 *
 * Retrieves a fresh Access Context from the in-memory state (Directus source
 * of truth) for the authenticated user and session. No caching is applied —
 * every call reads the current state.
 *
 * Authorization Source of Truth enforcement (Req 8.6, 8.7):
 * - The userId and sessionId parameters come from the authenticated session
 *   (e.g. a verified session token), NOT from the request body or query params.
 * - The caller MUST NOT pass client-provided role, permission, or quota data
 *   into this function. All such data is derived from `state` (Directus).
 *
 * Steps:
 * 1. Validate that userId and sessionId are present.
 * 2. Verify the session exists and is not revoked.
 * 3. Build and return the Access Context from the current state.
 *
 * Requirements: 8.6, 8.7, 8.8
 *
 * @param state     - Current in-memory full database state (Directus source of truth).
 * @param userId    - The authenticated user's UUID (from session, NOT from client body).
 * @param sessionId - The authenticated session's UUID (from session, NOT from client body).
 * @returns Fresh Access Context built entirely from Directus state.
 * @throws AppError(AUTH_REQUIRED, 401) if userId or sessionId is missing.
 * @throws AppError(SESSION_REVOKED, 403) if the session has been revoked.
 */
export function processGetContext(
  state: FullDatabaseState,
  userId: string,
  sessionId: string,
): ExchangeResponse {
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

  // Step 3: Build and return the Access Context from the current state.
  // All authorization data (roles, permissions, quota) comes from `state`
  // (the Directus source of truth), never from client-provided data.
  // Requirements 8.6, 8.7: Bridge API never trusts client-provided auth data.
  return buildAccessContext(state, userId, sessionId);
}

// ---------------------------------------------------------------------------
// HTTP handler factory (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible GET /auth/context handler.
 *
 * This thin wrapper delegates to `processGetContext` and handles HTTP concerns
 * (request parsing, response serialization, error mapping).
 *
 * The handler is intentionally kept thin — all business logic lives in
 * `processGetContext` for testability.
 *
 * Authorization Source of Truth (Req 8.6, 8.7):
 * - The handler extracts userId and sessionId from the authenticated session
 *   (via `getUserId` and `getSessionId` callbacks), NOT from req.body or
 *   req.query. This ensures the Bridge API never trusts client-provided
 *   authorization data.
 * - No caching headers are set — every response is fresh from Directus.
 *
 * @param getState    - Function to retrieve the current in-memory state.
 * @param getUserId   - Function to extract the authenticated user ID from the request.
 * @param getSessionId - Function to extract the authenticated session ID from the request.
 */
export function createGetContextHandler(
  getState: () => FullDatabaseState,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
  getSessionId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: { headers: Record<string, string | undefined> },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
      setHeader?: (name: string, value: string) => void;
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
      const context = processGetContext(getState(), userId, sessionId);

      // Explicitly disable caching — always return fresh data (Req 8.8)
      if (res.setHeader) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }

      res.json(context);
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
