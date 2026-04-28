/**
 * Property-based tests for Firebase token verification.
 *
 * Property 3: Firebase UID Extraction Correctness
 *   Validates: Requirements 1.4
 *
 * Property 4: Invalid Token Rejection
 *   Validates: Requirements 1.10, 11.1–11.5
 *
 * Approach: The setup file (tests/setup.ts) injects a mock for 'firebase-admin'
 * into Node's require cache before any test runs. This ensures that the lazy
 * require('firebase-admin') inside verifyFirebaseToken receives the mock.
 * The shared mockVerifyIdToken spy is imported from the setup module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { mockVerifyIdToken } from '../setup';

// Import the module under test AFTER the mock is in place (setup runs first).
import { verifyFirebaseToken } from '../../src/auth/firebaseVerifier';
import { AppError } from '../../src/errors/AppError';
import { ErrorCode } from '../../src/types/index';

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockVerifyIdToken.mockReset();
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty string that looks like a Firebase UID.
 * Firebase UIDs are 28-character alphanumeric strings, but we test with
 * arbitrary non-empty strings to cover the full input space.
 */
const firebaseUidArb = fc.string({ minLength: 1, maxLength: 128 }).filter(
  (s) => s.trim().length > 0,
);

/**
 * Generates an arbitrary token string (any non-empty string).
 * For Property 4 we don't need a valid JWT — we just need strings that
 * the mocked verifyIdToken will reject.
 */
const invalidTokenArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 512 }),
  fc.constant('expired.token.here'),
  fc.constant('wrong.signature.token'),
  fc.constant('wrong.issuer.token'),
  fc.constant('wrong.audience.token'),
  fc.constant('malformed'),
);

// ---------------------------------------------------------------------------
// Property 4: Invalid Token Rejection
// Validates: Requirements 1.10, 11.1–11.5
// ---------------------------------------------------------------------------

describe('Property 4: Invalid Token Rejection', () => {
  /**
   * **Validates: Requirements 1.10, 11.1–11.5**
   *
   * For any invalid Firebase ID token (expired, wrong signature, wrong issuer,
   * wrong audience), token verification SHALL fail and return TOKEN_EXPIRED_OR_INVALID.
   */
  it('rejects any token when verifyIdToken throws, returning TOKEN_EXPIRED_OR_INVALID', async () => {
    await fc.assert(
      fc.asyncProperty(invalidTokenArb, async (token) => {
        // Arrange: mock verifyIdToken to simulate any SDK-level rejection
        mockVerifyIdToken.mockRejectedValueOnce(
          new Error('Firebase: Token verification failed'),
        );

        // Act & Assert
        await expect(verifyFirebaseToken(token)).rejects.toSatisfy(
          (err: unknown) => {
            if (!(err instanceof AppError)) return false;
            return (
              err.code === ErrorCode.TOKEN_EXPIRED_OR_INVALID &&
              err.statusCode === 401
            );
          },
        );
      }),
      { numRuns: 100 },
    );
  });

  it('rejects expired tokens with TOKEN_EXPIRED_OR_INVALID', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(
      new Error('Firebase ID token has expired'),
    );
    await expect(verifyFirebaseToken('expired.jwt.token')).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.code === ErrorCode.TOKEN_EXPIRED_OR_INVALID &&
        err.statusCode === 401,
    );
  });

  it('rejects tokens with wrong signature with TOKEN_EXPIRED_OR_INVALID', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(
      new Error('Firebase ID token has invalid signature'),
    );
    await expect(
      verifyFirebaseToken('wrong.signature.token'),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.code === ErrorCode.TOKEN_EXPIRED_OR_INVALID &&
        err.statusCode === 401,
    );
  });

  it('rejects tokens with wrong issuer with TOKEN_EXPIRED_OR_INVALID', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(
      new Error('Firebase ID token has incorrect "iss" (issuer) claim'),
    );
    await expect(verifyFirebaseToken('wrong.issuer.token')).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.code === ErrorCode.TOKEN_EXPIRED_OR_INVALID &&
        err.statusCode === 401,
    );
  });

  it('rejects tokens with wrong audience with TOKEN_EXPIRED_OR_INVALID', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(
      new Error('Firebase ID token has incorrect "aud" (audience) claim'),
    );
    await expect(
      verifyFirebaseToken('wrong.audience.token'),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppError &&
        err.code === ErrorCode.TOKEN_EXPIRED_OR_INVALID &&
        err.statusCode === 401,
    );
  });

  it('always throws AppError (not a raw Error) on rejection', async () => {
    await fc.assert(
      fc.asyncProperty(invalidTokenArb, async (token) => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error('any sdk error'));

        let thrown: unknown;
        try {
          await verifyFirebaseToken(token);
        } catch (err) {
          thrown = err;
        }

        // Must be an AppError, not a raw Error
        expect(thrown).toBeInstanceOf(AppError);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Firebase UID Extraction Correctness
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('Property 3: Firebase UID Extraction Correctness', () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * For any valid Firebase ID token, extracting the Firebase UID SHALL return
   * the value from the token's `uid` claim.
   */
  it('extracts firebase_uid matching the uid claim for any valid token', async () => {
    await fc.assert(
      fc.asyncProperty(
        firebaseUidArb,
        fc.emailAddress(),
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
        fc.option(fc.webUrl(), { nil: null }),
        async (uid, email, name, picture) => {
          // Arrange: mock verifyIdToken to resolve with a decoded token
          mockVerifyIdToken.mockResolvedValueOnce({
            uid,
            email,
            name: name ?? undefined,
            picture: picture ?? undefined,
          });

          // Act
          const claims = await verifyFirebaseToken('valid.token.string');

          // Assert: firebase_uid must equal the uid from the decoded token
          expect(claims.firebase_uid).toBe(uid);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('preserves email from decoded token claims', async () => {
    await fc.assert(
      fc.asyncProperty(
        firebaseUidArb,
        fc.emailAddress(),
        async (uid, email) => {
          mockVerifyIdToken.mockResolvedValueOnce({
            uid,
            email,
            name: undefined,
            picture: undefined,
          });

          const claims = await verifyFirebaseToken('valid.token.string');
          expect(claims.email).toBe(email);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns empty string for email when claim is absent', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'test-uid-123',
      email: undefined,
      name: undefined,
      picture: undefined,
    });

    const claims = await verifyFirebaseToken('valid.token.string');
    expect(claims.email).toBe('');
  });

  it('returns null for display_name when name claim is absent', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'test-uid-123',
      email: 'user@example.com',
      name: undefined,
      picture: undefined,
    });

    const claims = await verifyFirebaseToken('valid.token.string');
    expect(claims.display_name).toBeNull();
  });

  it('returns null for avatar_url when picture claim is absent', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'test-uid-123',
      email: 'user@example.com',
      name: 'Test User',
      picture: undefined,
    });

    const claims = await verifyFirebaseToken('valid.token.string');
    expect(claims.avatar_url).toBeNull();
  });

  it('maps all claims correctly for a fully-populated decoded token', async () => {
    await fc.assert(
      fc.asyncProperty(
        firebaseUidArb,
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.webUrl(),
        async (uid, email, name, picture) => {
          mockVerifyIdToken.mockResolvedValueOnce({
            uid,
            email,
            name,
            picture,
          });

          const claims = await verifyFirebaseToken('valid.token.string');

          expect(claims.firebase_uid).toBe(uid);
          expect(claims.email).toBe(email);
          expect(claims.display_name).toBe(name);
          expect(claims.avatar_url).toBe(picture);
        },
      ),
      { numRuns: 100 },
    );
  });
});
