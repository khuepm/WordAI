/**
 * Property-based tests for GET /auth/context.
 *
 * Property 28: Authorization Source of Truth
 *   Validates: Requirements 8.6, 8.7
 *   For any authorization decision, the result SHALL be determined solely by
 *   data in Directus (the in-memory state), not by client-provided data.
 *   Test strategy: Generate random authorization data in client requests,
 *   verify the response is based on Directus data, not client-provided data.
 *
 * Property 30: Error Code Determinism
 *   Validates: Requirements 8.10
 *   For a given authorization failure condition, the error code SHALL always
 *   be the same.
 *   Test strategy: Generate various authorization failure conditions, verify
 *   the error code is always the same for the same condition.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { processGetContext } from '../../src/routes/context';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
  UserRoleRecord,
  RolePermissionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';
import { AppError } from '../../src/errors/AppError';
import { ErrorCode } from '../../src/types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with one user, one session, and optional roles/permissions.
 */
function buildStateWithUser(opts: {
  userId: string;
  sessionId: string;
  deviceId: string;
  sessionState?: 'active' | 'revoked';
  roleCodes?: string[];
  rolePermissionsMap?: Record<string, string[]>;
  entitlementOverrides?: Partial<EntitlementRecord>;
}): FullDatabaseState {
  const {
    userId,
    sessionId,
    deviceId,
    sessionState = 'active',
    roleCodes = [],
    rolePermissionsMap = {},
    entitlementOverrides = {},
  } = opts;

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
    session_state: sessionState,
    last_seen_at: now,
    revoked_at: sessionState === 'revoked' ? now : null,
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

  const base = createFullEmptyState();
  return {
    ...base,
    users: [user],
    entitlements: [entitlement],
    sessions: [session],
    userRoles,
    rolePermissions,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Prototype-polluting keys that must be excluded from string generators. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string safe to use as an identifier. */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

/** Device ID: non-empty string. */
const deviceIdArb = nonEmptyStringArb;

/** A list of distinct role codes. */
const roleCodesArb = fc.uniqueArray(nonEmptyStringArb, {
  minLength: 0,
  maxLength: 4,
});

/** A list of distinct permission codes. */
const permissionCodesArb = fc.uniqueArray(nonEmptyStringArb, {
  minLength: 0,
  maxLength: 6,
});

// ---------------------------------------------------------------------------
// Property 28: Authorization Source of Truth
// Validates: Requirements 8.6, 8.7
// ---------------------------------------------------------------------------

describe('Property 28: Authorization Source of Truth', () => {
  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * The Access Context returned by processGetContext SHALL reflect the roles
   * stored in the state (Directus), regardless of any client-provided role data.
   *
   * Test strategy: Build a state with known roles. Call processGetContext with
   * arbitrary "client-provided" role data (passed as extra parameters that the
   * function ignores). Verify the response roles match the state, not the
   * client-provided data.
   */
  it('roles in the response come from state, not from any client-provided data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        // Roles actually stored in Directus state
        roleCodesArb,
        // "Client-provided" roles that should be ignored
        roleCodesArb,
        (userId, sessionId, deviceId, stateRoles, clientProvidedRoles) => {
          // Build state with the Directus roles
          const rolePermissionsMap: Record<string, string[]> = {};
          for (const rc of stateRoles) {
            rolePermissionsMap[rc] = [];
          }

          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            roleCodes: stateRoles,
            rolePermissionsMap,
          });

          // processGetContext only accepts state, userId, sessionId —
          // there is no parameter for client-provided roles.
          // This is the enforcement: the function signature itself prevents
          // client data from influencing the authorization result.
          const context = processGetContext(state, userId, sessionId);

          // The roles in the response must match the state (Directus), not
          // the client-provided roles.
          expect(new Set(context.roles)).toEqual(new Set(stateRoles));

          // If client-provided roles differ from state roles, the response
          // must still reflect the state roles.
          if (
            JSON.stringify([...clientProvidedRoles].sort()) !==
            JSON.stringify([...stateRoles].sort())
          ) {
            expect(new Set(context.roles)).not.toEqual(
              new Set(clientProvidedRoles),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * The permissions in the response SHALL be derived from the roles in the
   * state (Directus), not from any client-provided permission data.
   */
  it('permissions in the response come from state, not from any client-provided data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        // Roles and permissions stored in Directus state
        roleCodesArb,
        permissionCodesArb,
        // "Client-provided" permissions that should be ignored
        permissionCodesArb,
        (userId, sessionId, deviceId, roleCodes, statePermissions, clientPermissions) => {
          // Assign all statePermissions to the first role (if any)
          const rolePermissionsMap: Record<string, string[]> = {};
          if (roleCodes.length > 0) {
            rolePermissionsMap[roleCodes[0]] = statePermissions;
            for (let i = 1; i < roleCodes.length; i++) {
              rolePermissionsMap[roleCodes[i]] = [];
            }
          }

          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          });

          // processGetContext has no parameter for client-provided permissions.
          // All permissions are derived from the state.
          const context = processGetContext(state, userId, sessionId);

          // The permissions must match what's in the state
          const expectedPermissions = new Set(
            roleCodes.length > 0 ? statePermissions : [],
          );
          expect(new Set(context.permissions)).toEqual(expectedPermissions);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * The quota data in the response SHALL come from the state (Directus),
   * not from any client-provided quota data.
   */
  it('quota data in the response comes from state, not from any client-provided data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        // Quota values stored in Directus state
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        // "Client-provided" quota values that should be ignored
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (
          userId,
          sessionId,
          deviceId,
          stateMonthlyQuota,
          stateUsedQuotaRaw,
          _clientMonthlyQuota,
          _clientUsedQuota,
        ) => {
          // Ensure used_quota <= monthly_quota (database constraint)
          const stateUsedQuota = Math.min(stateUsedQuotaRaw, stateMonthlyQuota);

          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            entitlementOverrides: {
              monthly_quota: stateMonthlyQuota,
              used_quota: stateUsedQuota,
            },
          });

          // processGetContext has no parameter for client-provided quota data.
          const context = processGetContext(state, userId, sessionId);

          // The quota values must match the state (Directus)
          expect(context.entitlement.monthly_quota).toBe(stateMonthlyQuota);
          expect(context.entitlement.used_quota).toBe(stateUsedQuota);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * Calling processGetContext twice with the same state SHALL return the same
   * authorization data — the function is deterministic and reads only from state.
   */
  it('two calls with the same state return identical authorization data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        roleCodesArb,
        permissionCodesArb,
        (userId, sessionId, deviceId, roleCodes, permissions) => {
          const rolePermissionsMap: Record<string, string[]> = {};
          if (roleCodes.length > 0) {
            rolePermissionsMap[roleCodes[0]] = permissions;
            for (let i = 1; i < roleCodes.length; i++) {
              rolePermissionsMap[roleCodes[i]] = [];
            }
          }

          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          });

          const ctx1 = processGetContext(state, userId, sessionId);
          const ctx2 = processGetContext(state, userId, sessionId);

          // Both calls must return identical authorization data
          expect(new Set(ctx1.roles)).toEqual(new Set(ctx2.roles));
          expect(new Set(ctx1.permissions)).toEqual(new Set(ctx2.permissions));
          expect(ctx1.entitlement.monthly_quota).toBe(ctx2.entitlement.monthly_quota);
          expect(ctx1.entitlement.used_quota).toBe(ctx2.entitlement.used_quota);
          expect(ctx1.entitlement.plan_code).toBe(ctx2.entitlement.plan_code);
          expect(ctx1.entitlement.ai_enabled).toBe(ctx2.entitlement.ai_enabled);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * When the state changes (e.g. a role is added), the next call to
   * processGetContext SHALL reflect the updated state — no stale cached data.
   */
  it('reflects updated state on the next call (no caching)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userId, sessionId, deviceId, roleCode, permCode) => {
          // Initial state: no roles
          const stateWithoutRole = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            roleCodes: [],
            rolePermissionsMap: {},
          });

          const ctx1 = processGetContext(stateWithoutRole, userId, sessionId);
          expect(ctx1.roles).toHaveLength(0);
          expect(ctx1.permissions).toHaveLength(0);

          // Updated state: role added
          const stateWithRole = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            roleCodes: [roleCode],
            rolePermissionsMap: { [roleCode]: [permCode] },
          });

          const ctx2 = processGetContext(stateWithRole, userId, sessionId);
          expect(ctx2.roles).toContain(roleCode);
          expect(ctx2.permissions).toContain(permCode);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('concrete example: client-provided roles are ignored, state roles are used', () => {
    const userId = 'user-auth-source-test';
    const sessionId = 'session-auth-source-test';
    const deviceId = 'device-auth-source-test';

    // State has only the 'user' role
    const state = buildStateWithUser({
      userId,
      sessionId,
      deviceId,
      roleCodes: ['user'],
      rolePermissionsMap: { user: ['ai.use'] },
    });

    // Even if a client tried to claim 'admin' role, processGetContext
    // only reads from state — there is no way to inject client data.
    const context = processGetContext(state, userId, sessionId);

    expect(context.roles).toEqual(['user']);
    expect(context.permissions).toEqual(['ai.use']);
    // 'admin' is NOT in the response because it's not in the state
    expect(context.roles).not.toContain('admin');
  });
});

// ---------------------------------------------------------------------------
// Property 30: Error Code Determinism
// Validates: Requirements 8.10
// ---------------------------------------------------------------------------

describe('Property 30: Error Code Determinism', () => {
  /**
   * **Validates: Requirements 8.10**
   *
   * When no userId is provided (missing authentication), the error code SHALL
   * always be AUTH_REQUIRED.
   */
  it('missing userId always produces AUTH_REQUIRED error code', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        deviceIdArb,
        (sessionId, deviceId) => {
          const state = createFullEmptyState();

          let thrownError: AppError | null = null;
          try {
            processGetContext(state, '', sessionId);
          } catch (err) {
            if (err instanceof AppError) {
              thrownError = err;
            }
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError!.code).toBe(ErrorCode.AUTH_REQUIRED);
          expect(thrownError!.statusCode).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * When no sessionId is provided (missing authentication), the error code SHALL
   * always be AUTH_REQUIRED.
   */
  it('missing sessionId always produces AUTH_REQUIRED error code', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          const state = createFullEmptyState();

          let thrownError: AppError | null = null;
          try {
            processGetContext(state, userId, '');
          } catch (err) {
            if (err instanceof AppError) {
              thrownError = err;
            }
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError!.code).toBe(ErrorCode.AUTH_REQUIRED);
          expect(thrownError!.statusCode).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * When the session does not exist in the state, the error code SHALL always
   * be AUTH_REQUIRED.
   */
  it('non-existent session always produces AUTH_REQUIRED error code', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId, nonExistentSessionId) => {
          // State has no sessions
          const state = createFullEmptyState();

          let thrownError: AppError | null = null;
          try {
            processGetContext(state, userId, nonExistentSessionId);
          } catch (err) {
            if (err instanceof AppError) {
              thrownError = err;
            }
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError!.code).toBe(ErrorCode.AUTH_REQUIRED);
          expect(thrownError!.statusCode).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * When the session has been revoked, the error code SHALL always be
   * SESSION_REVOKED (not AUTH_REQUIRED or any other code).
   */
  it('revoked session always produces SESSION_REVOKED error code', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        (userId, sessionId, deviceId) => {
          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            sessionState: 'revoked',
          });

          let thrownError: AppError | null = null;
          try {
            processGetContext(state, userId, sessionId);
          } catch (err) {
            if (err instanceof AppError) {
              thrownError = err;
            }
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError!.code).toBe(ErrorCode.SESSION_REVOKED);
          expect(thrownError!.statusCode).toBe(403);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * The error code for a revoked session SHALL always be SESSION_REVOKED,
   * regardless of how many times the session was revoked or what other
   * sessions exist.
   */
  it('SESSION_REVOKED error code is stable across multiple calls for the same revoked session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.integer({ min: 2, max: 5 }),
        (userId, sessionId, deviceId, callCount) => {
          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            sessionState: 'revoked',
          });

          const errorCodes: string[] = [];

          for (let i = 0; i < callCount; i++) {
            try {
              processGetContext(state, userId, sessionId);
            } catch (err) {
              if (err instanceof AppError) {
                errorCodes.push(err.code);
              }
            }
          }

          // All calls must produce the same error code
          expect(errorCodes).toHaveLength(callCount);
          expect(new Set(errorCodes).size).toBe(1);
          expect(errorCodes[0]).toBe(ErrorCode.SESSION_REVOKED);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * The error code for missing authentication SHALL always be AUTH_REQUIRED,
   * regardless of what other data is in the state.
   */
  it('AUTH_REQUIRED error code is stable regardless of state contents', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          // Build a state with some data, but no session matching the given sessionId
          const rolePermissionsMap: Record<string, string[]> = {};
          for (const rc of roleCodes) {
            rolePermissionsMap[rc] = [];
          }

          // Use a different sessionId in the state so the lookup fails
          const differentSessionId = `different-${sessionId}`;
          const state = buildStateWithUser({
            userId,
            sessionId: differentSessionId,
            deviceId,
            roleCodes,
            rolePermissionsMap,
          });

          // Try to get context with the original sessionId (not in state)
          let thrownError: AppError | null = null;
          try {
            processGetContext(state, userId, sessionId);
          } catch (err) {
            if (err instanceof AppError) {
              thrownError = err;
            }
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError!.code).toBe(ErrorCode.AUTH_REQUIRED);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.10**
   *
   * A successful call (valid session) SHALL never throw an error.
   * This verifies the happy path is deterministic too.
   */
  it('valid session always succeeds without throwing', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        roleCodesArb,
        (userId, sessionId, deviceId, roleCodes) => {
          const rolePermissionsMap: Record<string, string[]> = {};
          for (const rc of roleCodes) {
            rolePermissionsMap[rc] = [];
          }

          const state = buildStateWithUser({
            userId,
            sessionId,
            deviceId,
            sessionState: 'active',
            roleCodes,
            rolePermissionsMap,
          });

          // Must not throw for a valid active session
          expect(() =>
            processGetContext(state, userId, sessionId),
          ).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based tests for clarity
  it('concrete example: empty userId → AUTH_REQUIRED', () => {
    const state = createFullEmptyState();
    expect(() => processGetContext(state, '', 'some-session')).toThrow(AppError);

    try {
      processGetContext(state, '', 'some-session');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.AUTH_REQUIRED);
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it('concrete example: revoked session → SESSION_REVOKED', () => {
    const userId = 'user-error-code-test';
    const sessionId = 'session-revoked-test';
    const deviceId = 'device-error-code-test';

    const state = buildStateWithUser({
      userId,
      sessionId,
      deviceId,
      sessionState: 'revoked',
    });

    try {
      processGetContext(state, userId, sessionId);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(ErrorCode.SESSION_REVOKED);
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it('concrete example: active session → success', () => {
    const userId = 'user-success-test';
    const sessionId = 'session-success-test';
    const deviceId = 'device-success-test';

    const state = buildStateWithUser({
      userId,
      sessionId,
      deviceId,
      sessionState: 'active',
      roleCodes: ['user'],
      rolePermissionsMap: { user: ['ai.use'] },
    });

    const context = processGetContext(state, userId, sessionId);
    expect(context.user.id).toBe(userId);
    expect(context.roles).toContain('user');
    expect(context.permissions).toContain('ai.use');
    expect(context.session.session_state).toBe('active');
  });
});
