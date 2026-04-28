/**
 * Property-based tests for user lifecycle state machine.
 *
 * Property 9: State Machine Validity
 *   Validates: Requirements 3.1–3.10
 *   For any sequence of valid transitions, the final status SHALL be reachable
 *   through the defined state machine.
 *
 * Property 10: Status Change Audit Completeness
 *   Validates: Requirements 3.11, 3.12, 10.2
 *   For every status change, there SHALL exist exactly one corresponding
 *   audit_log entry with action "user_status_changed".
 *
 * Property 11: Deleted Status Irreversibility
 *   Validates: Requirements 3.8
 *   Once status reaches "deleted", no sequence of operations SHALL change it
 *   to another status.
 *
 * Property 12: Suspended User Session Prevention
 *   Validates: Requirements 3.14
 *   When a user's status is deleted or suspended, new session creation SHALL
 *   be prevented.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UserStatus } from '../../src/types/index';
import {
  validateStatusTransition,
  changeUserStatus,
  canCreateSession,
} from '../../src/services/userLifecycle';
import {
  createFullEmptyState,
  FullDatabaseState,
} from '../../src/services/accessContextService';
import { UserRecord } from '../../src/services/userService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STATUSES: UserStatus[] = ['pending', 'active', 'suspended', 'deleted'];

/**
 * Build a FullDatabaseState containing a single user with the given status.
 */
