/**
 * Property-based tests for user upsert logic.
 *
 * Property 6: Profile Field Immutability
 *   Validates: Requirements 2.4, 2.10, 2.11
 *   After any profile update, firebase_uid and email SHALL remain unchanged.
 *
 * Property 5: User Creation Audit Log
 *   Validates: Requirements 1.11, 10.2
 *   For any new user creation, an audit_log entry with action "user_created"
 *   SHALL exist after the operation completes.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FirebaseClaims } from '../../src/auth/firebaseVerifier';
import {
  upsertUser,
  createEmptyState,
  DatabaseState,
} from '../../src/services/userService';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid Firebase UID (non-empty string, up to 128 chars).
 */
const firebaseUidArb = fc
  .string({ minLength: 1, maxLength: 128 })
  .filter((s) => s.trim().length > 0);

/**
 * Generates a valid email address.
 */
const emailArb = fc.emailAddress();

/**
 * Generates optional display name (null or a non-empty string).
 */
const displayNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }),
  { nil: null },
);

/**
 * Generates optional avatar URL (null or a web URL).
 */
const avatarUrlArb = fc.option(fc.webUrl(), { nil: null });

/**
 * Generates a complete FirebaseClaims object.
 */
const firebaseClaimsArb: fc.Arbitrary<FirebaseClaims> = fc.record({
  firebase_uid: firebaseUidArb,
  email: emailArb,
  display_name: displayNameArb,
  avatar_url: avatarUrlArb,
});

/**
 * Generates a pair of FirebaseClaims objects that share the same firebase_uid
 * but may differ in other fields (simulating a returning user with updated profile).
 */
const claimsPairArb: fc.Arbitrary<[FirebaseClaims, FirebaseClaims]> = fc
  .tuple(firebaseClaimsArb, firebaseClaimsArb)
  .map(([first, second]) => [
    first,
    { ...second, firebase_uid: first.firebase_uid },
  ]);

// ---------------------------------------------------------------------------
// Property 6: Profile Field Immutability
// Validates: Requirements 2.4, 2.10, 2.11
// ---------------------------------------------------------------------------

describe('Property 6: Profile Field Immutability', () => {
  /**
   * **Validates: Requirements 2.4, 2.10, 2.11**
   *
   * After any profile update (upsert of existing user), firebase_uid and email
   * SHALL remain unchanged.
   */
  it('firebase_uid is unchanged after upsert of existing user', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        // Create the user on first login
        const emptyState = createEmptyState();
        const { state: stateAfterCreate } = upsertUser(emptyState, firstClaims);

        // Upsert again with potentially different claims (same firebase_uid)
        const { user: updatedUser } = upsertUser(stateAfterCreate, secondClaims);

        // firebase_uid must remain the same as when the user was first created
        expect(updatedUser.firebase_uid).toBe(firstClaims.firebase_uid);
      }),
      { numRuns: 100 },
    );
  });

  it('email is unchanged after upsert of existing user', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        // Create the user on first login
        const emptyState = createEmptyState();
        const { state: stateAfterCreate, user: createdUser } = upsertUser(
          emptyState,
          firstClaims,
        );

        // Upsert again with potentially different email in claims
        const { user: updatedUser } = upsertUser(stateAfterCreate, secondClaims);

        // Email must remain the same as when the user was first created
        expect(updatedUser.email).toBe(createdUser.email);
      }),
      { numRuns: 100 },
    );
  });

  it('status is unchanged after upsert of existing user', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        const emptyState = createEmptyState();
        const { state: stateAfterCreate, user: createdUser } = upsertUser(
          emptyState,
          firstClaims,
        );

        const { user: updatedUser } = upsertUser(stateAfterCreate, secondClaims);

        // Status must remain unchanged (only admin can change status)
        expect(updatedUser.status).toBe(createdUser.status);
      }),
      { numRuns: 100 },
    );
  });

  it('risk_level is unchanged after upsert of existing user', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        const emptyState = createEmptyState();
        const { state: stateAfterCreate, user: createdUser } = upsertUser(
          emptyState,
          firstClaims,
        );

        const { user: updatedUser } = upsertUser(stateAfterCreate, secondClaims);

        // risk_level must remain unchanged
        expect(updatedUser.risk_level).toBe(createdUser.risk_level);
      }),
      { numRuns: 100 },
    );
  });

  it('display_name and avatar_url are updated on subsequent login', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        const emptyState = createEmptyState();
        const { state: stateAfterCreate } = upsertUser(emptyState, firstClaims);

        const { user: updatedUser } = upsertUser(stateAfterCreate, secondClaims);

        // Mutable fields should reflect the latest claims
        expect(updatedUser.display_name).toBe(secondClaims.display_name);
        expect(updatedUser.avatar_url).toBe(secondClaims.avatar_url);
      }),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('immutable fields are preserved across multiple upserts', () => {
    const initialClaims: FirebaseClaims = {
      firebase_uid: 'uid-abc-123',
      email: 'original@example.com',
      display_name: 'Original Name',
      avatar_url: null,
    };

    const updatedClaims: FirebaseClaims = {
      firebase_uid: 'uid-abc-123',
      email: 'CHANGED@EXAMPLE.COM',  // Attempt to change email via claims
      display_name: 'Updated Name',
      avatar_url: 'https://example.com/avatar.png',
    };

    let state = createEmptyState();
    const { state: s1, user: created } = upsertUser(state, initialClaims);
    state = s1;

    const { user: updated } = upsertUser(state, updatedClaims);

    // Immutable fields unchanged
    expect(updated.firebase_uid).toBe('uid-abc-123');
    expect(updated.email).toBe('original@example.com');
    expect(updated.status).toBe('pending');

    // Mutable fields updated
    expect(updated.display_name).toBe('Updated Name');
    expect(updated.avatar_url).toBe('https://example.com/avatar.png');
  });
});

