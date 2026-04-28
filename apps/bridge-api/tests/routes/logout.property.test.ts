/**
 * Property-based tests for the logout handler.
 *
 * Property 26: Logout Completeness
 *   Validates: Requirements 7.6
 *   After logout completes, the session SHALL be revoked: isSessionRevoked
 *   returns true and the session does not appear in getActiveSessions.
 *
 * Property 27: Logout Idempotence
 *   Validates: Requirements 7.3, 7.4, 15.3
 *   Calling logout multiple times for the same session SHALL produce the
 *   same final state — the session remains revoked and no duplicate audit
 *   log entries are created.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { processLogout } from '../../src/routes/logout';
import {
  createFullEmptyState,
  FullDatabaseState,
  UserSessionRecord,
} from '../../src/services/accessContextService';
import { getActiveSessions, isSessionRevoked } from '../../src/services/sessionService';
import { UserRecord, EntitlementRecord } from '../../src/services/userService';
import { AppError } from '../../src/errors/AppError';

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

/** Prototype-polluting keys that must be excluded from string generators. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-empty string safe to use as a device ID. */
const deviceIdArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0 && !PROTOTYPE_KEYS.has(s));

// ---------------------------------------------------------------------------
// Property 26: Logout Completeness
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------

describe('Property 26: Logout Completeness', () => {
  /**
   * **Validates: Requirements 7.6**
   *
   * After logout completes, attempting to use the previous session SHALL fail:
   * isSessionRevoked SHALL return true and the session SHALL NOT appear in
   * getActiveSessions.
   */
  it('after logout, isSessionRevoked returns true for the logged-out session', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // Session is active before logout
          expect(isSessionRevoked(state, sessionId)).toBe(false);

          const { state: newState } = processLogout(state, actorId, { sessionId });

          // Session is revoked after logout
          expect(isSessionRevoked(newState, sessionId)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.6**
   *
   * After logout, the session SHALL NOT appear in getActiveSessions.
   */
  it('after logout, the session does not appear in getActiveSessions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // Session appears in active sessions before logout
          const activeBefore = getActiveSessions(state, userId);
          expect(activeBefore.some((s) => s.id === sessionId)).toBe(true);

          const { state: newState } = processLogout(state, actorId, { sessionId });

          // Session does NOT appear in active sessions after logout
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.some((s) => s.id === sessionId)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.6**
   *
   * After logout, the response SHALL include revoked=true and a non-null
   * revoked_at timestamp.
   */
  it('logout response has revoked=true and a non-null revoked_at', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          const { response } = processLogout(state, actorId, { sessionId });

          expect(response.revoked).toBe(true);
          expect(response.revoked_at).toBeTruthy();
          // revoked_at must be a valid ISO 8601 timestamp
          expect(() => new Date(response.revoked_at)).not.toThrow();
          expect(new Date(response.revoked_at).getTime()).not.toBeNaN();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.6**
   *
   * Logout SHALL create exactly one audit_log entry with action "session_revoked"
   * for the logged-out session.
   */
  it('logout creates exactly one audit_log entry with action "session_revoked"', () => {
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

          const { state: newState } = processLogout(state, actorId, { sessionId });

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
   * **Validates: Requirements 7.6**
   *
   * Logout SHALL NOT affect other active sessions belonging to the same user.
   */
  it('logout does not affect other active sessions for the same user', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uniqueArray(deviceIdArb, { minLength: 2, maxLength: 2 }),
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId1, sessionId2, [deviceId1, deviceId2], actorId) => {
          const state = buildBaseState(userId, [
            { id: sessionId1, deviceId: deviceId1 },
            { id: sessionId2, deviceId: deviceId2 },
          ]);

          // Log out session 1
          const { state: newState } = processLogout(state, actorId, {
            sessionId: sessionId1,
          });

          // Session 1 is revoked
          expect(isSessionRevoked(newState, sessionId1)).toBe(true);

          // Session 2 is still active
          expect(isSessionRevoked(newState, sessionId2)).toBe(false);
          const activeAfter = getActiveSessions(newState, userId);
          expect(activeAfter.some((s) => s.id === sessionId2)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('concrete example: logout revokes the session and returns revoked=true', () => {
    const userId = 'user-logout-test';
    const sessionId = 'session-logout-test';
    const deviceId = 'device-logout-test';

    const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

    const { state: newState, response } = processLogout(state, userId, {
      sessionId,
    });

    expect(response.revoked).toBe(true);
    expect(response.revoked_at).toBeTruthy();
    expect(isSessionRevoked(newState, sessionId)).toBe(true);
    expect(getActiveSessions(newState, userId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Property 27: Logout Idempotence
// Validates: Requirements 7.3, 7.4, 15.3
// ---------------------------------------------------------------------------

describe('Property 27: Logout Idempotence', () => {
  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * Calling logout multiple times for the same session SHALL produce the
   * same final state — the session remains revoked.
   */
  it('calling logout twice for the same session leaves the session revoked', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // First logout
          const { state: stateAfterFirst } = processLogout(state, actorId, {
            sessionId,
          });

          // Second logout (idempotent)
          const { state: stateAfterSecond } = processLogout(
            stateAfterFirst,
            actorId,
            { sessionId },
          );

          // Session is still revoked after the second call
          expect(isSessionRevoked(stateAfterSecond, sessionId)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * Calling logout multiple times SHALL return revoked=true on every call.
   */
  it('calling logout twice returns revoked=true on both calls', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          const { state: stateAfterFirst, response: response1 } = processLogout(
            state,
            actorId,
            { sessionId },
          );

          const { response: response2 } = processLogout(stateAfterFirst, actorId, {
            sessionId,
          });

          expect(response1.revoked).toBe(true);
          expect(response2.revoked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * Calling logout twice SHALL NOT create a second audit_log entry — the
   * audit log is only written on the first (actual) revocation.
   */
  it('calling logout twice does not create a duplicate audit_log entry', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          // First logout — creates one audit entry
          const { state: stateAfterFirst } = processLogout(state, actorId, {
            sessionId,
          });

          const auditCountAfterFirst = stateAfterFirst.auditLogs.filter(
            (l) => l.action === 'session_revoked' && l.resource_id === sessionId,
          ).length;

          // Second logout — must NOT create another audit entry
          const { state: stateAfterSecond } = processLogout(
            stateAfterFirst,
            actorId,
            { sessionId },
          );

          const auditCountAfterSecond = stateAfterSecond.auditLogs.filter(
            (l) => l.action === 'session_revoked' && l.resource_id === sessionId,
          ).length;

          expect(auditCountAfterFirst).toBe(1);
          expect(auditCountAfterSecond).toBe(1); // No duplicate
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * The revoked_at timestamp SHALL be preserved across repeated logout calls —
   * the second call returns the same revoked_at as the first.
   */
  it('repeated logout calls preserve the original revoked_at timestamp', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

          const { state: stateAfterFirst, response: response1 } = processLogout(
            state,
            actorId,
            { sessionId },
          );

          const { response: response2 } = processLogout(stateAfterFirst, actorId, {
            sessionId,
          });

          // The revoked_at timestamp must be the same on both calls
          expect(response2.revoked_at).toBe(response1.revoked_at);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * Logout on an already-revoked session (pre-revoked before any logout call)
   * SHALL succeed idempotently.
   */
  it('logout on a pre-revoked session returns revoked=true without error', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          // Build state with the session already revoked
          const state = buildBaseState(userId, [
            { id: sessionId, deviceId, state: 'revoked' },
          ]);

          // Logout on an already-revoked session must not throw
          expect(() =>
            processLogout(state, actorId, { sessionId }),
          ).not.toThrow();

          const { response } = processLogout(state, actorId, { sessionId });
          expect(response.revoked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.3, 7.4, 15.3**
   *
   * Logout on an already-revoked session SHALL NOT add a new audit_log entry.
   */
  it('logout on a pre-revoked session does not add a new audit_log entry', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deviceIdArb,
        fc.option(fc.uuid(), { nil: null }),
        (userId, sessionId, deviceId, actorId) => {
          const state = buildBaseState(userId, [
            { id: sessionId, deviceId, state: 'revoked' },
          ]);

          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          const { state: newState } = processLogout(state, actorId, { sessionId });

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'session_revoked',
          ).length;

          // No new audit entry for an already-revoked session
          expect(auditCountAfter).toBe(auditCountBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('concrete example: calling logout twice returns same revoked_at and no duplicate audit', () => {
    const userId = 'user-idempotent-test';
    const sessionId = 'session-idempotent-test';
    const deviceId = 'device-idempotent-test';

    const state = buildBaseState(userId, [{ id: sessionId, deviceId }]);

    const { state: state1, response: r1 } = processLogout(state, userId, {
      sessionId,
    });
    const { state: state2, response: r2 } = processLogout(state1, userId, {
      sessionId,
    });

    expect(r1.revoked).toBe(true);
    expect(r2.revoked).toBe(true);
    expect(r2.revoked_at).toBe(r1.revoked_at);

    const auditEntries = state2.auditLogs.filter(
      (l) => l.action === 'session_revoked' && l.resource_id === sessionId,
    );
    expect(auditEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe('Logout edge cases', () => {
  it('throws AppError when sessionId is missing', () => {
    const state = createFullEmptyState();

    expect(() =>
      processLogout(state, null, { sessionId: '' }),
    ).toThrow(AppError);
  });

  it('throws AppError when session is not found', () => {
    const state = createFullEmptyState();

    expect(() =>
      processLogout(state, null, { sessionId: 'non-existent-session-id' }),
    ).toThrow(AppError);
  });
});
