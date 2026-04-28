/**
 * AI quota management service — in-memory model.
 *
 * Implements AI access validation, atomic quota consumption, quota reset
 * scheduling, and entitlement override logic for the Bridge API using an
 * in-memory database state. This design allows the core business logic to be
 * tested without a real database connection.
 *
 * Requirements: 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 9.6
 */

import { ErrorCode, ErrorCodeValue } from '../types/index';
import { AuditLogRecord, EntitlementRecord } from './userService';
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

/**
 * Compute the first day of the next month relative to a given date.
 * Returns an ISO 8601 string.
 */
export function nextMonthResetDate(from: Date): string {
  const resetDate = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return resetDate.toISOString();
}

// ---------------------------------------------------------------------------
// AI access validation result
// ---------------------------------------------------------------------------

/**
 * Result of an AI access validation check.
 * On success, `allowed` is true and `errorCode` is undefined.
 * On failure, `allowed` is false and `errorCode` contains the reason.
 */
export type AIAccessResult =
  | { allowed: true }
  | { allowed: false; errorCode: ErrorCodeValue };

// ---------------------------------------------------------------------------
// validateAIAccess
// ---------------------------------------------------------------------------

/**
 * Validate whether a user is permitted to make an AI request for the given model.
 *
 * Checks (in order):
 * 1. User exists and status is "active" → ACCOUNT_SUSPENDED on failure
 * 2. User has "ai.use" permission (derived from roles) → PERMISSION_DENIED on failure
 * 3. used_quota < monthly_quota → AI_QUOTA_EXCEEDED on failure
 * 4. model is in allowed_models → MODEL_NOT_ALLOWED on failure
 *
 * Requirements: 5.5, 5.6, 5.7, 5.8, 5.9
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The user's UUID.
 * @param model  - The AI model identifier being requested.
 * @returns AIAccessResult indicating whether access is allowed and why not if denied.
 */
