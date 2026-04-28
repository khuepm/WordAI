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
  EntitlementOverride,
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

// ---------------------------------------------------------------------------
// Property 17: Quota Atomicity
// Validates: Requirements 5.10, 5.11
// ---------------------------------------------------------------------------

describe('Property 17: Quota Atomicity', () => {
  /**
   * **Validates: Requirements 5.10, 5.11**
   *
   * For N sequential consumeQuota calls where usedQuota + N <= monthlyQuota,
   * exactly N SHALL succeed and used_quota SHALL increase by exactly N.
   */
  it('exactly N calls succeed and used_quota increases by exactly N when capacity allows', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        usedQuotaFractionArb,
        fc.integer({ min: 0, max: 20 }),
        (userId, monthlyQuota, usedFraction, numCalls) => {
          const usedQuota = Math.floor(usedFraction * monthlyQuota);
          // Ensure there is enough capacity for all numCalls to succeed
          const availableCapacity = monthlyQuota - usedQuota;
          const callsToMake = Math.min(numCalls, availableCapacity);

          let state = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota,
            allowedModels: ['gpt-3.5-turbo'],
          });

          let successCount = 0;
          for (let i = 0; i < callsToMake; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;
            if (result.consumed) {
              successCount++;
            }
          }

          const finalEnt = state.entitlements.find((e) => e.user_id === userId)!;
          // All calls within capacity should succeed
          expect(successCount).toBe(callsToMake);
          // used_quota should have increased by exactly the number of successful calls
          expect(finalEnt.used_quota).toBe(usedQuota + callsToMake);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('consumed count matches the actual increase in used_quota for any sequence of calls', () => {
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

          let successCount = 0;
          for (let i = 0; i < numCalls; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;
            if (result.consumed) {
              successCount++;
            }
          }

          const finalEnt = state.entitlements.find((e) => e.user_id === userId)!;
          // The increase in used_quota must equal the number of successful consumptions
          expect(finalEnt.used_quota - usedQuota).toBe(successCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: No Negative Quota
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe('Property 18: No Negative Quota', () => {
  /**
   * **Validates: Requirements 5.4**
   *
   * For any sequence of consumeQuota calls, used_quota SHALL always be >= 0.
   */
  it('used_quota is always >= 0 after any number of consumeQuota calls starting from 0', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        fc.integer({ min: 0, max: 30 }),
        (userId, monthlyQuota, numCalls) => {
          // Start from used_quota = 0
          let state = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota: 0,
            allowedModels: ['gpt-3.5-turbo'],
          });

          for (let i = 0; i < numCalls; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;

            const ent = state.entitlements.find((e) => e.user_id === userId)!;
            expect(ent.used_quota).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('consumeQuota on a user with used_quota=0 and monthly_quota=0 does not go negative', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // Edge case: zero quota
          let state = buildBaseState({
            userId,
            monthlyQuota: 0,
            usedQuota: 0,
            allowedModels: ['gpt-3.5-turbo'],
          });

          // Attempt multiple consumptions — all should be no-ops
          for (let i = 0; i < 5; i++) {
            const result = consumeQuota(state, userId);
            state = result.state;
            expect(result.consumed).toBe(false);

            const ent = state.entitlements.find((e) => e.user_id === userId)!;
            expect(ent.used_quota).toBeGreaterThanOrEqual(0);
            expect(ent.used_quota).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Quota Reset Idempotence
// Validates: Requirements 5.12, 5.13, 15.4
// ---------------------------------------------------------------------------

describe('Property 19: Quota Reset Idempotence', () => {
  /**
   * **Validates: Requirements 5.12, 5.13, 15.4**
   *
   * Calling resetQuota multiple times on the same date produces the same
   * result as calling it once.
   */
  it('calling resetQuota multiple times on the same date is idempotent', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        usedQuotaFractionArb,
        fc.integer({ min: 1, max: 10 }),
        (userId, monthlyQuota, usedFraction, repeatCount) => {
          const usedQuota = Math.floor(usedFraction * monthlyQuota);
          // Use a past reset date so the reset is always due
          const pastResetAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const now = new Date();

          const initialState = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota,
            allowedModels: ['gpt-3.5-turbo'],
            quotaResetAt: pastResetAt,
          });

          // Apply reset once
          const stateAfterOne = resetQuota(initialState, userId, now);

          // Apply reset multiple more times with the same `now`
          let stateAfterMany = stateAfterOne;
          for (let i = 1; i < repeatCount; i++) {
            stateAfterMany = resetQuota(stateAfterMany, userId, now);
          }

          const entAfterOne = stateAfterOne.entitlements.find((e) => e.user_id === userId)!;
          const entAfterMany = stateAfterMany.entitlements.find((e) => e.user_id === userId)!;

          // Idempotent: repeated calls produce the same result
          expect(entAfterMany.used_quota).toBe(entAfterOne.used_quota);
          expect(entAfterMany.quota_reset_at).toBe(entAfterOne.quota_reset_at);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('resetQuota is a no-op when now < quota_reset_at', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        usedQuotaFractionArb,
        (userId, monthlyQuota, usedFraction) => {
          const usedQuota = Math.floor(usedFraction * monthlyQuota);
          // Set reset date in the future
          const futureResetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const now = new Date(); // now is before futureResetAt

          const initialState = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota,
            allowedModels: ['gpt-3.5-turbo'],
            quotaResetAt: futureResetAt,
          });

          const stateAfterReset = resetQuota(initialState, userId, now);

          const entBefore = initialState.entitlements.find((e) => e.user_id === userId)!;
          const entAfter = stateAfterReset.entitlements.find((e) => e.user_id === userId)!;

          // State should be unchanged — reset is not yet due
          expect(entAfter.used_quota).toBe(entBefore.used_quota);
          expect(entAfter.quota_reset_at).toBe(entBefore.quota_reset_at);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('resetQuota sets used_quota=0 and advances quota_reset_at when now >= quota_reset_at', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        monthlyQuotaArb,
        usedQuotaFractionArb,
        (userId, monthlyQuota, usedFraction) => {
          const usedQuota = Math.floor(usedFraction * monthlyQuota);
          // Use a past reset date so the reset is always due
          const pastResetAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const now = new Date();

          const initialState = buildBaseState({
            userId,
            monthlyQuota,
            usedQuota,
            allowedModels: ['gpt-3.5-turbo'],
            quotaResetAt: pastResetAt,
          });

          const stateAfterReset = resetQuota(initialState, userId, now);
          const entAfter = stateAfterReset.entitlements.find((e) => e.user_id === userId)!;

          // used_quota must be reset to 0
          expect(entAfter.used_quota).toBe(0);

          // quota_reset_at must be advanced to the first day of the next month
          const expectedResetAt = nextMonthResetDate(now);
          expect(entAfter.quota_reset_at).toBe(expectedResetAt);

          // The new reset date must be in the future relative to now
          expect(new Date(entAfter.quota_reset_at).getTime()).toBeGreaterThan(now.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 20: Model Validation
// Validates: Requirements 5.8, 5.9
// ---------------------------------------------------------------------------

describe('Property 20: Model Validation', () => {
  /**
   * **Validates: Requirements 5.8, 5.9**
   *
   * For any AI request with model M, the request SHALL succeed only if M is in
   * allowed_models.
   */
  it('validateAIAccess succeeds only when the requested model is in allowed_models', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        allowedModelsArb,
        fc.integer({ min: 0, max: 4 }),
        (userId, allowedModels, modelIndex) => {
          const state = buildBaseState({
            userId,
            monthlyQuota: 100,
            usedQuota: 0,
            allowedModels,
          });

          // Pick a model that IS in allowed_models
          const allowedModel = allowedModels[modelIndex % allowedModels.length];
          const result = validateAIAccess(state, userId, allowedModel);
          expect(result.allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validateAIAccess returns MODEL_NOT_ALLOWED when model is not in allowed_models', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        allowedModelsArb,
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => s.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(s),
        ),
        (userId, allowedModels, disallowedModel) => {
          // Ensure the model is NOT in allowed_models
          fc.pre(!allowedModels.includes(disallowedModel));

          const state = buildBaseState({
            userId,
            monthlyQuota: 100,
            usedQuota: 0,
            allowedModels,
          });

          const result = validateAIAccess(state, userId, disallowedModel);
          expect(result.allowed).toBe(false);
          if (!result.allowed) {
            expect(result.errorCode).toBe(ErrorCode.MODEL_NOT_ALLOWED);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21: Entitlement Override Audit
// Validates: Requirements 5.14, 10.2
// ---------------------------------------------------------------------------

describe('Property 21: Entitlement Override Audit', () => {
  /**
   * **Validates: Requirements 5.14, 10.2**
   *
   * For any overrideEntitlement call, exactly one audit_log entry with action
   * "entitlement_overridden" SHALL be created, recording actor_user_id,
   * before_data, and after_data.
   */

  /** Arbitrary for generating random EntitlementOverride objects with optional fields. */
  const entitlementOverrideArb = fc.record(
    {
      ai_enabled: fc.boolean(),
      plan_code: fc.constantFrom('free' as const, 'pro' as const, 'enterprise' as const),
      monthly_quota: fc.integer({ min: 0, max: 10000 }),
      used_quota: fc.integer({ min: 0, max: 10000 }),
      quota_reset_at: fc
        .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        .map((d) => d.toISOString()),
      allowed_models: fc.uniqueArray(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .filter((s) => s.trim().length > 0),
        { minLength: 1, maxLength: 5 },
      ),
      max_requests_per_minute: fc.integer({ min: 1, max: 1000 }),
    },
    { requiredKeys: [] },
  ) as fc.Arbitrary<EntitlementOverride>;

  it('exactly one audit_log entry with action "entitlement_overridden" is created per override call', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        entitlementOverrideArb,
        (userId, actorIdOrNull, changes) => {
          const initialState = buildBaseState({
            userId,
            monthlyQuota: 100,
            usedQuota: 0,
            allowedModels: ['gpt-3.5-turbo'],
          });

          const auditLogsBefore = initialState.auditLogs.length;
          const newState = overrideEntitlement(initialState, actorIdOrNull, userId, changes);

          const overrideAuditLogs = newState.auditLogs.filter(
            (log) => log.action === 'entitlement_overridden',
          );

          // Exactly one new audit log entry should be created
          expect(newState.auditLogs.length).toBe(auditLogsBefore + 1);
          expect(overrideAuditLogs).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('audit log records actor_user_id, before_data, and after_data correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        entitlementOverrideArb,
        (userId, actorIdOrNull, changes) => {
          const initialState = buildBaseState({
            userId,
            monthlyQuota: 100,
            usedQuota: 10,
            allowedModels: ['gpt-3.5-turbo'],
          });

          const originalEntitlement = initialState.entitlements.find(
            (e) => e.user_id === userId,
          )!;

          const newState = overrideEntitlement(initialState, actorIdOrNull, userId, changes);

          const auditLog = newState.auditLogs.find(
            (log) => log.action === 'entitlement_overridden',
          )!;

          // actor_user_id must match the provided actorId
          expect(auditLog.actor_user_id).toBe(actorIdOrNull);

          // before_data must reflect the original entitlement
          expect(auditLog.before_data).toEqual(originalEntitlement);

          // after_data must reflect the updated entitlement
          const updatedEntitlement = newState.entitlements.find(
            (e) => e.user_id === userId,
          )!;
          expect(auditLog.after_data).toEqual(updatedEntitlement);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('before_data and after_data differ by exactly the fields that were changed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        entitlementOverrideArb,
        (userId, actorIdOrNull, changes) => {
          const initialState = buildBaseState({
            userId,
            monthlyQuota: 100,
            usedQuota: 10,
            allowedModels: ['gpt-3.5-turbo'],
          });

          const newState = overrideEntitlement(initialState, actorIdOrNull, userId, changes);

          const auditLog = newState.auditLogs.find(
            (log) => log.action === 'entitlement_overridden',
          )!;

          const before = auditLog.before_data as Record<string, unknown>;
          const after = auditLog.after_data as Record<string, unknown>;

          // Every field in changes must be reflected in after_data
          for (const [key, value] of Object.entries(changes)) {
            expect(after[key]).toEqual(value);
          }

          // Fields NOT in changes must be unchanged between before_data and after_data
          const changedKeys = new Set(Object.keys(changes));
          for (const key of Object.keys(before)) {
            if (!changedKeys.has(key)) {
              expect(after[key]).toEqual(before[key]);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
