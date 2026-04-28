/**
 * Property-based tests for audit log immutability, completeness, and ordering.
 *
 * Property 31: Audit Log Immutability
 *   Validates: Requirements 10.6
 *   For any audit_log entry, once created, it SHALL never be modified or deleted.
 *
 * Property 32: Audit Completeness
 *   Validates: Requirements 10.2, 10.3
 *   For any sensitive action defined in the action taxonomy, a corresponding
 *   audit_log entry SHALL exist.
 *
 * Property 33: Audit Temporal Ordering
 *   Validates: Requirements 10.5
 *   For any sequence of related actions, the audit_log entries SHALL have
 *   created_at timestamps in the same order as the actions occurred.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { upsertUser } from '../../src/services/userService';
import { changeUserStatus } from '../../src/services/userLifecycle';
import {
  assignRole,
  removeRole,
  updateRolePermissions,
} from '../../src/services/roleService';
import { revokeSession } from '../../src/services/sessionService';
import {
  appendAuditLog,
  getAuditLogs,
} from '../../src/services/auditLogService';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import {
  UserRecord,
  EntitlementRecord,
  AuditLogRecord,
  createEmptyState,
} from '../../src/services/userService';
import { FirebaseClaims } from '../../src/auth/firebaseVerifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with a single active user, entitlement, session,
 * and optionally roles and permissions.
 */