function buildStateWithUser(
  userId: string,
  status: UserStatus,
): FullDatabaseState {
  const now = new Date().toISOString();

  const user: UserRecord = {
    id: userId,
    firebase_uid: `uid-${userId}`,
    email: `user-${userId}@example.com`,
    display_name: 'Test User',
    avatar_url: null,
    status,
    risk_level: 'low',
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  return {
    ...createFullEmptyState(),
    users: [user],
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid UserStatus value. */
const userStatusArb = fc.constantFrom<UserStatus>(...ALL_STATUSES);

/**
 * Generates a sequence of valid status transitions starting from a given
 * initial status. Each step in the sequence is a valid transition from the
 * current status.
 *
 * Returns an array of statuses visited (including the initial status).
 */
function validTransitionSequenceArb(
  initialStatus: UserStatus,
): fc.Arbitrary<UserStatus[]> {
  return fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 0, maxLength: 8 }).map(
    (indices) => {
      const visited: UserStatus[] = [initialStatus];
      let current = initialStatus;

      for (const idx of indices) {
        // Find all valid next statuses from current
        const validNext = ALL_STATUSES.filter((s) =>
          validateStatusTransition(current, s),
        );
        if (validNext.length === 0) break;

        const next = validNext[idx % validNext.length];
        visited.push(next);
        current = next;
      }

      return visited;
    },
  );
}

// ---------------------------------------------------------------------------
// Property 9: State Machine Validity
// Validates: Requirements 3.1–3.10
// ---------------------------------------------------------------------------

describe('Property 9: State Machine Validity', () => {
  /**
   * **Validates: Requirements 3.1–3.10**
   *
   * For any sequence of valid transitions, the final status SHALL be reachable
   * through the defined state machine rules.
   */
  it('every step in a valid transition sequence is permitted by the state machine', () => {
    fc.assert(
      fc.property(
        userStatusArb,
        (initialStatus) => {
          const sequence = fc.sample(
            validTransitionSequenceArb(initialStatus),
            1,
          )[0];

          // Every consecutive pair in the sequence must be a valid transition
          for (let i = 0; i < sequence.length - 1; i++) {
            const from = sequence[i];
            const to = sequence[i + 1];
            expect(validateStatusTransition(from, to)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('allowed transitions are exactly: pending→active, active→suspended, active→deleted, suspended→active, suspended→deleted', () => {
    const allowedPairs: [UserStatus, UserStatus][] = [
      ['pending', 'active'],
      ['active', 'suspended'],
      ['active', 'deleted'],
      ['suspended', 'active'],
      ['suspended', 'deleted'],
    ];

    // All allowed pairs must return true
    for (const [from, to] of allowedPairs) {
      expect(validateStatusTransition(from, to)).toBe(true);
    }

    // All other pairs (excluding same→same) must return false
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (from === to) continue;
        const isAllowed = allowedPairs.some(([f, t]) => f === from && t === to);
        expect(validateStatusTransition(from, to)).toBe(isAllowed);
      }
    }
  });

  it('deleted status has no valid outgoing transitions', () => {
    fc.assert(
      fc.property(userStatusArb, (to) => {
        // deleted → any is always invalid (Req 3.8)
        expect(validateStatusTransition('deleted', to)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('pending status cannot transition to suspended or deleted', () => {
    // Req 3.9, 3.10
    expect(validateStatusTransition('pending', 'suspended')).toBe(false);
    expect(validateStatusTransition('pending', 'deleted')).toBe(false);
  });

  it('same-status transitions are always invalid', () => {
    fc.assert(
      fc.property(userStatusArb, (status) => {
        expect(validateStatusTransition(status, status)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('changeUserStatus applies valid transitions correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // Walk a valid path: pending → active → suspended → active → deleted
          const path: [UserStatus, UserStatus][] = [
            ['pending', 'active'],
            ['active', 'suspended'],
            ['suspended', 'active'],
            ['active', 'deleted'],
          ];

          let state = buildStateWithUser(userId, 'pending');

          for (const [, to] of path) {
            state = changeUserStatus(state, null, userId, to);
            const user = state.users.find((u) => u.id === userId)!;
            expect(user.status).toBe(to);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('changeUserStatus throws for invalid transitions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // pending → suspended is invalid (Req 3.9)
          const state = buildStateWithUser(userId, 'pending');
          expect(() =>
            changeUserStatus(state, null, userId, 'suspended'),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Deleted Status Irreversibility
// Validates: Requirements 3.8
// ---------------------------------------------------------------------------

describe('Property 11: Deleted Status Irreversibility', () => {
  /**
   * **Validates: Requirements 3.8**
   *
   * Once status reaches "deleted", no sequence of operations SHALL change it
   * to another status.
   */
  it('no transition is allowed from deleted status', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        userStatusArb,
        (userId, targetStatus) => {
          const state = buildStateWithUser(userId, 'deleted');

          // Any attempt to change status from deleted must throw
          expect(() =>
            changeUserStatus(state, null, userId, targetStatus),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user status remains deleted after failed transition attempts', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          const state = buildStateWithUser(userId, 'deleted');

          // Attempt all possible transitions — all must fail
          for (const targetStatus of ALL_STATUSES) {
            let finalState = state;
            try {
              finalState = changeUserStatus(state, null, userId, targetStatus);
            } catch {
              // Expected — transition is invalid
            }

            // The user's status must still be 'deleted'
            const user = finalState.users.find((u) => u.id === userId)!;
            expect(user.status).toBe('deleted');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('deleted status is preserved after reaching it through a valid path', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // Reach deleted via: pending → active → deleted
          let state = buildStateWithUser(userId, 'pending');
          state = changeUserStatus(state, null, userId, 'active');
          state = changeUserStatus(state, null, userId, 'deleted');

          // Verify status is deleted
          const user = state.users.find((u) => u.id === userId)!;
          expect(user.status).toBe('deleted');

          // Attempt to change status — must fail
          expect(() =>
            changeUserStatus(state, null, userId, 'active'),
          ).toThrow();
          expect(() =>
            changeUserStatus(state, null, userId, 'pending'),
          ).toThrow();
          expect(() =>
            changeUserStatus(state, null, userId, 'suspended'),
          ).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('soft delete retains the user record with status=deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          let state = buildStateWithUser(userId, 'pending');
          state = changeUserStatus(state, null, userId, 'active');
          state = changeUserStatus(state, null, userId, 'deleted');

          // The user record must still exist (soft delete — Req 3.13)
          const user = state.users.find((u) => u.id === userId);
          expect(user).toBeDefined();
          expect(user!.status).toBe('deleted');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Status Change Audit Completeness
// Validates: Requirements 3.11, 3.12, 10.2
// ---------------------------------------------------------------------------

describe('Property 10: Status Change Audit Completeness', () => {
  /**
   * **Validates: Requirements 3.11, 3.12, 10.2**
   *
   * For every status change, there SHALL exist exactly one corresponding
   * audit_log entry with action "user_status_changed".
   */
  it('exactly one audit_log entry is created per status change', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, actorId) => {
          // pending → active
          const state = buildStateWithUser(userId, 'pending');
          const auditCountBefore = state.auditLogs.filter(
            (l) => l.action === 'user_status_changed',
          ).length;

          const newState = changeUserStatus(state, actorId, userId, 'active');

          const auditCountAfter = newState.auditLogs.filter(
            (l) => l.action === 'user_status_changed',
          ).length;

          expect(auditCountAfter).toBe(auditCountBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('audit log entry records actor_user_id, before_data, and after_data', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        (userId, actorId) => {
          const state = buildStateWithUser(userId, 'pending');
          const originalUser = state.users.find((u) => u.id === userId)!;

          const newState = changeUserStatus(state, actorId, userId, 'active');

          const auditEntry = newState.auditLogs.find(
            (l) => l.action === 'user_status_changed' && l.resource_id === userId,
          );

          expect(auditEntry).toBeDefined();
          // actor_user_id must be recorded (Req 3.12)
          expect(auditEntry!.actor_user_id).toBe(actorId);
          // before_data must contain the original user record (Req 3.12)
          expect((auditEntry!.before_data as UserRecord).status).toBe('pending');
          expect((auditEntry!.before_data as UserRecord).id).toBe(userId);
          // after_data must contain the updated user record (Req 3.12)
          expect((auditEntry!.after_data as UserRecord).status).toBe('active');
          expect((auditEntry!.after_data as UserRecord).id).toBe(userId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('each step in a multi-step transition sequence produces exactly one audit log', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // Walk: pending → active → suspended → active → deleted (4 transitions)
          const transitions: UserStatus[] = ['active', 'suspended', 'active', 'deleted'];
          let state = buildStateWithUser(userId, 'pending');

          for (let i = 0; i < transitions.length; i++) {
            const auditCountBefore = state.auditLogs.filter(
              (l) => l.action === 'user_status_changed',
            ).length;

            state = changeUserStatus(state, null, userId, transitions[i]);

            const auditCountAfter = state.auditLogs.filter(
              (l) => l.action === 'user_status_changed',
            ).length;

            // Exactly one new audit log per transition
            expect(auditCountAfter).toBe(auditCountBefore + 1);
          }

          // Total: 4 audit log entries for 4 transitions
          const totalAuditEntries = state.auditLogs.filter(
            (l) => l.action === 'user_status_changed',
          ).length;
          expect(totalAuditEntries).toBe(4);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('audit log entry has the correct resource and resource_id', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          const state = buildStateWithUser(userId, 'pending');
          const newState = changeUserStatus(state, null, userId, 'active');

          const auditEntry = newState.auditLogs.find(
            (l) => l.action === 'user_status_changed',
          );

          expect(auditEntry).toBeDefined();
          expect(auditEntry!.resource).toBe('user');
          expect(auditEntry!.resource_id).toBe(userId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Suspended User Session Prevention
// Validates: Requirements 3.14
// ---------------------------------------------------------------------------

describe('Property 12: Suspended User Session Prevention', () => {
  /**
   * **Validates: Requirements 3.14**
   *
   * When a user's status is deleted or suspended, new session creation SHALL
   * be prevented.
   */
  it('canCreateSession returns false for suspended users', () => {
    expect(canCreateSession('suspended')).toBe(false);
  });

  it('canCreateSession returns false for deleted users', () => {
    expect(canCreateSession('deleted')).toBe(false);
  });

  it('canCreateSession returns true for active users', () => {
    expect(canCreateSession('active')).toBe(true);
  });

  it('canCreateSession returns true for pending users', () => {
    expect(canCreateSession('pending')).toBe(true);
  });

  it('canCreateSession returns false for any suspended or deleted status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<UserStatus>('suspended', 'deleted'),
        (status) => {
          expect(canCreateSession(status)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('canCreateSession returns true for any non-suspended, non-deleted status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<UserStatus>('pending', 'active'),
        (status) => {
          expect(canCreateSession(status)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after suspending a user, canCreateSession returns false', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // pending → active → suspended
          let state = buildStateWithUser(userId, 'pending');
          state = changeUserStatus(state, null, userId, 'active');
          state = changeUserStatus(state, null, userId, 'suspended');

          const user = state.users.find((u) => u.id === userId)!;
          expect(canCreateSession(user.status)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after deleting a user, canCreateSession returns false', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // pending → active → deleted
          let state = buildStateWithUser(userId, 'pending');
          state = changeUserStatus(state, null, userId, 'active');
          state = changeUserStatus(state, null, userId, 'deleted');

          const user = state.users.find((u) => u.id === userId)!;
          expect(canCreateSession(user.status)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after reactivating a suspended user, canCreateSession returns true', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (userId) => {
          // pending → active → suspended → active
          let state = buildStateWithUser(userId, 'pending');
          state = changeUserStatus(state, null, userId, 'active');
          state = changeUserStatus(state, null, userId, 'suspended');
          state = changeUserStatus(state, null, userId, 'active');

          const user = state.users.find((u) => u.id === userId)!;
          expect(canCreateSession(user.status)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
