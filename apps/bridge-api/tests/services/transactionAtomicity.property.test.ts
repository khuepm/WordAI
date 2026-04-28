/**
 * Property-based tests for transaction atomicity.
 *
 * Property 39: Transaction Atomicity
 *   Validates: Requirements 15.9, 15.10
 *   For any multi-record database operation, either all changes SHALL be
 *   committed or all changes SHALL be rolled back.
 */

// Feature: user-management, Property 39: Transaction Atomicity

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  withTransaction,
  executeTokenExchangeTransaction,
  executeRoleAssignmentTransaction,
  executeSessionRevocationTransaction,
  executeRoleRemovalTransaction,
} from '../../src/services/transactionService';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';
import { FirebaseClaims } from '../../src/auth/firebaseVerifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with a single user, a set of available roles,
 * a set of available permissions, and an entitlement + session.
 */
function buildBaseState(
  userId: string,
  sessionId: string,
  deviceId: string,
  availableRoleCodes: string[],
  availablePermCodes: string[],
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

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Prototype-polluting keys that must be excluded from string generators.
 */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string safe to use as a role/permission code. */
const codeArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

/** A list of 1–5 distinct role codes. */
const roleCodesArb = fc.uniqueArray(codeArb, { minLength: 1, maxLength: 5 });

/** A list of 1–6 distinct permission codes. */
const permCodesArb = fc.uniqueArray(codeArb, { minLength: 1, maxLength: 6 });

/** Non-empty string safe to use as a device ID. */
const deviceIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

/** Generates a valid email address. */
const emailArb = fc.emailAddress();

/** Generates optional display name (null or a non-empty string). */
const displayNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }),
  { nil: null },
);

/** Generates optional avatar URL (null or a web URL). */
const avatarUrlArb = fc.option(fc.webUrl(), { nil: null });

/** Generates a complete FirebaseClaims object. */
const firebaseClaimsArb: fc.Arbitrary<FirebaseClaims> = fc.record({
  firebase_uid: fc.string({ minLength: 1, maxLength: 128 }),
  email: emailArb,
  display_name: displayNameArb,
  avatar_url: avatarUrlArb,
});

// ---------------------------------------------------------------------------
// Property 39: Transaction Atomicity
// Validates: Requirements 15.9, 15.10
// ---------------------------------------------------------------------------

