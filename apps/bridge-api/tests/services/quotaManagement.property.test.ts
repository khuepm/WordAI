/**
 * Property-based tests for AI quota management.
 *
 * Property 16: Quota Constraint Invariant
 *   Validates: Requirements 5.4, 5.10, 5.11
 *   For any sequence of quota operations, used_quota SHALL always satisfy:
 *   0 <= used_quota <= monthly_quota.
 *
 * Property 17: Quota Atomicity
 *   Validates: Requirements 5.10, 5.11
 *   For N sequential quota consumption attempts where used_quota + N <= monthly_quota,
 *   exactly N SHALL succeed and used_quota SHALL increase by exactly N.
 *
 * Property 18: No Negative Quota
 *   Validates: Requirements 5.4
 *   For any sequence of quota operations, used_quota SHALL always be >= 0.
 *
 * Property 19: Quota Reset Idempotence
 *   Validates: Requirements 5.12, 5.13, 15.4
 *   Applying quota reset multiple times on the same date SHALL produce the same
 *   result as applying it once.
 *
 * Property 20: Model Validation
 *   Validates: Requirements 5.8, 5.9
 *   For any AI request with model M, the request SHALL succeed only if M is in
 *   allowed_models.
 *
 * Property 21: Entitlement Override Audit
 *   Validates: Requirements 5.14, 10.2
 *   For any entitlement override operation, there SHALL exist exactly one
 *   audit_log entry with action "entitlement_overridden", recording actor_user_id,
 *   before_data, and after_data.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAIAccess,
  consumeQuota,
  resetQuota,
  overrideEntitlement,
  nextMonthResetDate,
} from '../../src/services/quotaService';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';
import { ErrorCode } from '../../src/types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with one active user, one entitlement, one session,
 * and a role with ai.use permission — the minimum needed for validateAIAccess
 * to pass all checks.
 */
function buildBaseState(options: {
  userId: string;
  monthlyQuota: number;
  usedQuota: number;
  allowedModels: string[];
  quotaResetAt?: string;
}): FullDatabaseState {
  const now = new Date().toISOString();
  const {
    userId,
    monthlyQuota,
    usedQuota,
    allowedModels,
    quotaResetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  } = options;

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
    monthly_quota: monthlyQuota,
    used_quota: usedQuota,
    quota_reset_at: quotaResetAt,
    allowed_models: allowedModels,
    max_requests_per_minute: 10,
  };

  const session: UserSessionRecord = {
    id: `sess-${userId}`,
    user_id: userId,
    device_id: `device-${userId}`,
    session_state: 'active',
    last_seen_at: now,
    revoked_at: null,
    created_at: now,
  };

  const base = createFullEmptyState();
  return {
    ...base,
    users: [user],
    entitlements: [entitlement],
    sessions: [session],
    roles: [{ role_code: 'user', description: 'Standard user' }],
    permissions: [{ permission_code: 'ai.use', description: 'Use AI features' }],
    userRoles: [
      {
        id: `ur-${userId}`,
        user_id: userId,
        role_code: 'user',
        assigned_at: now,
        assigned_by: null,
      },
    ],
    rolePermissions: [{ role_code: 'user', permission_code: 'ai.use' }],
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Monthly quota between 1 and 1000. */
const monthlyQuotaArb = fc.integer({ min: 1, max: 1000 });

/** Used quota between 0 and monthly_quota (generated as a fraction). */
const usedQuotaFractionArb = fc.double({ min: 0, max: 1, noNaN: true });

/** A non-empty list of distinct model identifiers. */
const modelIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(s));

const allowedModelsArb = fc.uniqueArray(modelIdArb, { minLength: 1, maxLength: 5 });

// ---------------------------------------------------------------------------
// Property 16: Quota Constraint Invariant
// Validates: Requirements 5.4, 5.10, 5.11
// ---------------------------------------------------------------------------

describe('Property 16: Quota Constraint Invariant', () => {
  /**
   * **Validates: Requirements 5.4, 5.10, 5.11**
   *
   * For any sequence of quota operations, used_quota SHALL always satisfy:
   * 0 <= used_quota <= monthly_quota.
   */
  it('used_quota stays within [0, monthly_quota] after any number of consumeQuota calls', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        usedQuotaFractionArb,
        fc.integer({ min: 0, max: 20 }),
        (userId, monthlyQuota, usedFraction, numCalls) => {
          const usedQuota = Math.floor(usedFraction * monthlyQuota);
          let state = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota,
            allowedModels: ['gpt-3.5-turbo'],
          });

          for (let i = 0; i < numCalls; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;

            const ent = state.entitlements.find((e) => e.user_id === userId)!;
            expect(ent.used_quota).toBeGreaterThanOrEqual(0);
            expect(ent.used_quota).toBeLessThanOrEqual(ent.monthly_quota);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('used_quota never exceeds monthly_quota even when called beyond the limit', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        (userId, monthlyQuota) => {
          // Start at the limit
          let state = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota: monthlyQuota,
            allowedModels: ['gpt-3.5-turbo'],
          });

          // Try to consume more — should be a no-op
          for (let i = 0; i < 5; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;
            expect(result.consumed).toBe(false);

            const ent = state.entitlements.find((e) => e.user_id === userId)!;
            expect(ent.used_quota).toBe(monthlyQuota);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
