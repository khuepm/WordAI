/**
 * Property-based tests for the token exchange handler.
 *
 * Property 1: Token Exchange Idempotence
 *   Validates: Requirements 1.1, 1.5, 15.1
 *   Multiple token exchanges with the same Firebase_ID_Token SHALL produce
 *   equivalent Access Context results (excluding timestamps).
 *
 * Property 34: Rate Limiting Effectiveness
 *   Validates: Requirements 11.8–11.10
 *   For N+1 requests in a time window with limit N, exactly N SHALL succeed
 *   and 1 SHALL fail with RATE_LIMIT_EXCEEDED.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FirebaseClaims } from '../../src/auth/firebaseVerifier';
import {
  processTokenExchange,
  checkRateLimit,
  createRateLimiterState,
  RateLimiterState,
} from '../../src/routes/auth';
import {
  createFullEmptyState,
  FullDatabaseState,
} from '../../src/services/accessContextService';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty string safe for use as an identifier. */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

/** Firebase UID: non-empty, up to 128 chars. */
const firebaseUidArb = fc
  .string({ minLength: 1, maxLength: 128 })
  .filter((s) => s.trim().length > 0);

/** Device ID: non-empty string. */
const deviceIdArb = nonEmptyStringArb;

/** Optional display name. */
const displayNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }),
  { nil: null },
);

/** Optional avatar URL. */
const avatarUrlArb = fc.option(fc.webUrl(), { nil: null });

/** Complete FirebaseClaims object. */
const firebaseClaimsArb: fc.Arbitrary<FirebaseClaims> = fc.record({
  firebase_uid: firebaseUidArb,
  email: fc.emailAddress(),
  display_name: displayNameArb,
  avatar_url: avatarUrlArb,
});

// ---------------------------------------------------------------------------
// Property 1: Token Exchange Idempotence
// Validates: Requirements 1.1, 1.5, 15.1
// ---------------------------------------------------------------------------

describe('Property 1: Token Exchange Idempotence', () => {
  /**
   * **Validates: Requirements 1.1, 1.5, 15.1**
   *
   * Multiple token exchanges with the same Firebase_ID_Token (same claims and
   * deviceId) SHALL produce equivalent Access Context results, excluding
   * timestamps (last_seen_at, last_login_at, quota_reset_at).
   */
  it('two exchanges with the same claims and deviceId produce the same user.firebase_uid', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        // First exchange
        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        // Second exchange (using the state produced by the first)
        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // The firebase_uid in the Access Context must be identical
        expect(response2.user.firebase_uid).toBe(response1.user.firebase_uid);
      }),
      { numRuns: 100 },
    );
  });

  it('two exchanges with the same claims and deviceId produce the same roles', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // Roles must be identical (order-independent)
        expect(new Set(response2.roles)).toEqual(new Set(response1.roles));
      }),
      { numRuns: 100 },
    );
  });

  it('two exchanges with the same claims and deviceId produce the same permissions', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // Permissions must be identical (order-independent)
        expect(new Set(response2.permissions)).toEqual(
          new Set(response1.permissions),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('two exchanges with the same claims and deviceId produce the same user.id', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // The user ID must be stable across exchanges
        expect(response2.user.id).toBe(response1.user.id);
      }),
      { numRuns: 100 },
    );
  });

  it('two exchanges with the same claims and deviceId produce the same session.device_id', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // The device_id in the session must match the input
        expect(response1.session.device_id).toBe(deviceId);
        expect(response2.session.device_id).toBe(deviceId);
      }),
      { numRuns: 100 },
    );
  });

  it('two exchanges with the same claims and deviceId produce the same entitlement plan', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        // Entitlement plan and quota settings must be stable
        expect(response2.entitlement.plan_code).toBe(
          response1.entitlement.plan_code,
        );
        expect(response2.entitlement.monthly_quota).toBe(
          response1.entitlement.monthly_quota,
        );
        expect(response2.entitlement.ai_enabled).toBe(
          response1.entitlement.ai_enabled,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('session state is always "active" after exchange', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, deviceIdArb, (claims, deviceId) => {
        const initialState = createFullEmptyState();

        const { state: state1, response: response1 } = processTokenExchange(
          initialState,
          claims,
          deviceId,
        );

        const { response: response2 } = processTokenExchange(
          state1,
          claims,
          deviceId,
        );

        expect(response1.session.session_state).toBe('active');
        expect(response2.session.session_state).toBe('active');
      }),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('concrete example: same user exchanging twice gets same firebase_uid and roles', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-idempotence-test',
      email: 'idempotent@example.com',
      display_name: 'Idempotent User',
      avatar_url: null,
    };
    const deviceId = 'device-abc-123';

    const initialState = createFullEmptyState();

    const { state: state1, response: r1 } = processTokenExchange(
      initialState,
      claims,
      deviceId,
    );
    const { response: r2 } = processTokenExchange(state1, claims, deviceId);

    expect(r2.user.firebase_uid).toBe(r1.user.firebase_uid);
    expect(r2.user.id).toBe(r1.user.id);
    expect(r2.session.device_id).toBe(deviceId);
    expect(r2.session.session_state).toBe('active');
    expect(new Set(r2.roles)).toEqual(new Set(r1.roles));
    expect(new Set(r2.permissions)).toEqual(new Set(r1.permissions));
  });
});

