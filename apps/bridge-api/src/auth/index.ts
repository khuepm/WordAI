/**
 * Auth module public API.
 *
 * Re-exports everything from the Firebase token verification module so that
 * consumers can import from `../auth` rather than the specific file path.
 */
export {
  verifyFirebaseToken,
  initializeFirebaseAdmin,
  type FirebaseClaims,
} from './firebaseVerifier';