export function validateAIAccess(
  state: FullDatabaseState,
  userId: string,
  model: string,
): AIAccessResult {
  // Step 1: Verify user exists and status is "active" (Req 5.5)
  const user = state.users.find((u) => u.id === userId);
  if (!user || user.status !== 'active') {
    return { allowed: false, errorCode: ErrorCode.ACCOUNT_SUSPENDED };
  }

  // Step 2: Verify user has "ai.use" permission (Req 5.6)
  // Compute the user's permission set from their roles
  const userRoleCodes = state.userRoles
    .filter((ur) => ur.user_id === userId)
    .map((ur) => ur.role_code);

  const permissionSet = new Set<string>();
  for (const roleCode of userRoleCodes) {
    const rolePerms = state.rolePermissions.filter(
      (rp) => rp.role_code === roleCode,
    );
    for (const rp of rolePerms) {
      permissionSet.add(rp.permission_code);
    }
  }

  if (!permissionSet.has('ai.use')) {
    return { allowed: false, errorCode: ErrorCode.PERMISSION_DENIED };
  }

  // Step 3: Verify used_quota < monthly_quota (Req 5.7)
  const entitlement = state.entitlements.find((e) => e.user_id === userId);
  if (!entitlement || entitlement.used_quota >= entitlement.monthly_quota) {
    return { allowed: false, errorCode: ErrorCode.AI_QUOTA_EXCEEDED };
  }

  // Step 4: Verify model is in allowed_models (Req 5.8, 5.9)
  if (!entitlement.allowed_models.includes(model)) {
    return { allowed: false, errorCode: ErrorCode.MODEL_NOT_ALLOWED };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// consumeQuota
// ---------------------------------------------------------------------------

/**
 * Result of an atomic quota consumption attempt.
 */
export interface ConsumeQuotaResult {
  /** Updated database state after the consumption attempt. */
  state: FullDatabaseState;
  /** Whether quota was successfully consumed. */
  consumed: boolean;
  /** Remaining quota after this consumption (only meaningful when consumed=true). */
  remaining_quota: number;
  /** ISO 8601 timestamp when the quota will reset. */
  quota_reset_at: string;
}

/**
 * Atomically consume one unit of AI quota for a user.
 *
 * Simulates the SQL transaction:
 *   UPDATE user_entitlements
 *   SET used_quota = used_quota + 1
 *   WHERE id = ? AND used_quota < monthly_quota
 *
 * If the condition `used_quota < monthly_quota` is not met (0 rows affected),
 * the operation is a no-op and `consumed` is false.
 *
 * This function is pure: it takes the current state and returns a new state,
 * making it safe to test for atomicity and invariant properties.
 *
 * Requirements: 5.10, 5.11
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The user's UUID.
 * @returns ConsumeQuotaResult with updated state and consumption outcome.
 * @throws Error if the user's entitlement record is not found.
 */
export function consumeQuota(
  state: FullDatabaseState,
  userId: string,
): ConsumeQuotaResult {
  const entitlementIndex = state.entitlements.findIndex(
    (e) => e.user_id === userId,
  );

  if (entitlementIndex === -1) {
    throw new Error(`Entitlement not found for user: ${userId}`);
  }

  const entitlement = state.entitlements[entitlementIndex];

  // Simulate the WHERE used_quota < monthly_quota condition
  if (entitlement.used_quota >= entitlement.monthly_quota) {
    // 0 rows affected — quota exhausted, no state change
    return {
      state,
      consumed: false,
      remaining_quota: 0,
      quota_reset_at: entitlement.quota_reset_at,
    };
  }

  // Atomically increment used_quota
  const updatedEntitlement: EntitlementRecord = {
    ...entitlement,
    used_quota: entitlement.used_quota + 1,
  };

  const updatedEntitlements = [...state.entitlements];
  updatedEntitlements[entitlementIndex] = updatedEntitlement;

  const remaining = updatedEntitlement.monthly_quota - updatedEntitlement.used_quota;

  return {
    state: {
      ...state,
      entitlements: updatedEntitlements,
    },
    consumed: true,
    remaining_quota: remaining,
    quota_reset_at: updatedEntitlement.quota_reset_at,
  };
}

// ---------------------------------------------------------------------------
// resetQuota
// ---------------------------------------------------------------------------

/**
 * Reset a user's quota if the current date has reached or passed quota_reset_at.
 *
 * When reset is due:
 * - Sets used_quota to 0.
 * - Sets quota_reset_at to the first day of the next month.
 *
 * This operation is idempotent: calling it multiple times on the same date
 * produces the same result as calling it once.
 *
 * Requirements: 5.12, 5.13
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The user's UUID.
 * @param now    - Current date/time (injectable for testing).
 * @returns Updated FullDatabaseState (unchanged if reset is not yet due).
 * @throws Error if the user's entitlement record is not found.
 */
export function resetQuota(
  state: FullDatabaseState,
  userId: string,
  now: Date,
): FullDatabaseState {
  const entitlementIndex = state.entitlements.findIndex(
    (e) => e.user_id === userId,
  );

  if (entitlementIndex === -1) {
    throw new Error(`Entitlement not found for user: ${userId}`);
  }

  const entitlement = state.entitlements[entitlementIndex];
  const resetAt = new Date(entitlement.quota_reset_at);

  // Only reset if current date has reached or passed quota_reset_at
  if (now < resetAt) {
    return state;
  }

  // Compute the new reset date: first day of the month after `now`
  const newResetAt = nextMonthResetDate(now);

  const updatedEntitlement: EntitlementRecord = {
    ...entitlement,
    used_quota: 0,
    quota_reset_at: newResetAt,
  };

  const updatedEntitlements = [...state.entitlements];
  updatedEntitlements[entitlementIndex] = updatedEntitlement;

  return {
    ...state,
    entitlements: updatedEntitlements,
  };
}

// ---------------------------------------------------------------------------
// overrideEntitlement
// ---------------------------------------------------------------------------

/**
 * Allowed fields that an administrator may override on a user's entitlement.
 */
export interface EntitlementOverride {
  ai_enabled?: boolean;
  plan_code?: EntitlementRecord['plan_code'];
  monthly_quota?: number;
  used_quota?: number;
  quota_reset_at?: string;
  allowed_models?: string[];
  max_requests_per_minute?: number;
}

/**
 * Override a user's entitlement fields with administrator-supplied values.
 *
 * Steps:
 * 1. Find the user's entitlement record.
 * 2. Apply the provided changes (only the supplied fields are modified).
 * 3. Create an audit_log entry with action "entitlement_overridden".
 * 4. Return the updated state.
 *
 * Requirements: 5.14, 9.6
 *
 * @param state   - Current in-memory full database state.
 * @param actorId - ID of the administrator performing the override (null for system).
 * @param userId  - ID of the user whose entitlement is being overridden.
 * @param changes - Partial entitlement fields to apply.
 * @returns Updated FullDatabaseState with the modified entitlement and audit log.
 * @throws Error if the user's entitlement record is not found.
 */
export function overrideEntitlement(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  changes: EntitlementOverride,
): FullDatabaseState {
  const now = new Date().toISOString();

  const entitlementIndex = state.entitlements.findIndex(
    (e) => e.user_id === userId,
  );

  if (entitlementIndex === -1) {
    throw new Error(`Entitlement not found for user: ${userId}`);
  }

  const existingEntitlement = state.entitlements[entitlementIndex];

  // Apply only the supplied fields (Req 5.14)
  const updatedEntitlement: EntitlementRecord = {
    ...existingEntitlement,
    ...changes,
  };

  const updatedEntitlements = [...state.entitlements];
  updatedEntitlements[entitlementIndex] = updatedEntitlement;

  // Create audit log entry (Req 5.14, 9.6, 10.2)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'entitlement_overridden',
    resource: 'user_entitlements',
    resource_id: userId,
    before_data: existingEntitlement,
    after_data: updatedEntitlement,
    created_at: now,
  };

  return {
    ...state,
    entitlements: updatedEntitlements,
    auditLogs: [...state.auditLogs, auditLog],
  };
}
