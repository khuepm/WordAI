/**
 * Firebase token verification module.
 *
 * Provides `verifyFirebaseToken` which validates a Firebase ID token using the
 * Firebase Admin SDK and returns the extracted user claims on success.
 *
 * Design notes:
 * - Firebase Admin SDK is imported lazily (inside functions) so that the module
 *   can be loaded in test environments without triggering SDK initialization.
 * - `initializeFirebaseAdmin` is idempotent: it checks whether an app is already
 *   initialized before calling `initializeApp`.
 * - All verification failures (expired, bad signature, wrong issuer/audience)
 *   are mapped to a single `TOKEN_EXPIRED_OR_INVALID` AppError with status 401,
 *   per Requirements 11.1–11.5.
 */

import { AppError } from '../errors/AppError';
import { ErrorCode } from '../types/index';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Claims extracted from a verified Firebase ID token.
 * These are the fields the Bridge API cares about for user synchronization.
 */
export interface FirebaseClaims {
  /** Firebase UID — the `uid` claim from the token. */
  firebase_uid: string;
  /** User's email address — the `email` claim (empty string if absent). */
  email: string;
  /** User's display name — the `name` claim (null if absent). */
  display_name: string | null;
  /** URL to the user's avatar — the `picture` claim (null if absent). */
  avatar_url: string | null;
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the Firebase Admin SDK.
 *
 * Idempotent: safe to call multiple times; subsequent calls are no-ops.
 *
 * Credential resolution order:
 * 1. `GOOGLE_APPLICATION_CREDENTIALS` env var — path to a service-account JSON
 *    file; the SDK picks this up automatically via `applicationDefault()`.
 * 2. `FIREBASE_SERVICE_ACCOUNT_JSON` env var — a JSON string containing the
 *    service-account credentials (useful in containerized environments where
 *    mounting a file is inconvenient).
 *
 * @throws {Error} If neither credential source is available.
 */
export function initializeFirebaseAdmin(): void {
  // Lazy import to avoid loading the SDK at module-parse time (helps tests).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');

  // Idempotency check — if any app is already initialized, do nothing.
  if (admin.apps.length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Parse the JSON string and use it as explicit credentials.
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as object;
    } catch (parseErr) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but contains invalid JSON: ' +
          String(parseErr),
      );
    }

    // Cast through `unknown` to satisfy the SDK's ServiceAccount type without
    // importing the namespace (which isn't available via lazy require).
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as unknown as import('firebase-admin').ServiceAccount),
      ...(projectId ? { projectId } : {}),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // The SDK will automatically read the file pointed to by this env var.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  } else {
    throw new Error(
      'Firebase Admin SDK credentials are not configured. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON) ' +
        'or FIREBASE_SERVICE_ACCOUNT_JSON (JSON string).',
    );
  }
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/**
 * Verify a Firebase ID token and extract user claims.
 *
 * Validates:
 * - Token signature (via Firebase public keys — handled by the SDK)
 * - Token expiration (handled by the SDK)
 * - Issuer: must be `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`
 *   (handled by the SDK when the app is initialized with the correct project)
 * - Audience: must match `FIREBASE_PROJECT_ID` env var
 *   (handled by the SDK when the app is initialized with the correct project)
 *
 * @param idToken - The raw Firebase ID token JWT string from the client.
 * @returns Extracted `FirebaseClaims` on success.
 * @throws {AppError} with code `TOKEN_EXPIRED_OR_INVALID` (HTTP 401) on any
 *   verification failure.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseClaims> {
  // Ensure the SDK is initialized before attempting verification.
  initializeFirebaseAdmin();

  // Lazy import — same reason as in initializeFirebaseAdmin.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    return {
      firebase_uid: decodedToken.uid,
      email: decodedToken.email ?? '',
      display_name: decodedToken.name ?? null,
      avatar_url: decodedToken.picture ?? null,
    };
  } catch (err) {
    // Any error from the SDK (expired, bad signature, wrong issuer/audience,
    // malformed token, network error fetching public keys, etc.) is mapped to
    // TOKEN_EXPIRED_OR_INVALID per Requirements 11.1–11.5.
    throw new AppError(
      ErrorCode.TOKEN_EXPIRED_OR_INVALID,
      'Firebase ID token is invalid or has expired',
      401,
    );
  }
}