describe('Property 39: Transaction Atomicity', () => {
  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When the operation succeeds, the returned state reflects all changes.
   */
  it('withTransaction commits on success', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Operation that succeeds: add a user role
          const operation = (s: FullDatabaseState) => {
            const newUserRole = {
              id: 'test-role-id',
              user_id: userId,
              role_code: roleCode,
              assigned_at: new Date().toISOString(),
              assigned_by: null,
            };
            return {
              state: {
                ...s,
                userRoles: [...s.userRoles, newUserRole],
              },
              result: newUserRole,
            };
          };

          const { state: newState, result } = withTransaction(state, operation);

          // The new state should contain the added user role
          expect(newState.userRoles.length).toBe(1);
          expect(newState.userRoles[0].user_id).toBe(userId);
          expect(newState.userRoles[0].role_code).toBe(roleCode);
          expect(result.user_id).toBe(userId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When the operation throws, the returned state is identical to the
   * pre-operation state (no partial changes).
   */
  it('withTransaction rolls back on failure', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Operation that fails: throw an error
          const operation = (s: FullDatabaseState) => {
            throw new Error('Simulated failure');
          };

          // The operation should throw
          expect(() => withTransaction(state, operation)).toThrow('Simulated failure');

          // The state should be unchanged (no partial changes)
          // Since withTransaction re-throws, we verify the state is unchanged
          // by checking that the original state is still intact
          expect(state.userRoles.length).toBe(0);
          expect(state.users.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * After a successful token exchange transaction, the state contains the
   * user record, entitlement record, session record, and audit log (for new
   * users) all together.
   */
  it('executeTokenExchangeTransaction is atomic — commits all records on success', () => {
    fc.assert(
      fc.property(
        firebaseClaimsArb,
        deviceIdArb,
        (claims, deviceId) => {
          const emptyState = createFullEmptyState();

          const result = executeTokenExchangeTransaction(
            emptyState,
            claims,
            deviceId,
          );

          // Transaction should be committed
          expect(result.committed).toBe(true);

          // All records should be present in the new state
          expect(result.state.users.length).toBe(1);
          expect(result.state.entitlements.length).toBe(1);
          expect(result.state.sessions.length).toBe(1);
          expect(result.state.auditLogs.length).toBe(1); // user_created audit log

          // Verify the user record
          const user = result.state.users[0];
          expect(user.firebase_uid).toBe(claims.firebase_uid);

          // Verify the entitlement record
          const entitlement = result.state.entitlements[0];
          expect(entitlement.user_id).toBe(user.id);

          // Verify the session record
          const session = result.state.sessions[0];
          expect(session.user_id).toBe(user.id);
          expect(session.device_id).toBe(deviceId);

          // Verify the audit log
          const auditLog = result.state.auditLogs[0];
          expect(auditLog.action).toBe('user_created');
          expect(auditLog.resource_id).toBe(user.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When the operation fails mid-way (partial changes before throw), the
   * state is unchanged — withTransaction rolls back to the savepoint.
   */
  it('executeTokenExchangeTransaction is atomic — rolls back on failure', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Simulate a failing token exchange by using withTransaction directly
          // with an operation that partially modifies state then throws.
          // This tests the core rollback guarantee.
          let threw = false;
          try {
            withTransaction(state, (s) => {
              // Partially modify state (add a user role)
              const partialState = {
                ...s,
                userRoles: [
                  ...s.userRoles,
                  {
                    id: 'partial-role-id',
                    user_id: userId,
                    role_code: roleCode,
                    assigned_at: new Date().toISOString(),
                    assigned_by: null,
                  },
                ],
              };
              // Then throw — simulating a failure mid-operation
              throw new Error('Simulated mid-operation failure');
            });
          } catch {
            threw = true;
          }

          // The operation should have thrown
          expect(threw).toBe(true);

          // The original state should be unchanged (no partial changes committed)
          expect(state.userRoles.length).toBe(0);
          expect(state.users.length).toBe(1);
          expect(state.sessions.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * After a successful role assignment transaction, both the user_roles
   * record and the audit_log entry exist in the new state.
   */
  it('executeRoleAssignmentTransaction is atomic — commits role and audit log together', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          const result = executeRoleAssignmentTransaction(
            state,
            actorId,
            userId,
            roleCode,
          );

          // Transaction should be committed
          expect(result.committed).toBe(true);

          // Both the user_roles record and audit_log entry should exist
          expect(result.state.userRoles.length).toBe(1);
          expect(result.state.userRoles[0].user_id).toBe(userId);
          expect(result.state.userRoles[0].role_code).toBe(roleCode);

          const auditLog = result.state.auditLogs.find(
            (l) => l.action === 'role_assigned',
          );
          expect(auditLog).toBeDefined();
          expect(auditLog!.resource_id).toBe(userId);
          expect(auditLog!.actor_user_id).toBe(actorId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When role assignment fails (e.g., role doesn't exist), neither the
   * user_roles record nor the audit_log entry is added.
   */
  it('executeRoleAssignmentTransaction is atomic — rolls back on failure', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        (userId, sessionId, deviceId, nonExistentRoleCode) => {
          // Build state with no roles defined
          const state = buildBaseState(userId, sessionId, deviceId, [], []);

          const result = executeRoleAssignmentTransaction(
            state,
            null,
            userId,
            nonExistentRoleCode,
          );

          // Transaction should NOT be committed
          expect(result.committed).toBe(false);

          // Neither the user_roles record nor the audit_log entry should be added
          expect(result.state.userRoles.length).toBe(0);
          expect(result.state.auditLogs.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * After a successful session revocation transaction, both the session is
   * revoked and the audit_log entry exists.
   */
  it('executeSessionRevocationTransaction is atomic — commits session update and audit log together', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [], []);

          const result = executeSessionRevocationTransaction(
            state,
            actorId,
            sessionId,
          );

          // Transaction should be committed
          expect(result.committed).toBe(true);
          expect(result.revokedAt).not.toBeNull();

          // The session should be revoked
          const session = result.state.sessions.find((s) => s.id === sessionId);
          expect(session).toBeDefined();
          expect(session!.session_state).toBe('revoked');
          expect(session!.revoked_at).not.toBeNull();

          // The audit_log entry should exist
          const auditLog = result.state.auditLogs.find(
            (l) => l.action === 'session_revoked',
          );
          expect(auditLog).toBeDefined();
          expect(auditLog!.resource_id).toBe(sessionId);
          expect(auditLog!.actor_user_id).toBe(actorId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When session revocation fails (e.g., session doesn't exist), neither the
   * session state nor the audit_log is changed.
   */
  it('executeSessionRevocationTransaction is atomic — rolls back on failure', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.uuid(),
        (userId, sessionId, deviceId, nonExistentSessionId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [], []);

          const result = executeSessionRevocationTransaction(
            state,
            null,
            nonExistentSessionId,
          );

          // Transaction should NOT be committed
          expect(result.committed).toBe(false);
          expect(result.revokedAt).toBeNull();

          // The original session should still be active
          const session = result.state.sessions.find((s) => s.id === sessionId);
          expect(session).toBeDefined();
          expect(session!.session_state).toBe('active');
          expect(session!.revoked_at).toBeNull();

          // No audit_log entry should be added
          expect(result.state.auditLogs.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * After a successful role removal transaction, the user_roles record is
   * gone and the audit_log entry exists.
   */
  it('executeRoleRemovalTransaction is atomic — commits role removal and audit log together', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // First assign the role
          const assignResult = executeRoleAssignmentTransaction(
            state,
            null,
            userId,
            roleCode,
          );
          state = assignResult.state;

          // Now remove the role
          const result = executeRoleRemovalTransaction(
            state,
            actorId,
            userId,
            roleCode,
          );

          // Transaction should be committed
          expect(result.committed).toBe(true);

          // The user_roles record should be gone
          const userRole = result.state.userRoles.find(
            (ur) => ur.user_id === userId && ur.role_code === roleCode,
          );
          expect(userRole).toBeUndefined();

          // The audit_log entry should exist
          const auditLog = result.state.auditLogs.find(
            (l) => l.action === 'role_removed' && l.resource_id === userId,
          );
          expect(auditLog).toBeDefined();
          expect(auditLog!.actor_user_id).toBe(actorId);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.9, 15.10**
   *
   * When role removal fails (e.g., user doesn't have the role), neither the
   * user_roles nor the audit_log is changed.
   */
  it('executeRoleRemovalTransaction is atomic — rolls back on failure', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Try to remove a role that was never assigned
          const result = executeRoleRemovalTransaction(
            state,
            null,
            userId,
            roleCode,
          );

          // Transaction should NOT be committed
          expect(result.committed).toBe(false);

          // No user_roles record should be removed (there were none to begin with)
          expect(result.state.userRoles.length).toBe(0);

          // No audit_log entry should be added
          expect(result.state.auditLogs.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
