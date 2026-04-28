/**
 * Property 38: Client State Derivation Determinism
 *
 * For any Access Context (or null), deriveAIAccessState SHALL:
 *   1. Always return one of the four valid states.
 *   2. Be deterministic — calling it twice with the same input returns the same result.
 *   3. Return "guest" when context is null.
 *   4. Return "active" iff status=active, used_quota < monthly_quota, ai_enabled=true.
 *   5. Return "quota_exceeded" iff status=active and used_quota >= monthly_quota.
 *   6. Return "suspended" iff status=suspended or status=deleted.
 *   7. Return "guest" when status=pending.
 *
 * Validates: Requirements 13.2–13.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { deriveAIAccessState } from './aiAccessState';
import type { AccessContext, AIAccessState, UserStatus } from '../types/auth';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const userStatusArb = fc.constantFrom<UserStatus>(
  'pending',
  'active',
  'suspended',
  'deleted',
);

/** Build a minimal but structurally valid AccessContext for property testing. */
function accessContextArb(
  statusOverride?: UserStatus,
  aiEnabledOverride?: boolean,
  usedQuotaOverride?: number,
  monthlyQuotaOverride?: number,
): fc.Arbitrary<AccessContext> {
  return fc
    .record({
      status: statusOverride !== undefined
        ? fc.constant(statusOverride)
        : userStatusArb,
      ai_enabled: aiEnabledOverride !== undefined
        ? fc.constant(aiEnabledOverride)
        : fc.boolean(),
      monthly_quota: monthlyQuotaOverride !== undefined
        ? fc.constant(monthlyQuotaOverride)
        : fc.integer({ min: 1, max: 10_000 }),
    })
    .chain(({ status, ai_enabled, monthly_quota }) => {
      const usedQuotaGen =
        usedQuotaOverride !== undefined
          ? fc.constant(usedQuotaOverride)
          : fc.integer({ min: 0, max: monthly_quota + 5 }); // allow slightly over for edge cases
      return usedQuotaGen.map((used_quota) => ({
        user: {
          id: 'user-1',
          firebase_uid: 'firebase-uid-1',
          email: 'test@example.com',
          display_name: 'Test User',
          avatar_url: null,
          status,
          last_login_at: new Date().toISOString(),
        },
        roles: ['user'],
        permissions: ['ai.use'],
        entitlement: {
          ai_enabled,
          plan_code: 'free' as const,
          monthly_quota,
          used_quota,
          quota_reset_at: new Date().toISOString(),
          allowed_models: ['gpt-3.5-turbo'],
          max_requests_per_minute: 10,
        },
        session: {
          id: 'session-1',
          device_id: 'device-1',
          session_state: 'active' as const,
          last_seen_at: new Date().toISOString(),
        },
      }));
    });
}

const validStates: AIAccessState[] = ['guest', 'active', 'quota_exceeded', 'suspended'];

// ---------------------------------------------------------------------------
// Property 38a: Output is always one of the four valid states
// ---------------------------------------------------------------------------