// ---------------------------------------------------------------------------
// Property 34: Rate Limiting Effectiveness
// Validates: Requirements 11.8–11.10
// ---------------------------------------------------------------------------

describe('Property 34: Rate Limiting Effectiveness', () => {
  /**
   * **Validates: Requirements 11.8–11.10**
   *
   * For N+1 requests in a time window with limit N, exactly N SHALL succeed
   * and 1 SHALL fail with RATE_LIMIT_EXCEEDED.
   */
  it('exactly N requests succeed and 1 fails when N+1 requests are made within the window', () => {
    fc.assert(
      fc.property(
        // Limit N: 1–10
        fc.integer({ min: 1, max: 10 }),
        // A rate-limit key (e.g. device ID or IP)
        nonEmptyStringArb,
        (limit, key) => {
          const windowMs = 60_000; // 1 minute window
          const now = Date.now();

          let rateLimiterState: RateLimiterState = createRateLimiterState();

          let successCount = 0;
          let failureCount = 0;

          // Make N+1 requests, all within the same time window
          for (let i = 0; i < limit + 1; i++) {
            // Use the same timestamp for all requests (they're all "simultaneous")
            const { allowed, state: newState } = checkRateLimit(
              rateLimiterState,
              key,
              limit,
              windowMs,
              now,
            );
            rateLimiterState = newState;

            if (allowed) {
              successCount++;
            } else {
              failureCount++;
            }
          }

          // Exactly N should succeed and exactly 1 should fail
          expect(successCount).toBe(limit);
          expect(failureCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all N requests succeed when exactly N requests are made within the window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        nonEmptyStringArb,
        (limit, key) => {
          const windowMs = 60_000;
          const now = Date.now();

          let rateLimiterState: RateLimiterState = createRateLimiterState();
          let successCount = 0;

          // Make exactly N requests
          for (let i = 0; i < limit; i++) {
            const { allowed, state: newState } = checkRateLimit(
              rateLimiterState,
              key,
              limit,
              windowMs,
              now,
            );
            rateLimiterState = newState;
            if (allowed) successCount++;
          }

          expect(successCount).toBe(limit);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('requests outside the window do not count toward the limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        nonEmptyStringArb,
        (limit, key) => {
          const windowMs = 60_000; // 1 minute
          const pastTime = Date.now() - windowMs - 1; // Just outside the window
          const nowTime = Date.now();

          let rateLimiterState: RateLimiterState = createRateLimiterState();

          // Fill up the limit with requests in the past (outside the window)
          for (let i = 0; i < limit; i++) {
            const { state: newState } = checkRateLimit(
              rateLimiterState,
              key,
              limit,
              windowMs,
              pastTime,
            );
            rateLimiterState = newState;
          }

          // Now make a request in the current window — it should be allowed
          // because the past requests are outside the window
          const { allowed } = checkRateLimit(
            rateLimiterState,
            key,
            limit,
            windowMs,
            nowTime,
          );

          expect(allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('different keys have independent rate limits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        // Two distinct keys
        fc
          .uniqueArray(nonEmptyStringArb, { minLength: 2, maxLength: 2 }),
        (limit, [keyA, keyB]) => {
          const windowMs = 60_000;
          const now = Date.now();

          let rateLimiterState: RateLimiterState = createRateLimiterState();

          // Exhaust the limit for keyA
          for (let i = 0; i < limit; i++) {
            const { state: newState } = checkRateLimit(
              rateLimiterState,
              keyA,
              limit,
              windowMs,
              now,
            );
            rateLimiterState = newState;
          }

          // keyB should still be allowed (independent limit)
          const { allowed } = checkRateLimit(
            rateLimiterState,
            keyB,
            limit,
            windowMs,
            now,
          );

          expect(allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate limiter state is immutable — original state is not modified', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        nonEmptyStringArb,
        (limit, key) => {
          const windowMs = 60_000;
          const now = Date.now();

          const originalState: RateLimiterState = createRateLimiterState();
          const originalSize = originalState.requests.size;

          // Call checkRateLimit — should not mutate originalState
          checkRateLimit(originalState, key, limit, windowMs, now);

          // Original state must be unchanged
          expect(originalState.requests.size).toBe(originalSize);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('concrete example: limit=3, 4 requests → 3 succeed, 1 fails', () => {
    const limit = 3;
    const windowMs = 60_000;
    const now = 1_700_000_000_000; // Fixed timestamp for determinism
    const key = 'device-rate-limit-test';

    let state: RateLimiterState = createRateLimiterState();
    const results: boolean[] = [];

    for (let i = 0; i < 4; i++) {
      const { allowed, state: newState } = checkRateLimit(
        state,
        key,
        limit,
        windowMs,
        now,
      );
      state = newState;
      results.push(allowed);
    }

    expect(results).toEqual([true, true, true, false]);
  });
});
