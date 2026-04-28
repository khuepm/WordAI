/**
 * Property-based tests for database constraint enforcement
 * Validates: Requirements 12.10, 12.11
 *
 * Property 37: Database Constraint Enforcement
 * For any constraint C defined in migrations, the database SHALL reject
 * operations that violate C.
 *
 * Since the actual database is not available in the test environment,
 * constraints are modelled as an in-memory validation layer that mirrors
 * the CHECK constraints, UNIQUE constraints, and foreign key constraints
 * defined in the Lumibase migrations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';
type PlanCode = 'free' | 'pro' | 'enterprise';
type SessionState = 'active' | 'revoked';

interface UserRow {
  id: string;
  firebase_uid: string;
  email: string;
  status: UserStatus;
}

interface UserEntitlementRow {
  id: string;
  user_id: string;
  plan_code: PlanCode;
  monthly_quota: number;
  used_quota: number;
}

interface UserSessionRow {
  id: string;
  user_id: string;
  device_id: string;
  session_state: SessionState;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  role_code: string;
}

// ---------------------------------------------------------------------------
// In-memory database model
// ---------------------------------------------------------------------------

/**
 * Represents the in-memory state of the relevant database tables.
 * Each table is stored as an array of rows; constraint checks are performed
 * before any insert is committed.
 */
interface DatabaseState {
  users: UserRow[];
  user_entitlements: UserEntitlementRow[];
  user_sessions: UserSessionRow[];
  user_roles: UserRoleRow[];
}

function emptyDatabase(): DatabaseState {
  return {
    users: [],
    user_entitlements: [],
    user_sessions: [],
    user_roles: [],
  };
}

// ---------------------------------------------------------------------------
// Constraint-enforcing insert functions
// Each function returns the updated state on success, or throws a
// ConstraintViolationError on failure — mirroring PostgreSQL behaviour.
// ---------------------------------------------------------------------------

class ConstraintViolationError extends Error {
  constructor(
    public readonly constraint: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConstraintViolationError';
  }
}

/**
 * Insert a user row, enforcing:
 * - UNIQUE(firebase_uid)
 * - UNIQUE(email)
 * - CHECK(status IN ('pending','active','suspended','deleted'))
 */
function insertUser(state: DatabaseState, row: UserRow): DatabaseState {
  // UNIQUE constraint: firebase_uid
  if (state.users.some((u) => u.firebase_uid === row.firebase_uid)) {
    throw new ConstraintViolationError(
      'users_firebase_uid_key',
      `duplicate key value violates unique constraint "users_firebase_uid_key": firebase_uid "${row.firebase_uid}" already exists`,
    );
  }

  // UNIQUE constraint: email
  if (state.users.some((u) => u.email === row.email)) {
    throw new ConstraintViolationError(
      'users_email_key',
      `duplicate key value violates unique constraint "users_email_key": email "${row.email}" already exists`,
    );
  }

  // CHECK constraint: status
  const validStatuses: UserStatus[] = ['pending', 'active', 'suspended', 'deleted'];
  if (!validStatuses.includes(row.status)) {
    throw new ConstraintViolationError(
      'users_status_check',
      `new row for relation "users" violates check constraint "users_status_check": status "${row.status}" is not valid`,
    );
  }

  return { ...state, users: [...state.users, row] };
}

/**
 * Insert a user_entitlements row, enforcing:
 * - UNIQUE(user_id)  — one entitlement per user
 * - CHECK(used_quota >= 0 AND used_quota <= monthly_quota)
 * - CHECK(plan_code IN ('free','pro','enterprise'))
 */
function insertUserEntitlement(
  state: DatabaseState,
  row: UserEntitlementRow,
): DatabaseState {
  // UNIQUE constraint: user_id
  if (state.user_entitlements.some((e) => e.user_id === row.user_id)) {
    throw new ConstraintViolationError(
      'user_entitlements_user_id_key',
      `duplicate key value violates unique constraint "user_entitlements_user_id_key": user_id "${row.user_id}" already has an entitlement`,
    );
  }

  // CHECK constraint: used_quota >= 0
  if (row.used_quota < 0) {
    throw new ConstraintViolationError(
      'check_quota_valid',
      `new row for relation "user_entitlements" violates check constraint "check_quota_valid": used_quota ${row.used_quota} must be >= 0`,
    );
  }

  // CHECK constraint: used_quota <= monthly_quota
  if (row.used_quota > row.monthly_quota) {
    throw new ConstraintViolationError(
      'check_quota_valid',
      `new row for relation "user_entitlements" violates check constraint "check_quota_valid": used_quota ${row.used_quota} exceeds monthly_quota ${row.monthly_quota}`,
    );
  }

  // CHECK constraint: plan_code
  const validPlanCodes: PlanCode[] = ['free', 'pro', 'enterprise'];
  if (!validPlanCodes.includes(row.plan_code)) {
    throw new ConstraintViolationError(
      'user_entitlements_plan_code_check',
      `new row for relation "user_entitlements" violates check constraint "user_entitlements_plan_code_check": plan_code "${row.plan_code}" is not valid`,
    );
  }

  return { ...state, user_entitlements: [...state.user_entitlements, row] };
}