describe('Property 38a: Output is always a valid AIAccessState', () => {
  it('returns a valid state for any AccessContext', () => {
    fc.assert(
      fc.property(accessContextArb(), (ctx) => {
        const result = deriveAIAccessState(ctx);
        expect(validStates).toContain(result);
      }),
      { numRuns: 200 },
    );
  });

  it('returns a valid state when context is null', () => {
    const result = deriveAIAccessState(null);
    expect(validStates).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// Property 38b: Determinism — same input always produces same output
// ---------------------------------------------------------------------------

describe('Property 38b: Determinism — same input always produces same output', () => {
  it('calling deriveAIAccessState twice with the same context returns the same result', () => {
    fc.assert(
      fc.property(accessContextArb(), (ctx) => {
        const first = deriveAIAccessState(ctx);
        const second = deriveAIAccessState(ctx);
        expect(first).toBe(second);
      }),
      { numRuns: 200 },
    );
  });

  it('returns "guest" for null on every call', () => {
    fc.assert(
      fc.property(fc.constant(null), (ctx) => {
        expect(deriveAIAccessState(ctx)).toBe('guest');
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 38c: Req 13.4 — null context → "guest"
// ---------------------------------------------------------------------------

describe('Property 38c: Req 13.4 — null context returns "guest"', () => {
  it('deriveAIAccessState(null) === "guest"', () => {
    expect(deriveAIAccessState(null)).toBe('guest');
  });
});

// ---------------------------------------------------------------------------
// Property 38d: Req 13.5 — "active" iff status=active, quota not exceeded, ai_enabled=true
// ---------------------------------------------------------------------------

describe('Property 38d: Req 13.5 — "active" state conditions', () => {
  it('returns "active" for any context where status=active, used_quota < monthly_quota, ai_enabled=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }).chain((monthly) =>
          fc.integer({ min: 0, max: monthly - 1 }).map((used) => ({
            monthly,
            used,
          })),
        ),
        ({ monthly, used }) => {
          const ctx = buildContext('active', true, used, monthly);
          expect(deriveAIAccessState(ctx)).toBe('active');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does NOT return "active" when ai_enabled=false (even if quota available)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }).chain((monthly) =>
          fc.integer({ min: 0, max: monthly - 1 }).map((used) => ({
            monthly,
            used,
          })),
        ),
        ({ monthly, used }) => {
          const ctx = buildContext('active', false, used, monthly);
          expect(deriveAIAccessState(ctx)).not.toBe('active');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 38e: Req 13.6 — "quota_exceeded" iff status=active and used_quota >= monthly_quota
// ---------------------------------------------------------------------------

describe('Property 38e: Req 13.6 — "quota_exceeded" state conditions', () => {
  it('returns "quota_exceeded" when status=active and used_quota >= monthly_quota', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }).chain((monthly) =>
          fc.integer({ min: monthly, max: monthly + 1_000 }).map((used) => ({
            monthly,
            used,
          })),
        ),
        fc.boolean(), // ai_enabled should not matter when quota is exceeded
        ({ monthly, used }, aiEnabled) => {
          const ctx = buildContext('active', aiEnabled, used, monthly);
          expect(deriveAIAccessState(ctx)).toBe('quota_exceeded');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does NOT return "quota_exceeded" when used_quota < monthly_quota', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }).chain((monthly) =>
          fc.integer({ min: 0, max: monthly - 1 }).map((used) => ({
            monthly,
            used,
          })),
        ),
        ({ monthly, used }) => {
          const ctx = buildContext('active', true, used, monthly);
          expect(deriveAIAccessState(ctx)).not.toBe('quota_exceeded');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 38f: Req 13.7 — "suspended" when status=suspended or status=deleted
// ---------------------------------------------------------------------------

describe('Property 38f: Req 13.7 — "suspended" state conditions', () => {
  it('returns "suspended" for any context where status=suspended', () => {
    fc.assert(
      fc.property(accessContextArb('suspended'), (ctx) => {
        expect(deriveAIAccessState(ctx)).toBe('suspended');
      }),
      { numRuns: 100 },
    );
  });

  it('returns "suspended" for any context where status=deleted', () => {
    fc.assert(
      fc.property(accessContextArb('deleted'), (ctx) => {
        expect(deriveAIAccessState(ctx)).toBe('suspended');
      }),
      { numRuns: 100 },
    );
  });

  it('does NOT return "suspended" when status=active and quota is available and ai_enabled=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }).chain((monthly) =>
          fc.integer({ min: 0, max: monthly - 1 }).map((used) => ({
            monthly,
            used,
          })),
        ),
        ({ monthly, used }) => {
          const ctx = buildContext('active', true, used, monthly);
          expect(deriveAIAccessState(ctx)).not.toBe('suspended');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 38g: "pending" status → "guest"
// ---------------------------------------------------------------------------

describe('Property 38g: pending status returns "guest"', () => {
  it('returns "guest" for any context where status=pending', () => {
    fc.assert(
      fc.property(accessContextArb('pending'), (ctx) => {
        expect(deriveAIAccessState(ctx)).toBe('guest');
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 38h: Boundary — used_quota === monthly_quota is "quota_exceeded"
// ---------------------------------------------------------------------------

describe('Property 38h: Boundary — used_quota === monthly_quota', () => {
  it('returns "quota_exceeded" when used_quota exactly equals monthly_quota', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.boolean(),
        (quota, aiEnabled) => {
          const ctx = buildContext('active', aiEnabled, quota, quota);
          expect(deriveAIAccessState(ctx)).toBe('quota_exceeded');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns "active" when used_quota is exactly one less than monthly_quota and ai_enabled=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10_000 }),
        (quota) => {
          const ctx = buildContext('active', true, quota - 1, quota);
          expect(deriveAIAccessState(ctx)).toBe('active');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildContext(
  status: UserStatus,
  ai_enabled: boolean,
  used_quota: number,
  monthly_quota: number,
): AccessContext {
  return {
    user: {
      id: 'user-1',
      firebase_uid: 'firebase-uid-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      status,
      last_login_at: new Date().toISOString(),
    },
    roles: ['user'],
    permissions: ['ai.use'],
    entitlement: {
      ai_enabled,
      plan_code: 'free',
      monthly_quota,
      used_quota,
      quota_reset_at: new Date().toISOString(),
      allowed_models: ['gpt-3.5-turbo'],
      max_requests_per_minute: 10,
    },
    session: {
      id: 'session-1',
      device_id: 'device-1',
      session_state: 'active',
      last_seen_at: new Date().toISOString(),
    },
  };
}
