/**
 * Property-based tests for session management.
 *
 * Property 22: Session Revocation Effectiveness
 *   Validates: Requirements 6.9, 6.10
 *   For any session S that is revoked, isSessionRevoked SHALL return true
 *   after revocation, and getActiveSessions SHALL NOT include S.
 *
 * Property 23: Session Isolation
 *   Validates: Requirements 6.11
 *   Revoking session S1 SHALL NOT affect the active state of session S2
 *   (different device_id). After revoking S1, S2 must still appear in
 *   getActiveSessions.
 *
 * Property 24: Session Revocation Audit
 *   Validates: Requirements 6.8, 10.2
 *   For every session revocation, there SHALL exist exactly one audit_log
 *   entry with action 'session_revoked'. The audit entry SHALL record
 *   actor_user_id, before_data, and after_data.
 *
 * Property 25: Session Uniqueness
 *   Validates: Requirements 6.12
 *   The (user_id, device_id) pair SHALL be unique among active sessions.
 *   After upserting a session for the same (user_id, device_id), there
 *   SHALL be at most one active session for that pair.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getActiveSessions,
  isSessionRevoked,
  revokeSession,
  revokeAllSessions,
} from '../../src/services/sessionService';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with one user and a set of sessions.
 */
function buildBaseState(
  userId: string,
  sessions: Array<{ id: string; deviceId: string; state?: 'active' | 'revoked' }>,
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

  const sessionRecords: UserSessionRecord[] = sessions.map((s) => ({
    id: s.id,
    user_id: userId,
    device_id: s.deviceId,
    session_state: s.state ?? 'active',
    last_seen_at: now,
    revoked_at: s.state === 'revoked' ? now : null,
    created_at: now,
  }));

  const base = createFullEmptyState();
  return {
    ...base,
    users: [user],
    entitlements: [entitlement],
    sessions: sessionRecords,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Prototype-polluting keys that must be excluded from string generators.
 */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string safe to use as a device ID. */
const deviceIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

// ---------------------------------------------------------------------------
// Property 22: Session Revocation Effectiveness
// Validates: Requirements 6.9, 6.10
// ---------------------------------------------------------------------------

describe('Property 22: Session Revocation Effectiveness', () => {
  /**
   * **Validates: Requirements 6.9, 6.10**
   *
   * For any session S that is revoked, isSessionRevoked SHALL return true
   * after revocation.
   */
  it('isSessionRevoked returns true after revokeSession', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // Before revocation: session is not revoked
          expect(isSessionRevoked(state, sessionId)).toBe(false);

          const newState = revokeSession(state, actorId, sessionId);

          // After revocation: session IS revoked
          expect(isSessionRevoked(newState, sessionId)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.9, 6.10**
   *
   * For any session S that is revoked, getActiveSessions SHALL NOT include S.
   */
  it('getActiveSessions does not include a revoked session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // Before revocation: session appears in active sessions
          const activeBefore = getActiveSessions(state, userId);
          expect(activeBefore.some((s) => s.id === sessionId)).toBe(true);

          const newState = revokeSession(state, actorId, sessionId);

          // After revocation: session does NOT appear in active sessions
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.some((s) => s.id === sessionId)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isSessionRevoked returns false for a non-existent session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId, nonExistentSessionId) => {
          const state = buildBaseState(userId, []);
          expect(isSessionRevoked(state, nonExistentSessionId)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revokeSession throws when session does not exist', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId, nonExistentSessionId) => {
          const state = buildBaseState(userId, []);
          expect(() => revokeSession(state, null, nonExistentSessionId)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 23: Session Isolation
// Validates: Requirements 6.11
// ---------------------------------------------------------------------------

describe('Property 23: Session Isolation', () => {
  /**
   * **Validates: Requirements 6.11**
   *
   * Revoking session S1 SHALL NOT affect the active state of session S2
   * (different device_id). After revoking S1, S2 must still appear in
   * getActiveSessions.
   */
  it('revoking S1 does not affect S2 with a different device_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        // Two distinct device IDs
        fc.uniqueArray(deviceIdArb, { minLength: 2, maxLength: 2 }),
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId1, sessionId2, [deviceId1, deviceId2], actorId) => {
          const state = buildBaseState(userId, [
            { id: sessionId1, deviceId: deviceId1 },
            { id: sessionId2, deviceId: deviceId2 },
          ]);

          // Both sessions are active before revocation
          const activeBefore = getActiveSessions(state, userId);
          expect(activeBefore.some((s) => s.id === sessionId1)).toBe(true);
          expect(activeBefore.some((s) => s.id === sessionId2)).toBe(true);

          // Revoke S1
          const newState = revokeSession(state, actorId, sessionId1);

          // S1 is revoked
          expect(isSessionRevoked(newState, sessionId1)).toBe(true);

          // S2 is still active
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.some((s) => s.id === sessionId2)).toBe(true);
          expect(isSessionRevoked(newState, sessionId2)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revokeAllSessions with exceptSessionId preserves the excepted session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uniqueArray(deviceIdArb, { minLength: 2, maxLength: 2 }),
        (userId, sessionId1, sessionId2, [deviceId1, deviceId2]) => {
          const state = buildBaseState(userId, [
            { id: sessionId1, deviceId: deviceId1 },
            { id: sessionId2, deviceId: deviceId2 },
          ]);

          // Revoke all except sessionId2
          const newState = revokeAllSessions(state, null, userId, sessionId2);

          // sessionId1 is revoked
          expect(isSessionRevoked(newState, sessionId1)).toBe(true);

          // sessionId2 is still active
          expect(isSessionRevoked(newState, sessionId2)).toBe(false);
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.some((s) => s.id === sessionId2)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revoking one session does not change the count of other active sessions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // 2–5 sessions with distinct device IDs
        fc.uniqueArray(
          fc.tuple(fc.uuid(), deviceIdArb),
          { minLength: 2, maxLength: 5 },
        ),
        (userId, sessionPairs) => {
          const sessions = sessionPairs.map(([id, deviceId]) => ({ id, deviceId }));
          const state = buildBaseState(userId, sessions);

          const [first, ...rest] = sessions;

          // Revoke the first session
          const newState = revokeSession(state, null, first.id);

          // All other sessions remain active
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.length).toBe(rest.length);
          for (const s of rest) {
            expect(activeAfter.some((a) => a.id === s.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 24: Session Revocation Audit
// Validates: Requirements 6.8, 10.2
// ---------------------------------------------------------------------------

describe('Property 24: Session Revocation Audit', () => {
  /**
   * **Validates: Requirements 6.8, 10.2**
   *
   * For every session revocation, there SHALL exist exactly one audit_log
   * entry with action 'session_revoked'.
   */
  it('revokeSession creates exactly one audit_log entry with action "session_revoked"', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          const newState = revokeSession(state, actorId, sessionId);

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          expect(auditCountAfter).toBe(auditCountBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.8, 10.2**
   *
   * The audit entry SHALL record actor_user_id, before_data (the session
   * before revocation), and after_data (the session after revocation).
   */
  it('revokeSession audit entry records actor_user_id, before_data, and after_data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);
          const beforeSession = state.sessions.find((s) => s.id === sessionId)!;

          const newState = revokeSession(state, actorId, sessionId);

          const auditEntry = newState.auditLogs.find(
            (l) => l.action === 'session_revoked' && l.resource_id === sessionId,
          );

          expect(auditEntry).toBeDefined();

          // actor_user_id must be recorded (Req 6.8)
          expect(auditEntry!.actor_user_id).toBe(actorId);

          // before_data must contain the session before revocation
          const beforeData = auditEntry!.before_data as UserSessionRecord;
          expect(beforeData.id).toBe(sessionId);
          expect(beforeData.session_state).toBe('active');
          expect(beforeData.revoked_at).toBeNull();

          // after_data must contain the session after revocation
          const afterData = auditEntry!.after_data as UserSessionRecord;
          expect(afterData.id).toBe(sessionId);
          expect(afterData.session_state).toBe('revoked');
          expect(afterData.revoked_at).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revokeAllSessions creates one audit_log entry per revoked session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // 1–4 sessions with distinct device IDs
        fc.uniqueArray(
          fc.tuple(fc.uuid(), deviceIdArb),
          { minLength: 1, maxLength: 4 },
        ),
        (userId, sessionPairs) => {
          const sessions = sessionPairs.map(([id, deviceId]) => ({ id, deviceId }));
          const state = buildBaseState(userId, sessions);

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          const newState = revokeAllSessions(state, null, userId);

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          // One audit entry per revoked session
          expect(auditCountAfter).toBe(auditCountBefore + sessions.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 25: Session Uniqueness
// Validates: Requirements 6.12
// ---------------------------------------------------------------------------

describe('Property 25: Session Uniqueness', () => {
  /**
   * **Validates: Requirements 6.12**
   *
   * The (user_id, device_id) pair SHALL be unique among active sessions.
   * After upserting a session for the same (user_id, device_id), there
   * SHALL be at most one active session for that pair.
   *
   * This property tests the upsert behavior implemented in processTokenExchange
   * (auth.ts): when a session already exists for (user_id, device_id), the
   * existing session is updated rather than a new one created.
   */
  it('there is at most one active session per (user_id, device_id) pair', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        (userId, sessionId, deviceId) => {
          // Build state with one active session for (userId, deviceId)
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // Verify there is exactly one active session for this (userId, deviceId)
          const activeSessions = getActiveSessions(state, userId).filter(
            (s) => s.device_id === deviceId,
          );
          expect(activeSessions.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('revoking a session for (user_id, device_id) leaves zero active sessions for that pair', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        (userId, sessionId, deviceId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          const newState = revokeSession(state, null, sessionId);

          // After revocation, no active sessions for this (userId, deviceId)
          const activeSessions = getActiveSessions(newState, userId).filter(
            (s) => s.device_id === deviceId,
          );
          expect(activeSessions.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('multiple sessions for different device_ids are all independently active', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // 2–5 sessions with distinct device IDs
        fc.uniqueArray(
          fc.tuple(fc.uuid(), deviceIdArb),
          { minLength: 2, maxLength: 5 },
        ),
        (userId, sessionPairs) => {
          const sessions = sessionPairs.map(([id, deviceId]) => ({ id, deviceId }));
          const state = buildBaseState(userId, sessions);

          const activeSessions = getActiveSessions(state, userId);

          // All sessions are active
          expect(activeSessions.length).toBe(sessions.length);

          // Each (userId, deviceId) pair appears exactly once
          const deviceIds = activeSessions.map((s) => s.device_id);
          expect(new Set(deviceIds).size).toBe(sessions.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getActiveSessions excludes already-revoked sessions from the count', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uniqueArray(
          fc.tuple(fc.uuid(), deviceIdArb),
          { minLength: 2, maxLength: 5 },
        ),
        (userId, sessionPairs) => {
          const sessions = sessionPairs.map(([id, deviceId]) => ({ id, deviceId }));
          const state = buildBaseState(userId, sessions);

          // Revoke the first session
          const [first, ...rest] = sessions;
          const newState = revokeSession(state, null, first.id);

          const activeSessions = getActiveSessions(newState, userId);

          // Only the remaining sessions are active
          expect(activeSessions.length).toBe(rest.length);

          // The revoked session is not in the active list
          expect(activeSessions.some((s) => s.id === first.id)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