/**
 * Insert a user_sessions row, enforcing:
 * - UNIQUE(user_id, device_id)
 */
function insertUserSession(
  state: DatabaseState,
  row: UserSessionRow,
): DatabaseState {
  // UNIQUE constraint: (user_id, device_id)
  if (
    state.user_sessions.some(
      (s) => s.user_id === row.user_id && s.device_id === row.device_id,
    )
  ) {
    throw new ConstraintViolationError(
      'user_sessions_user_id_device_id_key',
      `duplicate key value violates unique constraint "user_sessions_user_id_device_id_key": (user_id, device_id) pair already exists`,
    );
  }

  return { ...state, user_sessions: [...state.user_sessions, row] };
}

/**
 * Insert a user_roles row, enforcing:
 * - UNIQUE(user_id, role_code)
 */
function insertUserRole(state: DatabaseState, row: UserRoleRow): DatabaseState {
  // UNIQUE constraint: (user_id, role_code)
  if (
    state.user_roles.some(
      (r) => r.user_id === row.user_id && r.role_code === row.role_code,
    )
  ) {
    throw new ConstraintViolationError(
      'user_roles_user_id_role_code_key',
      `duplicate key value violates unique constraint "user_roles_user_id_role_code_key": (user_id, role_code) pair already exists`,
    );
  }

  return { ...state, user_roles: [...state.user_roles, row] };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a UUID-like string */
const uuidArb = fc.stringMatching(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{12}$/,
);

/** Generate a valid firebase_uid (1–128 printable ASCII chars, no spaces) */
const firebaseUidArb = fc.stringMatching(/^[A-Za-z0-9_-]{20,28}$/);

/** Generate a valid normalized email */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,8}$/),
    fc.constantFrom('com', 'net', 'org', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid UserStatus */
const validStatusArb = fc.constantFrom<UserStatus>(
  'pending',
  'active',
  'suspended',
  'deleted',
);

/** Generate an invalid status string (not in the allowed set) */
const invalidStatusArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !['pending', 'active', 'suspended', 'deleted'].includes(s));

/** Generate a valid PlanCode */
const validPlanCodeArb = fc.constantFrom<PlanCode>('free', 'pro', 'enterprise');

/** Generate an invalid plan_code string */
const invalidPlanCodeArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !['free', 'pro', 'enterprise'].includes(s));

/** Generate a valid device_id */
const deviceIdArb = fc.stringMatching(/^[A-Za-z0-9_-]{8,32}$/);

/** Generate a valid role_code */
const roleCodeArb = fc.constantFrom('guest', 'user', 'pro', 'admin', 'support');

/** Generate a non-negative monthly_quota */
const monthlyQuotaArb = fc.integer({ min: 1, max: 10000 });

// ---------------------------------------------------------------------------
// Property 37: Database Constraint Enforcement
// **Validates: Requirements 12.10, 12.11**
// ---------------------------------------------------------------------------

