/**
 * Property-based tests for role and permission management.
 *
 * Property 14: Role Assignment Audit Completeness
 *   Validates: Requirements 4.7, 4.9, 10.2
 *   For every role assignment or removal, there SHALL exist a corresponding
 *   audit_log entry with the correct action.
 *
 * Property 15: Multiple Role Support
 *   Validates: Requirements 4.13
 *   A user SHALL be able to hold multiple roles simultaneously, and the
 *   Access Context SHALL reflect all assigned roles and their combined permissions.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  assignRole,
  removeRole,
  updateRolePermissions,
} from '../../src/services/roleService';
import {
  buildAccessContext,
  createFullEmptyState,
  FullDatabaseState,
  RolePermissionRecord,
  UserRoleRecord,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';

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

// ---------------------------------------------------------------------------
// Property 14: Role Assignment Audit Completeness
// Validates: Requirements 4.7, 4.9, 10.2
// ---------------------------------------------------------------------------

describe('Property 14: Role Assignment Audit Completeness', () => {
  /**
   * **Validates: Requirements 4.7, 4.9, 10.2**
   *
   * For every role assignment, there SHALL exist exactly one audit_log entry
   * with action "role_assigned".
   */
  it('assignRole creates exactly one audit_log entry with action "role_assigned"', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;

          const newState = assignRole(state, actorId, userId, roleCode);

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;

          expect(auditCountAfter).toBe(auditCountBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assignRole audit entry records actor_user_id and after_data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          const newState = assignRole(state, actorId, userId, roleCode);

          const auditEntry = newState.auditLogs.find(
            (l) => l.action === 'role_assigned' && l.resource_id === userId,
          );

          expect(auditEntry).toBeDefined();
          // actor_user_id must be recorded (Req 4.7)
          expect(auditEntry!.actor_user_id).toBe(actorId);
          // after_data must contain the new user_role record
          const afterData = auditEntry!.after_data as UserRoleRecord;
          expect(afterData.user_id).toBe(userId);
          expect(afterData.role_code).toBe(roleCode);
          // before_data is null for a new assignment
          expect(auditEntry!.before_data).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.9, 10.2**
   *
   * For every role removal, there SHALL exist exactly one audit_log entry
   * with action "role_removed".
   */
  it('removeRole creates exactly one audit_log entry with action "role_removed"', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, actorId) => {
          // First assign the role, then remove it
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          state = assignRole(state, null, userId, roleCode);

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'role_removed',
          ).length;

          const newState = removeRole(state, actorId, userId, roleCode);

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'role_removed',
          ).length;

          expect(auditCountAfter).toBe(auditCountBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removeRole audit entry records actor_user_id and before_data', () => {
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

          const newState = removeRole(state, actorId, userId, roleCode);

          const auditEntry = newState.auditLogs.find(
            (l) => l.action === 'role_removed' && l.resource_id === userId,
          );

          expect(auditEntry).toBeDefined();
          // actor_user_id must be recorded (Req 4.9)
          expect(auditEntry!.actor_user_id).toBe(actorId);
          // before_data must contain the removed user_role record
          const beforeData = auditEntry!.before_data as UserRoleRecord;
          expect(beforeData.user_id).toBe(userId);
          expect(beforeData.role_code).toBe(roleCode);
          // after_data is null for a removal
          expect(auditEntry!.after_data).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('each assign/remove cycle produces exactly one audit log entry per operation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);

          // Assign
          state = assignRole(state, null, userId, roleCode);
          const assignedCount = state.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;
          expect(assignedCount).toBe(1);

          // Remove
          state = removeRole(state, null, userId, roleCode);
          const removedCount = state.auditLogs.filter(
            (l) => l.action === 'role_removed',
          ).length;
          expect(removedCount).toBe(1);

          // Re-assign
          state = assignRole(state, null, userId, roleCode);
          const reassignedCount = state.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;
          expect(reassignedCount).toBe(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assignRole throws when user does not exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          // Use a different userId that doesn't exist in state
          const nonExistentUserId = `nonexistent-${userId}`;
          expect(() =>
            assignRole(state, null, nonExistentUserId, roleCode),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assignRole throws when role does not exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          // Build state with no roles defined
          const state = buildBaseState(userId, sessionId, deviceId, [], []);
          expect(() =>
            assignRole(state, null, userId, roleCode),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assignRole throws when user already has the role (no duplicate assignments)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          let state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          state = assignRole(state, null, userId, roleCode);
          // Second assignment must throw
          expect(() =>
            assignRole(state, null, userId, roleCode),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removeRole throws when user does not have the role', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        (userId, sessionId, deviceId, roleCode) => {
          const state = buildBaseState(userId, sessionId, deviceId, [roleCode], []);
          // Role was never assigned
          expect(() =>
            removeRole(state, null, userId, roleCode),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateRolePermissions creates exactly one audit_log entry with action "permission_changed"', () => {
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

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'permission_changed',
          ).length;

          const newState = updateRolePermissions(
            state,
            actorId,
            roleCode,
            permCodes,
          );

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'permission_changed',
          ).length;

          expect(auditCountAfter).toBe(auditCountBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateRolePermissions audit entry records before_data and after_data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        permCodesArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, roleCode, initialPerms, newPerms, actorId) => {
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            [...new Set([...initialPerms, ...newPerms])],
          );

          // Set initial permissions
          state = updateRolePermissions(state, null, roleCode, initialPerms);

          // Update to new permissions
          const newState = updateRolePermissions(
            state,
            actorId,
            roleCode,
            newPerms,
          );

          // Use the last matching entry — the most recent updateRolePermissions call
          const allMatchingEntries = newState.auditLogs.filter(
            (l) =>
              l.action === 'permission_changed' &&
              l.resource_id === roleCode &&
              l.actor_user_id === actorId,
          );
          const auditEntry = allMatchingEntries[allMatchingEntries.length - 1];

          expect(auditEntry).toBeDefined();
          expect(auditEntry!.actor_user_id).toBe(actorId);

          // before_data should reflect the initial permissions
          const beforeData = auditEntry!.before_data as RolePermissionRecord[];
          const beforeCodes = new Set(beforeData.map((rp) => rp.permission_code));
          expect(beforeCodes).toEqual(new Set(initialPerms));

          // after_data should reflect the new permissions
          const afterData = auditEntry!.after_data as RolePermissionRecord[];
          const afterCodes = new Set(afterData.map((rp) => rp.permission_code));
          expect(afterCodes).toEqual(new Set(newPerms));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Multiple Role Support
// Validates: Requirements 4.13
// ---------------------------------------------------------------------------

describe('Property 15: Multiple Role Support', () => {
  /**
   * **Validates: Requirements 4.13**
   *
   * A user SHALL be able to hold multiple roles simultaneously, and the
   * Access Context SHALL reflect all assigned roles and their combined permissions.
   */
  it('a user can hold multiple roles simultaneously', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          let state = buildBaseState(userId, sessionId, deviceId, roleCodes, []);

          // Assign all roles one by one
          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          // All roles must be present in userRoles
          const assignedRoles = state.userRoles
            .filter((ur) => ur.user_id === userId)
            .map((ur) => ur.role_code);

          expect(new Set(assignedRoles)).toEqual(new Set(roleCodes));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Access Context includes all simultaneously assigned roles', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          let state = buildBaseState(userId, sessionId, deviceId, roleCodes, []);

          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          const ctx = buildAccessContext(state, userId, sessionId);

          // All assigned roles must appear in the Access Context
          expect(new Set(ctx.roles)).toEqual(new Set(roleCodes));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Access Context permissions are the union of all assigned role permissions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        // 2–4 distinct role codes
        fc.uniqueArray(codeArb, { minLength: 2, maxLength: 4 }),
        // 1–4 distinct permission codes per role
        fc.array(
          fc.uniqueArray(codeArb, { minLength: 1, maxLength: 4 }),
          { minLength: 2, maxLength: 4 },
        ),
        (userId, sessionId, deviceId, roleCodes, permsPerRole) => {
          // Align arrays
          const alignedPerms = roleCodes.map((_, i) => permsPerRole[i] ?? []);
          const allPermCodes = Array.from(
            new Set(alignedPerms.flat()),
          );

          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            roleCodes,
            allPermCodes,
          );

          // Assign all roles
          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          // Set permissions for each role
          for (let i = 0; i < roleCodes.length; i++) {
            state = updateRolePermissions(
              state,
              null,
              roleCodes[i],
              alignedPerms[i],
            );
          }

          const ctx = buildAccessContext(state, userId, sessionId);

          // Expected permissions = union of all role permissions
          const expectedPermissions = new Set(alignedPerms.flat());
          expect(new Set(ctx.permissions)).toEqual(expectedPermissions);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('removing one role does not affect other assigned roles', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        // At least 2 roles so we can remove one and keep the other
        fc.uniqueArray(codeArb, { minLength: 2, maxLength: 5 }),
        (userId, sessionId, deviceId, roleCodes) => {
          let state = buildBaseState(userId, sessionId, deviceId, roleCodes, []);

          // Assign all roles
          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          // Remove the first role
          const [removedRole, ...remainingRoles] = roleCodes;
          state = removeRole(state, null, userId, removedRole);

          // The remaining roles must still be assigned
          const assignedRoles = state.userRoles
            .filter((ur) => ur.user_id === userId)
            .map((ur) => ur.role_code);

          expect(new Set(assignedRoles)).toEqual(new Set(remainingRoles));
          expect(assignedRoles).not.toContain(removedRole);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user with multiple roles has correct role count in userRoles', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          let state = buildBaseState(userId, sessionId, deviceId, roleCodes, []);

          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          const userRoleCount = state.userRoles.filter(
            (ur) => ur.user_id === userId,
          ).length;

          expect(userRoleCount).toBe(roleCodes.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('assigning multiple roles produces one audit log entry per assignment', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          let state = buildBaseState(userId, sessionId, deviceId, roleCodes, []);

          for (const roleCode of roleCodes) {
            state = assignRole(state, null, userId, roleCode);
          }

          const assignAuditCount = state.auditLogs.filter(
            (l) => l.action === 'role_assigned',
          ).length;

          expect(assignAuditCount).toBe(roleCodes.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateRolePermissions replaces the full permission set for a role', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, initialPerms, newPerms) => {
          const allPerms = Array.from(new Set([...initialPerms, ...newPerms]));
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            allPerms,
          );

          // Set initial permissions
          state = updateRolePermissions(state, null, roleCode, initialPerms);

          // Replace with new permissions
          state = updateRolePermissions(state, null, roleCode, newPerms);

          // Only the new permissions should be present for this role
          const currentPerms = state.rolePermissions
            .filter((rp) => rp.role_code === roleCode)
            .map((rp) => rp.permission_code);

          expect(new Set(currentPerms)).toEqual(new Set(newPerms));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateRolePermissions deduplicates permission codes', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        codeArb,
        permCodesArb,
        (userId, sessionId, deviceId, roleCode, permCodes) => {
          const state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleCode],
            permCodes,
          );

          // Pass duplicate permission codes
          const duplicatedPerms = [...permCodes, ...permCodes];
          const newState = updateRolePermissions(
            state,
            null,
            roleCode,
            duplicatedPerms,
          );

          const storedPerms = newState.rolePermissions
            .filter((rp) => rp.role_code === roleCode)
            .map((rp) => rp.permission_code);

          // No duplicates in stored permissions
          expect(storedPerms.length).toBe(new Set(storedPerms).size);
          // All unique codes are present
          expect(new Set(storedPerms)).toEqual(new Set(permCodes));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('updateRolePermissions does not affect permissions of other roles', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        // Two distinct role codes
        fc.uniqueArray(codeArb, { minLength: 2, maxLength: 2 }),
        permCodesArb,
        permCodesArb,
        (userId, sessionId, deviceId, [roleA, roleB], permsA, permsB) => {
          const allPerms = Array.from(new Set([...permsA, ...permsB]));
          let state = buildBaseState(
            userId,
            sessionId,
            deviceId,
            [roleA, roleB],
            allPerms,
          );

          // Set permissions for both roles
          state = updateRolePermissions(state, null, roleA, permsA);
          state = updateRolePermissions(state, null, roleB, permsB);

          // Update only roleA
          const newPermsA = permsA.slice(0, Math.max(1, permsA.length - 1));
          state = updateRolePermissions(state, null, roleA, newPermsA);

          // roleB permissions must be unchanged
          const roleBPerms = state.rolePermissions
            .filter((rp) => rp.role_code === roleB)
            .map((rp) => rp.permission_code);

          expect(new Set(roleBPerms)).toEqual(new Set(permsB));
        },
      ),
      { numRuns: 100 },
    );
  });
});
