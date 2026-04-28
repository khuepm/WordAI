/**
 * User lifecycle state machine service — in-memory model.
 *
 * Implements the user status state machine and status change operations for
 * the Bridge API using an in-memory database state. This design allows the
 * core business logic to be tested without a real database connection.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10,
 *               3.11, 3.12, 3.13, 3.14
 */

import { UserStatus } from '../types/index';
import { AuditLogRecord, UserRecord } from './userService';
import { FullDatabaseState } from './accessContextService';

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
// Allowed status transitions
// ---------------------------------------------------------------------------

/**
 * The set of allowed status transitions in the user lifecycle state machine.
 *
 * Allowed:
 *   pending  → active
 *   active   → suspended
 *   active   → deleted
 *   suspended → active
 *   suspended → deleted
 *
 * Denied (all others, including):
 *   deleted  → any
 *   pending  → suspended
 *   pending  → deleted
 *
 * Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 */
const ALLOWED_TRANSITIONS: ReadonlySet<string> = new Set([
  'pending→active',
  'active→suspended',
  'active→deleted',
  'suspended→active',
  'suspended→deleted',
]);

// ---------------------------------------------------------------------------
// validateStatusTransition
// ---------------------------------------------------------------------------

/**
 * Determine whether a status transition from `from` to `to` is permitted by
 * the user lifecycle state machine.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
 *
 * @param from - Current user status.
 * @param to   - Desired new user status.
 * @returns `true` if the transition is allowed; `false` otherwise.
 */
export function validateStatusTransition(
  from: UserStatus,
  to: UserStatus,
): boolean {
  // A transition to the same status is never a valid lifecycle change.
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS.has(`${from}→${to}`);
}

// ---------------------------------------------------------------------------
// canCreateSession
// ---------------------------------------------------------------------------

/**
 * Determine whether a new session may be created for a user with the given
 * status.
 *
 * Session creation is prevented for suspended and deleted users.
 *
 * Requirements: 3.14
 *
 * @param userStatus - Current status of the user.
 * @returns `true` if a new session may be created; `false` otherwise.
 */
export function canCreateSession(userStatus: UserStatus): boolean {
  return userStatus !== 'suspended' && userStatus !== 'deleted';
}

// ---------------------------------------------------------------------------
// changeUserStatus
// ---------------------------------------------------------------------------

/**
 * Change a user's status in the in-memory database state.
 *
 * Steps:
 * 1. Find the user record by userId.
 * 2. Validate the transition using `validateStatusTransition`.
 * 3. Update the user record with the new status (soft delete when
 *    transitioning to "deleted" — the record is retained).
 * 4. Create an audit_log entry with action "user_status_changed",
 *    recording actor_user_id, before_data, and after_data.
 * 5. Return the updated state.
 *
 * Requirements: 3.11, 3.12, 3.13, 3.14
 *
 * @param state     - Current in-memory full database state.
 * @param actorId   - ID of the user performing the action (null for system).
 * @param userId    - ID of the user whose status is being changed.
 * @param newStatus - The desired new status.
 * @returns Updated FullDatabaseState with the new user status and audit log.
 * @throws Error if the user is not found or the transition is invalid.
 */
export function changeUserStatus(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  newStatus: UserStatus,
): FullDatabaseState {
  const now = new Date().toISOString();

  // Step 1: Find the user record
  const userIndex = state.users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    throw new Error(`User not found: ${userId}`);
  }

  const existingUser = state.users[userIndex];

  // Step 2: Validate the transition
  if (!validateStatusTransition(existingUser.status, newStatus)) {
    throw new Error(
      `Invalid status transition: ${existingUser.status} → ${newStatus}`,
    );
  }

  // Step 3: Update the user record (soft delete when newStatus === 'deleted')
  const updatedUser: UserRecord = {
    ...existingUser,
    status: newStatus,
    updated_at: now,
  };

  const updatedUsers = [...state.users];
  updatedUsers[userIndex] = updatedUser;

  // Step 4: Create audit log entry
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'user_status_changed',
    resource: 'user',
    resource_id: userId,
    before_data: existingUser,
    after_data: updatedUser,
    created_at: now,
  };

  // Step 5: Return updated state
  return {
    ...state,
    users: updatedUsers,
    auditLogs: [...state.auditLogs, auditLog],
  };
}