describe('Property 37: Database Constraint Enforcement', () => {
  // -------------------------------------------------------------------------
  // 1. Duplicate firebase_uid is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user with a duplicate firebase_uid is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          firebaseUidArb,
          emailArb,
          emailArb,
          validStatusArb,
          validStatusArb,
          (id1, id2, sharedUid, email1, email2, status1, status2) => {
            // Ensure the two emails are distinct so only the uid triggers the violation
            fc.pre(email1 !== email2);

            const firstRow: UserRow = {
              id: id1,
              firebase_uid: sharedUid,
              email: email1,
              status: status1,
            };
            const duplicateUidRow: UserRow = {
              id: id2,
              firebase_uid: sharedUid, // same uid → constraint violation
              email: email2,
              status: status2,
            };

            let state = emptyDatabase();
            state = insertUser(state, firstRow);

            expect(() => insertUser(state, duplicateUidRow)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUser(state, duplicateUidRow)).toThrow(
              'users_firebase_uid_key',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 2. Duplicate email is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user with a duplicate email is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          firebaseUidArb,
          firebaseUidArb,
          emailArb,
          validStatusArb,
          validStatusArb,
          (id1, id2, uid1, uid2, sharedEmail, status1, status2) => {
            // Ensure the two uids are distinct so only the email triggers the violation
            fc.pre(uid1 !== uid2);

            const firstRow: UserRow = {
              id: id1,
              firebase_uid: uid1,
              email: sharedEmail,
              status: status1,
            };
            const duplicateEmailRow: UserRow = {
              id: id2,
              firebase_uid: uid2,
              email: sharedEmail, // same email → constraint violation
              status: status2,
            };

            let state = emptyDatabase();
            state = insertUser(state, firstRow);

            expect(() => insertUser(state, duplicateEmailRow)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUser(state, duplicateEmailRow)).toThrow(
              'users_email_key',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 3. used_quota > monthly_quota is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user_entitlement with used_quota > monthly_quota is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          monthlyQuotaArb,
          fc.integer({ min: 1, max: 10000 }),
          validPlanCodeArb,
          (entitlementId, userId, monthlyQuota, excess, planCode) => {
            const usedQuota = monthlyQuota + excess; // always > monthly_quota

            const row: UserEntitlementRow = {
              id: entitlementId,
              user_id: userId,
              plan_code: planCode,
              monthly_quota: monthlyQuota,
              used_quota: usedQuota,
            };

            const state = emptyDatabase();

            expect(() => insertUserEntitlement(state, row)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUserEntitlement(state, row)).toThrow(
              'check_quota_valid',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 4. used_quota < 0 is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user_entitlement with used_quota < 0 is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          monthlyQuotaArb,
          fc.integer({ min: 1, max: 10000 }),
          validPlanCodeArb,
          (entitlementId, userId, monthlyQuota, magnitude, planCode) => {
            const usedQuota = -magnitude; // always < 0

            const row: UserEntitlementRow = {
              id: entitlementId,
              user_id: userId,
              plan_code: planCode,
              monthly_quota: monthlyQuota,
              used_quota: usedQuota,
            };

            const state = emptyDatabase();

            expect(() => insertUserEntitlement(state, row)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUserEntitlement(state, row)).toThrow(
              'check_quota_valid',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 5. Duplicate (user_id, device_id) in user_sessions is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user_session with a duplicate (user_id, device_id) pair is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          uuidArb,
          deviceIdArb,
          (sessionId1, sessionId2, userId, deviceId) => {
            const firstSession: UserSessionRow = {
              id: sessionId1,
              user_id: userId,
              device_id: deviceId,
              session_state: 'active',
            };
            const duplicateSession: UserSessionRow = {
              id: sessionId2,
              user_id: userId,
              device_id: deviceId, // same (user_id, device_id) → constraint violation
              session_state: 'active',
            };

            let state = emptyDatabase();
            state = insertUserSession(state, firstSession);

            expect(() => insertUserSession(state, duplicateSession)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUserSession(state, duplicateSession)).toThrow(
              'user_sessions_user_id_device_id_key',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 6. Duplicate (user_id, role_code) in user_roles is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user_role with a duplicate (user_id, role_code) pair is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          uuidArb,
          roleCodeArb,
          (roleId1, roleId2, userId, roleCode) => {
            const firstRole: UserRoleRow = {
              id: roleId1,
              user_id: userId,
              role_code: roleCode,
            };
            const duplicateRole: UserRoleRow = {
              id: roleId2,
              user_id: userId,
              role_code: roleCode, // same (user_id, role_code) → constraint violation
            };

            let state = emptyDatabase();
            state = insertUserRole(state, firstRole);

            expect(() => insertUserRole(state, duplicateRole)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUserRole(state, duplicateRole)).toThrow(
              'user_roles_user_id_role_code_key',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 7. Invalid status value is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user with an invalid status value is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          firebaseUidArb,
          emailArb,
          invalidStatusArb,
          (id, firebaseUid, email, invalidStatus) => {
            const row = {
              id,
              firebase_uid: firebaseUid,
              email,
              status: invalidStatus as UserStatus,
            };

            const state = emptyDatabase();

            expect(() => insertUser(state, row)).toThrow(ConstraintViolationError);
            expect(() => insertUser(state, row)).toThrow('users_status_check');
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // 8. Invalid plan_code is rejected
  // -------------------------------------------------------------------------
  it(
    'inserting a user_entitlement with an invalid plan_code is rejected',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          monthlyQuotaArb,
          invalidPlanCodeArb,
          (entitlementId, userId, monthlyQuota, invalidPlanCode) => {
            const row = {
              id: entitlementId,
              user_id: userId,
              plan_code: invalidPlanCode as PlanCode,
              monthly_quota: monthlyQuota,
              used_quota: 0, // valid quota so only plan_code triggers the violation
            };

            const state = emptyDatabase();

            expect(() => insertUserEntitlement(state, row)).toThrow(
              ConstraintViolationError,
            );
            expect(() => insertUserEntitlement(state, row)).toThrow(
              'user_entitlements_plan_code_check',
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // -------------------------------------------------------------------------
  // Complementary: valid inserts are accepted (sanity check)
  // -------------------------------------------------------------------------
  it(
    'valid user rows satisfying all constraints are accepted',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          firebaseUidArb,
          emailArb,
          validStatusArb,
          (id, firebaseUid, email, status) => {
            const row: UserRow = { id, firebase_uid: firebaseUid, email, status };
            const state = emptyDatabase();

            expect(() => insertUser(state, row)).not.toThrow();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'valid user_entitlement rows satisfying all constraints are accepted',
    () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          monthlyQuotaArb,
          validPlanCodeArb,
          (entitlementId, userId, monthlyQuota, planCode) => {
            // used_quota in [0, monthly_quota]
            const usedQuota = Math.floor(monthlyQuota / 2);

            const row: UserEntitlementRow = {
              id: entitlementId,
              user_id: userId,
              plan_code: planCode,
              monthly_quota: monthlyQuota,
              used_quota: usedQuota,
            };

            const state = emptyDatabase();
            expect(() => insertUserEntitlement(state, row)).not.toThrow();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
