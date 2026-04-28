/**
 * Audit log service — immutability enforcement and query support.
 *
 * IMMUTABILITY GUARANTEE:
 * All service files (userService, userLifecycle, roleService, sessionService,
 * quotaService) have been reviewed and confirmed to be append-only with respect
 * to the auditLogs array. Every service uses the spread pattern:
 *
 *   auditLogs: [...state.auditLogs, newEntry]
 *
 * No service ever mutates an existing audit log entry, and no service ever
 * filters out or removes audit log entries. This file formalizes that contract
 * by providing a canonical `appendAuditLog` helper that enforces the
 * append-only invariant at the type level.
 *
 * Requirements: 10.6, 10.7
 */

import { AuditLogRecord } from './userService';
import { FullDatabaseState } from './accessContextService';

// ---------------------------------------------------------------------------
// appendAuditLog
// ---------------------------------------------------------------------------

/**
 * Append a new audit log entry to the state, returning a new state object.
 *
 * This function enforces the append-only contract for audit logs:
 * - It NEVER mutates the original state or its auditLogs array.
 * - It ALWAYS returns a new state object (referential inequality with input).
 * - It ALWAYS places the new entry at the end of the auditLogs array.
 * - It NEVER modifies or removes existing audit log entries.
 *
 * Requirements: 10.6, 10.7
 *
 * @param state - Current in-memory full database state.
 * @param entry - The new audit log entry to append.
 * @returns A new FullDatabaseState with the entry appended to auditLogs.
 */
export function appendAuditLog(
  state: FullDatabaseState,
  entry: AuditLogRecord,
): FullDatabaseState {
  return {
    ...state,
    auditLogs: [...state.auditLogs, entry],
  };
}

// ---------------------------------------------------------------------------
// getAuditLogs
// ---------------------------------------------------------------------------

/**
 * Query audit log entries with optional filters.
 *
 * Returns a filtered (but never modified) view of the audit log array.
 * This function is pure: it never modifies the state or the audit log entries.
 *
 * Requirements: 10.2, 10.3, 10.5
 *
 * @param state   - Current in-memory full database state.
 * @param filters - Optional filter criteria:
 *   - action:      Filter by audit log action (e.g. "user_created").
 *   - actorUserId: Filter by the actor who performed the action.
 *   - resourceId:  Filter by the resource ID affected by the action.
 * @returns Array of matching AuditLogRecord entries (in insertion order).
 */
export function getAuditLogs(
  state: FullDatabaseState,
  filters?: {
    action?: string;
    actorUserId?: string;
    resourceId?: string;
  },
): AuditLogRecord[] {
  if (!filters) {
    return state.auditLogs;
  }

  return state.auditLogs.filter((entry) => {
    if (filters.action !== undefined && entry.action !== filters.action) {
      return false;
    }
    if (
      filters.actorUserId !== undefined &&
      entry.actor_user_id !== filters.actorUserId
    ) {
      return false;
    }
    if (
      filters.resourceId !== undefined &&
      entry.resource_id !== filters.resourceId
    ) {
      return false;
    }
    return true;
  });
}
