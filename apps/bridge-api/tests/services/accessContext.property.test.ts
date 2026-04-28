/**
 * Property-based tests for Access Context construction.
 *
 * Property 2: Access Context Serialization Round-Trip
 *   Validates: Requirements 1.8, 1.9
 *   Serializing to JSON and deserializing back SHALL preserve all authorization data.
 *
 * Property 13: Permission Closure
 *   Validates: Requirements 4.10–4.12
 *   For any user with roles R, the set of permissions SHALL equal the union of
 *   permissions for all roles in R.
 *
 * Property 29: Access Context Consistency
 *   Validates: Requirements 8.8
 *   Two Access Context requests for the same user at the same time SHALL return
 *   equivalent authorization data.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AccessContext, PlanCode, UserStatus } from '../../src/types/index';
import {
  buildAccessContext,
  createFullEmptyState,
  FullDatabaseState,
  UserRoleRecord,
  RolePermissionRecord,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';

// ---------------------------------------------------------------------------
// Arbitraries — shared generators
// ---------------------------------------------------------------------------

/** Non-empty UUID-like string. */
const uuidArb = fc.uuid();

/** ISO 8601 timestamp string. */
const isoTimestampArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** Valid user status. */
const userStatusArb = fc.constantFrom<UserStatus>(
  'pending',
  'active',
  'suspended',
  'deleted',
);

/** Valid plan code. */
const planCodeArb = fc.constantFrom<PlanCode>('free', 'pro', 'enterprise');

/**
 * Prototype-polluting keys that must be excluded from object key generators.
 * Using these as object keys causes unexpected behavior in plain JS objects.
 */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string (trimmed), safe to use as an object key. */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

/** A list of distinct permission codes. */
const permissionCodesArb = fc
  .uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 8 });

/** A list of distinct role codes. */
const roleCodesArb = fc
  .uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 5 });

/** A list of distinct model identifiers. */
const allowedModelsArb = fc
  .uniqueArray(nonEmptyStringArb, { minLength: 1, maxLength: 5 });

// ---------------------------------------------------------------------------
// Arbitrary: complete AccessContext
// ---------------------------------------------------------------------------

/**
 * Generates a random but structurally valid AccessContext object.
 * Used for Property 2 (serialization round-trip).
 */
const accessContextArb: fc.Arbitrary<AccessContext> = fc.record({
  user: fc.record({
    id: uuidArb,
    firebase_uid: nonEmptyStringArb,
    email: fc.emailAddress(),
    display_name: nonEmptyStringArb,
    avatar_url: fc.option(fc.webUrl(), { nil: null }),
    status: userStatusArb,
    last_login_at: isoTimestampArb,
  }),
  roles: roleCodesArb,
  permissions: permissionCodesArb,
  entitlement: fc.record({
    ai_enabled: fc.boolean(),
    plan_code: planCodeArb,
    monthly_quota: fc.integer({ min: 0, max: 10000 }),
    used_quota: fc.integer({ min: 0, max: 10000 }).chain((monthly) =>
      fc.integer({ min: 0, max: monthly }).map((used) => used),
    ),
    quota_reset_at: isoTimestampArb,
    allowed_models: allowedModelsArb,
    max_requests_per_minute: fc.integer({ min: 1, max: 1000 }),
  }),
  session: fc.record({
    id: uuidArb,
    device_id: nonEmptyStringArb,
    session_state: fc.constant('active' as const),
    last_seen_at: isoTimestampArb,
  }),
});

// ---------------------------------------------------------------------------
// Helpers for building FullDatabaseState
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState containing a single user with the given roles,
 * where each role has the given permissions, plus an entitlement and session.
 */
function buildStateWithUserRolesAndPermissions(
  userId: string,
  sessionId: string,
  deviceId: string,
  roleCodes: string[],
  rolePermissionsMap: Record<string, string[]>,
  entitlementOverrides: Partial<EntitlementRecord> = {},
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
    ...entitlementOverrides,
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

  const userRoles: UserRoleRecord[] = roleCodes.map((roleCode) => ({
    id: `ur-${userId}-${roleCode}`,
    user_id: userId,
    role_code: roleCode,
    assigned_at: now,
    assigned_by: null,
  }));

  const rolePermissions: RolePermissionRecord[] = [];
  for (const [roleCode, permCodes] of Object.entries(rolePermissionsMap)) {
    for (const permCode of permCodes) {
      rolePermissions.push({ role_code: roleCode, permission_code: permCode });
    }
  }

  const state = createFullEmptyState();
  return {
    ...state,
    users: [user],
    entitlements: [entitlement],
    sessions: [session],
    userRoles,
    rolePermissions,
  };
}