// ---------------------------------------------------------------------------
// Property 5: User Creation Audit Log
// Validates: Requirements 1.11, 10.2
// ---------------------------------------------------------------------------

describe('Property 5: User Creation Audit Log', () => {
  /**
   * **Validates: Requirements 1.11, 10.2**
   *
   * For any new user creation, an audit_log entry with action "user_created"
   * SHALL exist after the operation completes.
   */
  it('audit_log entry with action "user_created" exists after new user creation', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, (claims) => {
        const emptyState = createEmptyState();
        const { state, user } = upsertUser(emptyState, claims);

        // There must be at least one audit log entry with action "user_created"
        const auditEntry = state.auditLogs.find(
          (log) => log.action === 'user_created',
        );

        expect(auditEntry).toBeDefined();
        expect(auditEntry!.action).toBe('user_created');
        expect(auditEntry!.resource).toBe('user');
        expect(auditEntry!.resource_id).toBe(user.id);
      }),
      { numRuns: 100 },
    );
  });

  it('exactly one "user_created" audit log entry is created per new user', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, (claims) => {
        const emptyState = createEmptyState();
        const { state } = upsertUser(emptyState, claims);

        const userCreatedEntries = state.auditLogs.filter(
          (log) => log.action === 'user_created',
        );

        expect(userCreatedEntries).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });

  it('no "user_created" audit log entry is created on subsequent login', () => {
    fc.assert(
      fc.property(claimsPairArb, ([firstClaims, secondClaims]) => {
        const emptyState = createEmptyState();
        const { state: stateAfterCreate } = upsertUser(emptyState, firstClaims);

        // Second upsert (existing user)
        const { state: stateAfterUpdate } = upsertUser(
          stateAfterCreate,
          secondClaims,
        );

        // Still only one "user_created" entry (from the first upsert)
        const userCreatedEntries = stateAfterUpdate.auditLogs.filter(
          (log) => log.action === 'user_created',
        );

        expect(userCreatedEntries).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });

  it('audit log entry references the correct user id', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, (claims) => {
        const emptyState = createEmptyState();
        const { state, user } = upsertUser(emptyState, claims);

        const auditEntry = state.auditLogs.find(
          (log) => log.action === 'user_created',
        );

        expect(auditEntry).toBeDefined();
        expect(auditEntry!.resource_id).toBe(user.id);
      }),
      { numRuns: 100 },
    );
  });

  it('audit log after_data contains the created user record', () => {
    fc.assert(
      fc.property(firebaseClaimsArb, (claims) => {
        const emptyState = createEmptyState();
        const { state, user } = upsertUser(emptyState, claims);

        const auditEntry = state.auditLogs.find(
          (log) => log.action === 'user_created',
        );

        expect(auditEntry).toBeDefined();
        expect(auditEntry!.after_data).toEqual(user);
        expect(auditEntry!.before_data).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  // Example-based test for clarity
  it('creates audit log with correct fields for a specific new user', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-test-456',
      email: 'newuser@example.com',
      display_name: 'New User',
      avatar_url: null,
    };

    const emptyState = createEmptyState();
    const { state, user } = upsertUser(emptyState, claims);

    expect(state.auditLogs).toHaveLength(1);

    const auditLog = state.auditLogs[0];
    expect(auditLog.action).toBe('user_created');
    expect(auditLog.resource).toBe('user');
    expect(auditLog.resource_id).toBe(user.id);
    expect(auditLog.actor_user_id).toBeNull();
    expect(auditLog.before_data).toBeNull();
    expect(auditLog.after_data).toEqual(user);
  });
});

// ---------------------------------------------------------------------------
// Additional integration-style tests
// ---------------------------------------------------------------------------

describe('upsertUser — new user creation', () => {
  it('creates user with status "pending"', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-pending-test',
      email: 'pending@example.com',
      display_name: 'Pending User',
      avatar_url: null,
    };

    const { user } = upsertUser(createEmptyState(), claims);
    expect(user.status).toBe('pending');
  });

  it('normalizes email on creation', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-email-norm',
      email: '  UPPER@EXAMPLE.COM  ',
      display_name: null,
      avatar_url: null,
    };

    const { user } = upsertUser(createEmptyState(), claims);
    expect(user.email).toBe('upper@example.com');
  });

  it('creates default free-plan entitlement for new user', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-entitlement-test',
      email: 'entitled@example.com',
      display_name: null,
      avatar_url: null,
    };

    const { state, user } = upsertUser(createEmptyState(), claims);

    const entitlement = state.entitlements.find((e) => e.user_id === user.id);
    expect(entitlement).toBeDefined();
    expect(entitlement!.plan_code).toBe('free');
    expect(entitlement!.monthly_quota).toBe(100);
    expect(entitlement!.used_quota).toBe(0);
    expect(entitlement!.ai_enabled).toBe(true);
    expect(entitlement!.allowed_models).toContain('gpt-3.5-turbo');
  });

  it('marks isNew as true for first login', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-isnew-test',
      email: 'isnew@example.com',
      display_name: null,
      avatar_url: null,
    };

    const { isNew } = upsertUser(createEmptyState(), claims);
    expect(isNew).toBe(true);
  });

  it('marks isNew as false for subsequent login', () => {
    const claims: FirebaseClaims = {
      firebase_uid: 'uid-returning',
      email: 'returning@example.com',
      display_name: null,
      avatar_url: null,
    };

    const { state: s1 } = upsertUser(createEmptyState(), claims);
    const { isNew } = upsertUser(s1, claims);
    expect(isNew).toBe(false);
  });
});