function buildBaseState(
  userId: string,
  sessionId: string,
  deviceId: string,
  availableRoleCodes: string[] = [],
  availablePermCodes: string[] = [],
): FullDatabaseState {
  const now = new Date().toISOString();

  const user: UserRecord = {
    id: userId,
    firebase_uid: `uid-${userId}`,
    email: `user-${userId}@example.com`,
    display_name: 'Test User',
    avatar_url: null,
    status: 'active',
    risk_level: 'low',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  const entitlement: EntitlementRecord = {
    id: `ent-${userId}`,
    user_id: userId,
    ai_enabled: true,
    plan_code: 'free',
    monthly_quota: 100,
    used_quota: 0,
    quota_reset_at: now,
    allowed_models: ['gpt-3.5-turbo'],
    max_requests_per_minute: 10,
  };

  const session: UserSessionRecord = {
    id: sessionId,
    user_id: userId,
    device_id: deviceId,
    session_state: 'active',
    last_seen_at: now,
    revoked_at: null,
    created_at: now,
  };

  const state = createFullEmptyState();
  return {
    ...state,
    users: [user],
    entitlements: [entitlement],
    sessions: [session],
    roles: availableRoleCodes.map((rc) => ({
      role_code: rc,
      description: `Role ${rc}`,
    })),
    permissions: availablePermCodes.map((pc) => ({
      permission_code: pc,
      description: `Permission ${pc}`,
    })),
    userRoles: [],
    rolePermissions: [],
  };
}

/**
 * Build a FullDatabaseState with a pending user (for status change tests).
 */
function buildStateWithPendingUser(userId: string): FullDatabaseState {
  const now = new Date().toISOString();

  const user: UserRecord = {
    id: userId,
    firebase_uid: `uid-${userId}`,
    email: `user-${userId}@example.com`,
    display_name: 'Test User',
    avatar_url: null,
    status: 'pending',
    risk_level: 'low',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  return {
    ...createFullEmptyState(),
    users: [user],
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Prototype-polluting keys that must be excluded from string generators. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string safe to use as a role/permission code. */
const codeArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

/** A list of 1–5 distinct permission codes. */
const permCodesArb = fc.uniqueArray(codeArb, { minLength: 1, maxLength: 5 });

/** A valid FirebaseClaims object for upsertUser tests. */
const firebaseClaimsArb: fc.Arbitrary<FirebaseClaims> = fc.record({
  firebase_uid: fc.uuid(),
  email: fc.emailAddress(),
  display_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  avatar_url: fc.option(fc.webUrl(), { nil: null }),
});

// ---------------------------------------------------------------------------
// Property 31: Audit Log Immutability
// Validates: Requirements 10.6
// ---------------------------------------------------------------------------

describe('Property 31: Audit Log Immutability', () => {
  /**
   * **Validates: Requirements 10.6**
   *
   * appendAuditLog never mutates the original state — the original auditLogs
   * array is unchanged after the call.
   */
  it('appendAuditLog does not mutate the original state', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId);
          const originalAuditLogs = state.auditLogs;
          const originalLength = originalAuditLogs.length;

          const entry: AuditLogRecord = {
            id: crypto.randomUUID(),
            actor_user_id: actorId,
            action: 'user_created',
            resource: 'user',
            resource_id: userId,
            before_data: null,
            after_data: null,
            created_at: new Date().toISOString(),
          };

          appendAuditLog(state, entry);

          // Original state's auditLogs array must be unchanged
          expect(state.auditLogs).toBe(originalAuditLogs);
          expect(state.auditLogs.length).toBe(originalLength);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.6**
   *
   * After any sequence of service operations, the count of audit logs only
   * ever increases — never decreases.
   */
  it('audit log count only ever increases after service operations', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          const counts: number[] = [state.auditLogs.length];

          // status change: pending user → active
          const pendingState = buildStateWithPendingUser(userId);
          let s = { ...pendingState };
          s = changeUserStatus(s, null, userId, 'active');
          counts.push(s.auditLogs.length);

          // role assignment
          state = assignRole(state, null, userId, roleCode);
          counts.push(state.auditLogs.length);

          // permission update
          state = updateRolePermissions(state, null, roleCode, permCodes);
          counts.push(state.auditLogs.length);

          // role removal
          state = removeRole(state, null, userId, roleCode);
          counts.push(state.auditLogs.length);

          // session revocation
          state = revokeSession(state, null, sessionId);
          counts.push(state.auditLogs.length);

          // Verify counts are non-decreasing
          for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.6**
   *
   * Existing audit log entries are never modified after being appended —
   * their id, action, created_at, before_data, after_data remain unchanged.
   */
  it('existing audit log entries are never modified after being appended', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Append first entry via assignRole
          state = assignRole(state, null, userId, roleCode);
          const firstEntry = { ...state.auditLogs[state.auditLogs.length - 1] };

          // Perform more operations
          state = removeRole(state, null, userId, roleCode);
          state = revokeSession(state, null, sessionId);

          // The first entry must be unchanged
          const firstEntryAfter = state.auditLogs.find(
            (l) => l.id === firstEntry.id,
          );
          expect(firstEntryAfter).toBeDefined();
          expect(firstEntryAfter!.id).toBe(firstEntry.id);
          expect(firstEntryAfter!.action).toBe(firstEntry.action);
          expect(firstEntryAfter!.created_at).toBe(firstEntry.created_at);
          expect(firstEntryAfter!.before_data).toBe(firstEntry.before_data);
          expect(firstEntryAfter!.after_data).toBe(firstEntry.after_data);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.6**
   *
   * appendAuditLog always returns a new state object (referential inequality
   * with the input state).
   */
  it('appendAuditLog always returns a new state object', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId);

          const entry: AuditLogRecord = {
            id: crypto.randomUUID(),
            actor_user_id: actorId,
            action: 'user_created',
            resource: 'user',
            resource_id: userId,
            before_data: null,
            after_data: null,
            created_at: new Date().toISOString(),
          };

          const newState = appendAuditLog(state, entry);

          // Must be a different object reference
          expect(newState).not.toBe(state);
          // The new state's auditLogs must also be a different array
          expect(newState.auditLogs).not.toBe(state.auditLogs);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 32: Audit Completeness
// Validates: Requirements 10.2, 10.3
// ---------------------------------------------------------------------------

describe('Property 32: Audit Completeness', () => {
  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * upsertUser (new user) always creates exactly one audit log with action
   * "user_created".
   */
  it('upsertUser (new user) creates exactly one audit log with action "user_created"', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, (claims) => {
        const emptyState = createEmptyState();

        const countBefore = emptyState.auditLogs.filter(
          (l) => l.action === 'user_created',
        ).length;

        const result = upsertUser(emptyState, claims);

        const countAfter = result.state.auditLogs.filter(
          (l) => l.action === 'user_created',
        ).length;

        expect(result.isNew).toBe(true);
        expect(countAfter).toBe(countBefore + 1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * changeUserStatus always creates exactly one audit log with action
   * "user_status_changed" per call.
   */
  it('changeUserStatus creates exactly one audit log with action "user_status_changed" per call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, actorId) => {
          const state = buildStateWithPendingUser(userId);

          const countBefore = state.auditLogs.filter(
            (l) => l.action === 'user_status_changed',
          ).length;

          const newState = changeUserStatus(state, actorId, userId, 'active');

          const countAfter = newState.auditLogs.filter(
            (l) => l.action === 'user_status_changed',
          ).length;

          expect(countAfter).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * assignRole always creates exactly one audit log with action "role_assigned"
   * per call.
   */
  it('assignRole creates exactly one audit log with action "role_assigned" per call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          const countBefore = state.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;

          const newState = assignRole(state, actorId, userId, roleCode);

          const countAfter = newState.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;

          expect(countAfter).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * removeRole always creates exactly one audit log with action "role_removed"
   * per call.
   */
  it('removeRole creates exactly one audit log with action "role_removed" per call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          state = assignRole(state, null, userId, roleCode);

          const countBefore = state.auditLogs.filter(
            (l) => l.action === 'role_removed',
          ).length;

          const newState = removeRole(state, actorId, userId, roleCode);

          const countAfter = newState.auditLogs.filter(
            (l) => l.action === 'role_removed',
          ).length;

          expect(countAfter).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * updateRolePermissions always creates exactly one audit log with action
   * "permission_changed" per call.
   */
  it('updateRolePermissions creates exactly one audit log with action "permission_changed" per call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, permCodes, actorId) => {
          const state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          const countBefore = state.auditLogs.filter(
            (l) => l.action === 'permission_changed',
          ).length;

          const newState = updateRolePermissions(
            state,
            actorId,
            roleCode,
            permCodes,
          );

          const countAfter = newState.auditLogs.filter(
            (l) => l.action === 'permission_changed',
          ).length;

          expect(countAfter).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * revokeSession always creates exactly one audit log with action
   * "session_revoked" per call.
   */
  it('revokeSession creates exactly one audit log with action "session_revoked" per call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId);

          const countBefore = state.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          const newState = revokeSession(state, actorId, sessionId);

          const countAfter = newState.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          expect(countAfter).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * A sequence of N sensitive operations produces exactly N audit log entries
   * (one per operation).
   */
  it('a sequence of N sensitive operations produces exactly N audit log entries', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          const initialCount = state.auditLogs.length;
          let operationCount = 0;

          // Operation 1: assignRole
          state = assignRole(state, null, userId, roleCode);
          operationCount++;
          expect(state.auditLogs.length).toBe(initialCount + operationCount);

          // Operation 2: updateRolePermissions
          state = updateRolePermissions(state, null, roleCode, permCodes);
          operationCount++;
          expect(state.auditLogs.length).toBe(initialCount + operationCount);

          // Operation 3: removeRole
          state = removeRole(state, null, userId, roleCode);
          operationCount++;
          expect(state.auditLogs.length).toBe(initialCount + operationCount);

          // Operation 4: revokeSession
          state = revokeSession(state, null, sessionId);
          operationCount++;
          expect(state.auditLogs.length).toBe(initialCount + operationCount);

          // Total: exactly 4 new audit log entries
          expect(state.auditLogs.length - initialCount).toBe(4);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 33: Audit Temporal Ordering
// Validates: Requirements 10.5
// ---------------------------------------------------------------------------

describe('Property 33: Audit Temporal Ordering', () => {
  /**
   * **Validates: Requirements 10.5**
   *
   * For any sequence of operations, the created_at timestamps in auditLogs
   * are non-decreasing (each entry's timestamp is >= the previous entry's
   * timestamp).
   */
  it('audit log created_at timestamps are non-decreasing across a sequence of operations', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          state = assignRole(state, null, userId, roleCode);
          state = updateRolePermissions(state, null, roleCode, permCodes);
          state = removeRole(state, null, userId, roleCode);
          state = revokeSession(state, null, sessionId);

          // Verify timestamps are non-decreasing
          for (let i = 1; i < state.auditLogs.length; i++) {
            const prev = new Date(state.auditLogs[i - 1].created_at).getTime();
            const curr = new Date(state.auditLogs[i].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * The order of audit log entries in the array matches the order in which
   * operations were performed — the most recently appended entry is last.
   */
  it('audit log entries appear in the same order as operations were performed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          const initialCount = state.auditLogs.length;

          // Perform operations in a known order
          state = assignRole(state, null, userId, roleCode);
          state = updateRolePermissions(state, null, roleCode, permCodes);
          state = removeRole(state, null, userId, roleCode);
          state = revokeSession(state, null, sessionId);

          // The new entries must appear in the order the operations were performed
          const newEntries = state.auditLogs.slice(initialCount);
          expect(newEntries.length).toBe(4);
          expect(newEntries[0].action).toBe('role_assigned');
          expect(newEntries[1].action).toBe('permission_changed');
          expect(newEntries[2].action).toBe('role_removed');
          expect(newEntries[3].action).toBe('session_revoked');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * appendAuditLog always places the new entry at the end of the array.
   */
  it('appendAuditLog always places the new entry at the end of the array', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        fc.integer({ min: 0, max: 5 }),
        (userId, sessionId, deviceId, actorId, existingCount) => {
          let state = buildBaseState(userId, sessionId, deviceId);

          // Pre-populate with some entries
          for (let i = 0; i < existingCount; i++) {
            const existingEntry: AuditLogRecord = {
              id: crypto.randomUUID(),
              actor_user_id: null,
              action: `existing_action_${i}`,
              resource: 'user',
              resource_id: userId,
              before_data: null,
              after_data: null,
              created_at: new Date().toISOString(),
            };
            state = appendAuditLog(state, existingEntry);
          }

          const newEntry: AuditLogRecord = {
            id: crypto.randomUUID(),
            actor_user_id: actorId,
            action: 'new_action',
            resource: 'user',
            resource_id: userId,
            before_data: null,
            after_data: null,
            created_at: new Date().toISOString(),
          };

          const newState = appendAuditLog(state, newEntry);

          // The new entry must be the last element
          const lastEntry = newState.auditLogs[newState.auditLogs.length - 1];
          expect(lastEntry.id).toBe(newEntry.id);
          expect(lastEntry.action).toBe('new_action');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * After a sequence of operations, the audit log entries appear in the same
   * order as the operations were performed (verified by checking action
   * sequence matches operation sequence).
   */
  it('action sequence in audit log matches the sequence of operations performed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          const initialCount = state.auditLogs.length;

          // Perform operations and record the expected action sequence
          const expectedActions: string[] = [];

          state = assignRole(state, null, userId, roleCode);
          expectedActions.push('role_assigned');

          state = updateRolePermissions(state, null, roleCode, permCodes);
          expectedActions.push('permission_changed');

          state = removeRole(state, null, userId, roleCode);
          expectedActions.push('role_removed');

          state = revokeSession(state, null, sessionId);
          expectedActions.push('session_revoked');

          // Extract the actions from the new audit log entries
          const actualActions = state.auditLogs
            .slice(initialCount)
            .map((l) => l.action);

          expect(actualActions).toEqual(expectedActions);
        },
      ),
      { numRuns: 100 },
    );
  });
});