// ---------------------------------------------------------------------------
// Property 2: Access Context Serialization Round-Trip
// Validates: Requirements 1.8, 1.9
// ---------------------------------------------------------------------------

describe('Property 2: Access Context Serialization Round-Trip', () => {
  /**
   * **Validates: Requirements 1.8, 1.9**
   *
   * For any AccessContext object, serializing to JSON and deserializing back
   * SHALL preserve all authorization data (user, roles, permissions,
   * entitlement, session).
   */
  it('JSON round-trip preserves all authorization data', () => {
    fc.assert(
      fc.property(accessContextArb, (ctx) => {
        const serialized = JSON.stringify(ctx);
        const deserialized: AccessContext = JSON.parse(serialized);

        // User fields
        expect(deserialized.user.id).toBe(ctx.user.id);
        expect(deserialized.user.firebase_uid).toBe(ctx.user.firebase_uid);
        expect(deserialized.user.email).toBe(ctx.user.email);
        expect(deserialized.user.display_name).toBe(ctx.user.display_name);
        expect(deserialized.user.avatar_url).toBe(ctx.user.avatar_url);
        expect(deserialized.user.status).toBe(ctx.user.status);
        expect(deserialized.user.last_login_at).toBe(ctx.user.last_login_at);

        // Roles and permissions
        expect(deserialized.roles).toEqual(ctx.roles);
        expect(deserialized.permissions).toEqual(ctx.permissions);

        // Entitlement fields
        expect(deserialized.entitlement.ai_enabled).toBe(ctx.entitlement.ai_enabled);
        expect(deserialized.entitlement.plan_code).toBe(ctx.entitlement.plan_code);
        expect(deserialized.entitlement.monthly_quota).toBe(ctx.entitlement.monthly_quota);
        expect(deserialized.entitlement.used_quota).toBe(ctx.entitlement.used_quota);
        expect(deserialized.entitlement.quota_reset_at).toBe(ctx.entitlement.quota_reset_at);
        expect(deserialized.entitlement.allowed_models).toEqual(ctx.entitlement.allowed_models);
        expect(deserialized.entitlement.max_requests_per_minute).toBe(
          ctx.entitlement.max_requests_per_minute,
        );

        // Session fields
        expect(deserialized.session.id).toBe(ctx.session.id);
        expect(deserialized.session.device_id).toBe(ctx.session.device_id);
        expect(deserialized.session.session_state).toBe(ctx.session.session_state);
        expect(deserialized.session.last_seen_at).toBe(ctx.session.last_seen_at);
      }),
      { numRuns: 100 },
    );
  });

  it('JSON round-trip produces deep equality', () => {
    fc.assert(
      fc.property(accessContextArb, (ctx) => {
        const deserialized: AccessContext = JSON.parse(JSON.stringify(ctx));
        expect(deserialized).toEqual(ctx);
      }),
      { numRuns: 100 },
    );
  });

  it('double round-trip is idempotent', () => {
    fc.assert(
      fc.property(accessContextArb, (ctx) => {
        const once: AccessContext = JSON.parse(JSON.stringify(ctx));
        const twice: AccessContext = JSON.parse(JSON.stringify(once));
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Permission Closure
// Validates: Requirements 4.10–4.12
// ---------------------------------------------------------------------------

describe('Property 13: Permission Closure', () => {
  /**
   * **Validates: Requirements 4.10–4.12**
   *
   * For any user with roles R, the set of permissions in Access Context SHALL
   * equal the union of permissions for all roles in R.
   */
  it('permissions equal the union of all role permissions', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        // Generate 0–4 distinct role codes
        fc.uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 4 }),
        // For each role, generate 0–4 distinct permission codes
        fc.array(
          fc.uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 4 }),
          { minLength: 0, maxLength: 4 },
        ),
        (userId, sessionId, deviceId, roleCodes, permissionsPerRole) => {
          // Align permissions array length with roleCodes length
          const alignedPerms = roleCodes.map(
            (_, i) => permissionsPerRole[i] ?? [],
          );

          // Build the role→permissions map
          const rolePermissionsMap: Record<string, string[]> = {};
          for (let i = 0; i < roleCodes.length; i++) {
            rolePermissionsMap[roleCodes[i]] = alignedPerms[i];
          }

          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          );

          const ctx = buildAccessContext(state, userId, sessionId);

          // Compute expected permission union
          const expectedPermissions = new Set<string>();
          for (const perms of alignedPerms) {
            for (const p of perms) {
              expectedPermissions.add(p);
            }
          }

          // The actual permissions set must equal the expected union
          const actualPermissions = new Set(ctx.permissions);
          expect(actualPermissions).toEqual(expectedPermissions);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user with no roles has empty permissions', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, nonEmptyStringArb, (userId, sessionId, deviceId) => {
        const state = buildStateWithUserRolesAndPermissions(
          userId,
          sessionId,
          deviceId,
          [],
          {},
        );

        const ctx = buildAccessContext(state, userId, sessionId);
        expect(ctx.roles).toHaveLength(0);
        expect(ctx.permissions).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('permissions are deduplicated when multiple roles share permissions', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        // Two distinct role codes
        fc
          .uniqueArray(nonEmptyStringArb, { minLength: 2, maxLength: 2 }),
        // A shared permission code
        nonEmptyStringArb,
        (userId, sessionId, deviceId, [roleA, roleB], sharedPerm) => {
          // Both roles share the same permission
          const rolePermissionsMap: Record<string, string[]> = {
            [roleA]: [sharedPerm],
            [roleB]: [sharedPerm],
          };

          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            [roleA, roleB],
            rolePermissionsMap,
          );

          const ctx = buildAccessContext(state, userId, sessionId);

          // The shared permission should appear exactly once
          const occurrences = ctx.permissions.filter((p) => p === sharedPerm).length;
          expect(occurrences).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('roles in Access Context match the user_roles records', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        fc.uniqueArray(nonEmptyStringArb, { minLength: 1, maxLength: 4 }),
        (userId, sessionId, deviceId, roleCodes) => {
          const rolePermissionsMap: Record<string, string[]> = {};
          for (const rc of roleCodes) {
            rolePermissionsMap[rc] = [];
          }

          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          );

          const ctx = buildAccessContext(state, userId, sessionId);

          // The roles in the context must match the assigned role codes
          expect(new Set(ctx.roles)).toEqual(new Set(roleCodes));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 29: Access Context Consistency
// Validates: Requirements 8.8
// ---------------------------------------------------------------------------

describe('Property 29: Access Context Consistency', () => {
  /**
   * **Validates: Requirements 8.8**
   *
   * Two Access Context requests for the same user at the same time SHALL return
   * equivalent authorization data.
   */
  it('two calls for the same user and session return equivalent data', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        fc.uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 4 }),
        fc.array(
          fc.uniqueArray(nonEmptyStringArb, { minLength: 0, maxLength: 4 }),
          { minLength: 0, maxLength: 4 },
        ),
        (userId, sessionId, deviceId, roleCodes, permissionsPerRole) => {
          const alignedPerms = roleCodes.map(
            (_, i) => permissionsPerRole[i] ?? [],
          );
          const rolePermissionsMap: Record<string, string[]> = {};
          for (let i = 0; i < roleCodes.length; i++) {
            rolePermissionsMap[roleCodes[i]] = alignedPerms[i];
          }

          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          );

          // Call buildAccessContext twice with the same state
          const ctx1 = buildAccessContext(state, userId, sessionId);
          const ctx2 = buildAccessContext(state, userId, sessionId);

          // Both results must be deeply equal
          expect(ctx1).toEqual(ctx2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user fields are consistent across two calls', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        (userId, sessionId, deviceId) => {
          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            [],
            {},
          );

          const ctx1 = buildAccessContext(state, userId, sessionId);
          const ctx2 = buildAccessContext(state, userId, sessionId);

          expect(ctx1.user).toEqual(ctx2.user);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('entitlement data is consistent across two calls', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        (userId, sessionId, deviceId) => {
          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            [],
            {},
          );

          const ctx1 = buildAccessContext(state, userId, sessionId);
          const ctx2 = buildAccessContext(state, userId, sessionId);

          expect(ctx1.entitlement).toEqual(ctx2.entitlement);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('roles and permissions are consistent across two calls', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        nonEmptyStringArb,
        fc.uniqueArray(nonEmptyStringArb, { minLength: 1, maxLength: 3 }),
        (userId, sessionId, deviceId, roleCodes) => {
          const rolePermissionsMap: Record<string, string[]> = {};
          for (const rc of roleCodes) {
            rolePermissionsMap[rc] = [`${rc}.read`, `${rc}.write`];
          }

          const state = buildStateWithUserRolesAndPermissions(
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          );

          const ctx1 = buildAccessContext(state, userId, sessionId);
          const ctx2 = buildAccessContext(state, userId, sessionId);

          expect(new Set(ctx1.roles)).toEqual(new Set(ctx2.roles));
          expect(new Set(ctx1.permissions)).toEqual(new Set(ctx2.permissions));
        },
      ),
      { numRuns: 100 },
    );
  });
});
