/**
 * Property-based tests for user profile update.
 *
 * Property 8: Profile Update Idempotence
 *   Validates: Requirements 2.6, 2.7, 15.2
 *   For any valid profile update (display_name and/or avatar_url), applying
 *   the same update twice SHALL produce the same final state as applying it
 *   once.
 *
 *   ∀ userId, updates:
 *     processUpdateProfile(processUpdateProfile(state, userId, updates).state, userId, updates).user
 *       ≡ processUpdateProfile(state, userId, updates).user
 *
 *   Also verifies that firebase_uid and email are unchanged after updates
 *   (cross-validates Property 6).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  processUpdateProfile,
} from '../../src/routes/users';
import {
  createFullEmptyState,
  FullDatabaseState,
} from '../../src/services/accessContextService';
import { UserRecord } from '../../src/services/userService';
import { UpdateProfileRequest } from '../../src/types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a FullDatabaseState with a single user record.
 */
function buildStateWithUser(user: UserRecord): FullDatabaseState {
  const base = createFullEmptyState();
  return {
    ...base,
    users: [user],
  };
}

/**
 * Create a minimal UserRecord for testing.
 */
function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date().toISOString();
  return {
    id: 'user-1',
    firebase_uid: 'firebase-uid-1',
    email: 'test@example.com',
    display_name: 'Initial Name',
    avatar_url: null,
    status: 'active',
    risk_level: 'low',
    created_at: now,
    updated_at: now,
    last_login_at: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Valid display_name: 1–100 characters.
 */
const displayNameArb = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Valid avatar_url: either null or a non-empty string.
 */
const avatarUrlArb = fc.option(
  fc.string({ minLength: 1, maxLength: 200 }),
  { nil: null },
);

/**
 * A valid UpdateProfileRequest with at least one field set.
 */
const updateRequestArb: fc.Arbitrary<UpdateProfileRequest> = fc.oneof(
  // Only display_name
  displayNameArb.map((display_name) => ({ display_name })),
  // Only avatar_url
  avatarUrlArb.map((avatar_url) => ({ avatar_url })),
  // Both fields
  fc.tuple(displayNameArb, avatarUrlArb).map(([display_name, avatar_url]) => ({
    display_name,
    avatar_url,
  })),
);

// ---------------------------------------------------------------------------
// Property 8: Profile Update Idempotence
// Validates: Requirements 2.6, 2.7, 15.2
// ---------------------------------------------------------------------------

describe('Property 8: Profile Update Idempotence', () => {
  /**
   * **Validates: Requirements 2.6, 2.7, 15.2**
   *
   * Applying the same valid profile update twice SHALL produce the same
   * UserProfile as applying it once.
   */
  it('applying the same update twice produces the same UserProfile as applying it once', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        updateRequestArb,
        (userId, updates) => {
          const user = makeUserRecord({ id: userId });
          const state = buildStateWithUser(user);

          // Apply the update once
          const firstResult = processUpdateProfile(state, userId, updates);

          // Apply the same update a second time on the resulting state
          const secondResult = processUpdateProfile(
            firstResult.state,
            userId,
            updates,
          );

          // The resulting UserProfile must be identical (idempotence)
          // Note: updated_at may differ by a few milliseconds between calls,
          // so we compare all fields except updated_at.
          expect(secondResult.user.id).toBe(firstResult.user.id);
          expect(secondResult.user.firebase_uid).toBe(firstResult.user.firebase_uid);
          expect(secondResult.user.email).toBe(firstResult.user.email);
          expect(secondResult.user.display_name).toBe(firstResult.user.display_name);
          expect(secondResult.user.avatar_url).toBe(firstResult.user.avatar_url);
          expect(secondResult.user.status).toBe(firstResult.user.status);
          expect(secondResult.user.risk_level).toBe(firstResult.user.risk_level);
          expect(secondResult.user.created_at).toBe(firstResult.user.created_at);
          expect(secondResult.user.last_login_at).toBe(firstResult.user.last_login_at);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.6, 2.7, 15.2**
   *
   * The display_name in the result SHALL equal the requested display_name.
   */
  it('display_name in result matches the requested value', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        displayNameArb,
        (userId, displayName) => {
          const user = makeUserRecord({ id: userId });
          const state = buildStateWithUser(user);

          const result = processUpdateProfile(state, userId, {
            display_name: displayName,
          });

          expect(result.user.display_name).toBe(displayName);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.6, 2.7, 15.2**
   *
   * The avatar_url in the result SHALL equal the requested avatar_url.
   */
  it('avatar_url in result matches the requested value', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        avatarUrlArb,
        (userId, avatarUrl) => {
          const user = makeUserRecord({ id: userId });
          const state = buildStateWithUser(user);

          const result = processUpdateProfile(state, userId, {
            avatar_url: avatarUrl,
          });

          expect(result.user.avatar_url).toBe(avatarUrl);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.4, 2.6, 2.7**
   * Cross-validates Property 6: firebase_uid and email SHALL be unchanged
   * after any profile update.
   */
  it('firebase_uid and email are unchanged after profile updates', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 100 }),
        updateRequestArb,
        (userId, firebaseUid, email, updates) => {
          const user = makeUserRecord({
            id: userId,
            firebase_uid: firebaseUid,
            email,
          });
          const state = buildStateWithUser(user);

          const result = processUpdateProfile(state, userId, updates);

          // Immutable fields must not change (cross-validates Property 6)
          expect(result.user.firebase_uid).toBe(firebaseUid);
          expect(result.user.email).toBe(email);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.8**
   *
   * Attempting to update a restricted field SHALL throw with PERMISSION_DENIED.
   */
  it('updating a restricted field throws PERMISSION_DENIED', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('firebase_uid', 'email', 'status', 'risk_level', 'id'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (userId, restrictedField, value) => {
          const user = makeUserRecord({ id: userId });
          const state = buildStateWithUser(user);

          const updates = { [restrictedField]: value } as any;

          expect(() => processUpdateProfile(state, userId, updates)).toThrow();

          try {
            processUpdateProfile(state, userId, updates);
          } catch (err: any) {
            expect(err.code).toBe('PERMISSION_DENIED');
            expect(err.statusCode).toBe(403);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.7**
   *
   * display_name of empty string or > 100 chars SHALL throw a validation error.
   */
  it('invalid display_name (empty or > 100 chars) throws a validation error', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.oneof(
          fc.constant(''),
          fc.string({ minLength: 101, maxLength: 200 }),
        ),
        (userId, invalidName) => {
          const user = makeUserRecord({ id: userId });
          const state = buildStateWithUser(user);

          expect(() =>
            processUpdateProfile(state, userId, { display_name: invalidName }),
          ).toThrow();

          try {
            processUpdateProfile(state, userId, { display_name: invalidName });
          } catch (err: any) {
            expect(err.statusCode).toBe(400);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
