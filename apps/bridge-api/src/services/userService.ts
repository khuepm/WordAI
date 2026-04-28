/**
 * User upsert service — in-memory model.
 *
 * Implements the user upsert logic for the Bridge API using an in-memory
 * database state. This design allows the core business logic to be tested
 * without a real database connection.
 *
 * Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 5.3
 */

import { FirebaseClaims } from '../auth/firebaseVerifier';
import { UserStatus, RiskLevel, PlanCode } from '../types/index';
import { normalizeEmail } from '../utils/emailUtils';

// ---------------------------------------------------------------------------
// In-memory record types
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: UserStatus;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface EntitlementRecord {
  id: string;
  user_id: string;
  ai_enabled: boolean;
  plan_code: PlanCode;
  monthly_quota: number;
  used_quota: number;
  quota_reset_at: string;
  allowed_models: string[];
  max_requests_per_minute: number;
}

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

export interface DatabaseState {
  users: UserRecord[];
  entitlements: EntitlementRecord[];
  auditLogs: AuditLogRecord[];
}

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
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Compute the first day of the next month as an ISO 8601 string.
 */
function nextMonthResetDate(): string {
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return resetDate.toISOString();
}

// ---------------------------------------------------------------------------
// Default free-plan entitlement values
// ---------------------------------------------------------------------------

const FREE_PLAN_DEFAULTS = {
  ai_enabled: true,
  plan_code: 'free' as PlanCode,
  monthly_quota: 100,
  used_quota: 0,
  allowed_models: ['gpt-3.5-turbo'],
  max_requests_per_minute: 10,
};

// ---------------------------------------------------------------------------
// upsertUser
// ---------------------------------------------------------------------------

export interface UpsertUserResult {
  /** Updated database state after the upsert operation. */
  state: DatabaseState;
  /** The user record that was created or updated. */
  user: UserRecord;
  /** True if this was a new user creation; false for an existing user update. */
  isNew: boolean;
}

/**
 * Upsert a user record based on Firebase claims.
 *
 * **First login (new user)**:
 * - Creates a user record with firebase_uid, normalized email, display_name,
 *   avatar_url, and status="pending".
 * - Creates a default `user_entitlements` record (free plan).
 * - Creates an audit_log entry with action "user_created".
 *
 * **Subsequent logins (existing user)**:
 * - Updates display_name, avatar_url, and last_login_at only.
 * - Never modifies firebase_uid, email, status, or risk_level.
 *
 * This function is pure: it takes the current state and returns a new state,
 * making it straightforward to test with property-based tests.
 *
 * Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 5.3
 *
 * @param state - Current in-memory database state.
 * @param claims - Verified Firebase claims from the ID token.
 * @returns New database state, the upserted user record, and whether it was new.
 */
export function upsertUser(
  state: DatabaseState,
  claims: FirebaseClaims,
): UpsertUserResult {
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(claims.email);

  // Look up existing user by firebase_uid
  const existingUserIndex = state.users.findIndex(
    (u) => u.firebase_uid === claims.firebase_uid,
  );

  if (existingUserIndex !== -1) {
    // -----------------------------------------------------------------------
    // Existing user — update mutable fields only (Req 2.3, 2.4)
    // -----------------------------------------------------------------------
    const existingUser = state.users[existingUserIndex];

    const updatedUser: UserRecord = {
      ...existingUser,
      // Only these three fields are updated on subsequent logins (Req 2.3)
      display_name: claims.display_name,
      avatar_url: claims.avatar_url,
      last_login_at: now,
      updated_at: now,
      // firebase_uid, email, status, risk_level are intentionally NOT updated (Req 2.4)
    };

    const updatedUsers = [...state.users];
    updatedUsers[existingUserIndex] = updatedUser;

    return {
      state: {
        ...state,
        users: updatedUsers,
      },
      user: updatedUser,
      isNew: false,
    };
  }

  // -------------------------------------------------------------------------
  // New user — create user record, entitlement, and audit log (Req 1.5, 2.1, 2.2, 5.3)
  // -------------------------------------------------------------------------
  const userId = generateId();

  const newUser: UserRecord = {
    id: userId,
    firebase_uid: claims.firebase_uid,
    email: normalizedEmail,           // Normalized email (Req 2.9)
    display_name: claims.display_name,
    avatar_url: claims.avatar_url,
    status: 'pending',                // New users start as pending (Req 2.2, 3.2)
    risk_level: 'low',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  // Default free-plan entitlement (Req 5.3)
  const newEntitlement: EntitlementRecord = {
    id: generateId(),
    user_id: userId,
    ...FREE_PLAN_DEFAULTS,
    quota_reset_at: nextMonthResetDate(),
  };

  // Audit log entry for user creation (Req 1.11, 10.2)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: null,   // System action — no human actor
    action: 'user_created',
    resource: 'user',
    resource_id: userId,
    before_data: null,
    after_data: newUser,
    created_at: now,
  };

  return {
    state: {
      users: [...state.users, newUser],
      entitlements: [...state.entitlements, newEntitlement],
      auditLogs: [...state.auditLogs, auditLog],
    },
    user: newUser,
    isNew: true,
  };
}

// ---------------------------------------------------------------------------
// Factory helper for empty database state
// ---------------------------------------------------------------------------

/**
 * Create an empty in-memory database state.
 * Useful as a starting point for tests.
 */
export function createEmptyState(): DatabaseState {
  return {
    users: [],
    entitlements: [],
    auditLogs: [],
  };
}
