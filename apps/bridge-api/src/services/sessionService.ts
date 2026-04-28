/**
 * Session management service — in-memory model.
 *
 * Implements session listing, revocation, and status-check logic for the
 * Bridge API using an in-memory database state. This design allows the core
 * business logic to be tested without a real database connection.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 9.7, 9.8
 */

import { AuditLogRecord } from './userService';
import { FullDatabaseState, UserSessionRecord } from './accessContextService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a simple UUID-like identifier for in-memory records.
 * Uses crypto.randomUUID when available, falls back to a timestamp-based ID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// getActiveSessions
// ---------------------------------------------------------------------------

/**
 * Return all active sessions for a given user.
 *
 * A session is considered active when:
 *   - session_state === 'active'
 *   - revoked_at === null
 *
 * Requirements: 6.5
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The user's UUID.
 * @returns Array of active UserSessionRecord objects for the user.
 */
export function getActiveSessions(
  state: FullDatabaseState,
  userId: string,
): UserSessionRecord[] {
  return state.sessions.filter(
    (s) =>
      s.user_id === userId &&
      s.session_state === 'active' &&
      s.revoked_at === null,
  );
}

// ---------------------------------------------------------------------------
// isSessionRevoked
// ---------------------------------------------------------------------------

/**
 * Determine whether a session has been revoked.
 *
 * Returns true if the session exists and has session_state === 'revoked'
 * OR revoked_at !== null.
 *
 * Used by token exchange to reject revoked sessions with SESSION_REVOKED.
 *
 * Requirements: 6.9
 *
 * @param state     - Current in-memory full database state.
 * @param sessionId - The session's UUID.
 * @returns true if the session is revoked; false if active or not found.
 */
export function isSessionRevoked(
  state: FullDatabaseState,
  sessionId: string,
): boolean {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return false;
  }
  return session.session_state === 'revoked' || session.revoked_at !== null;
}

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------

/**
 * Revoke a single session by ID.
 *
 * Steps:
 * 1. Find the session record by sessionId.
 * 2. Set revoked_at = now() and session_state = 'revoked'.
 * 3. Create an audit_log entry with action 'session_revoked', recording
 *    actor_user_id, before_data (session before revocation), and
 *    after_data (session after revocation).
 * 4. Return the updated state.
 *
 * Requirements: 6.6, 6.7, 6.8, 6.9, 6.10
 *
 * @param state     - Current in-memory full database state.
 * @param actorId   - ID of the user performing the revocation (null for system).
 * @param sessionId - UUID of the session to revoke.
 * @returns Updated FullDatabaseState with the session revoked and audit log entry.
 * @throws Error if the session is not found.
 */
export function revokeSession(
  state: FullDatabaseState,
  actorId: string | null,
  sessionId: string,
): FullDatabaseState {
  const now = new Date().toISOString();

  // Step 1: Find the session record
  const sessionIndex = state.sessions.findIndex((s) => s.id === sessionId);
  if (sessionIndex === -1) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const beforeSession = state.sessions[sessionIndex];

  // Step 2: Set revoked_at and session_state
  const afterSession: UserSessionRecord = {
    ...beforeSession,
    session_state: 'revoked',
    revoked_at: now,
  };

  const updatedSessions = [...state.sessions];
  updatedSessions[sessionIndex] = afterSession;

  // Step 3: Create audit log entry (Req 6.8)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'session_revoked',
    resource: 'user_session',
    resource_id: sessionId,
    before_data: beforeSession,
    after_data: afterSession,
    created_at: now,
  };

  // Step 4: Return updated state
  return {
    ...state,
    sessions: updatedSessions,
    auditLogs: [...state.auditLogs, auditLog],
  };
}

// ---------------------------------------------------------------------------
// revokeAllSessions
// ---------------------------------------------------------------------------

/**
 * Revoke all active sessions for a user, optionally excluding one session.
 *
 * For each active session that is revoked, one audit_log entry is created
 * with action 'session_revoked'.
 *
 * Requirements: 9.7, 9.8
 *
 * @param state           - Current in-memory full database state.
 * @param actorId         - ID of the user performing the revocation (null for system).
 * @param userId          - UUID of the user whose sessions are being revoked.
 * @param exceptSessionId - Optional session ID to exclude from revocation (e.g. current session).
 * @returns Updated FullDatabaseState with all targeted sessions revoked and audit log entries.
 */
export function revokeAllSessions(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  exceptSessionId?: string,
): FullDatabaseState {
  // Collect all active sessions for the user, excluding the optional exception
  const sessionsToRevoke = state.sessions.filter(
    (s) =>
      s.user_id === userId &&
      s.session_state === 'active' &&
      s.revoked_at === null &&
      s.id !== exceptSessionId,
  );

  // Revoke each session one by one, accumulating state changes
  let currentState = state;
  for (const session of sessionsToRevoke) {
    currentState = revokeSession(currentState, actorId, session.id);
  }

  return currentState;
}
