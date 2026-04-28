/**
 * firebaseAuth — Firebase Authentication adapter for the Client App.
 *
 * Abstracts Firebase Auth operations behind a simple interface so that:
 * 1. The rest of the app does not import Firebase SDK directly.
 * 2. Tests can inject a mock implementation without patching globals.
 *
 * In production the real Firebase SDK is used. In tests a mock is injected
 * via `setFirebaseAuthAdapter`.
 *
 * Requirements: 1.1, 7.1
 */

// ---------------------------------------------------------------------------
// Firebase Auth adapter interface
// ---------------------------------------------------------------------------

/**
 * Minimal Firebase Auth adapter interface.
 * Only the operations needed by the login/logout flow are included.
 */
export interface FirebaseAuthAdapter {
  /**
   * Sign in with email and password.
   * Returns the Firebase ID token on success.
   * Throws on failure (wrong password, user not found, etc.).
   *
   * Requirements: 1.1
   */
  signInWithEmailAndPassword(email: string, password: string): Promise<string>;

  /**
   * Sign out the currently authenticated Firebase user.
   * Requirements: 7.1
   */
  signOut(): Promise<void>;

  /**
   * Get the current user's ID token, refreshing it if necessary.
   * Returns null when no user is signed in.
   */
  getCurrentIdToken(): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Default (stub) adapter
// ---------------------------------------------------------------------------

/**
 * Default stub adapter used before the real Firebase adapter is configured.
 *
 * The real Firebase Auth adapter must be registered at application startup
 * by calling `setFirebaseAuthAdapter` with a concrete implementation that
 * uses the Firebase JS SDK.  This keeps the Firebase SDK out of the bundle
 * for environments where it is not needed (unit tests, Storybook, etc.).
 *
 * Example production setup (in main.tsx or a firebase.ts initializer):
 *
 * ```ts
 * import { initializeApp } from 'firebase/app';
 * import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
 * import { setFirebaseAuthAdapter } from './services/firebaseAuth';
 *
 * const app = initializeApp({ apiKey: '...', authDomain: '...', projectId: '...' });
 * const auth = getAuth(app);
 *
 * setFirebaseAuthAdapter({
 *   signInWithEmailAndPassword: async (email, password) => {
 *     const cred = await signInWithEmailAndPassword(auth, email, password);
 *     return cred.user.getIdToken();
 *   },
 *   signOut: () => signOut(auth),
 *   getCurrentIdToken: async () => auth.currentUser?.getIdToken() ?? null,
 * });
 * ```
 */
class StubFirebaseAuthAdapter implements FirebaseAuthAdapter {
  async signInWithEmailAndPassword(_email: string, _password: string): Promise<string> {
    throw new Error(
      '[firebaseAuth] No Firebase adapter configured. ' +
      'Call setFirebaseAuthAdapter() at application startup.',
    );
  }

  async signOut(): Promise<void> {
    throw new Error(
      '[firebaseAuth] No Firebase adapter configured. ' +
      'Call setFirebaseAuthAdapter() at application startup.',
    );
  }

  async getCurrentIdToken(): Promise<string | null> {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Adapter registry — allows tests to inject a mock
// ---------------------------------------------------------------------------

let _adapter: FirebaseAuthAdapter = new StubFirebaseAuthAdapter();

/**
 * Replace the Firebase Auth adapter.
 * Use this in tests to inject a mock without touching the real Firebase SDK.
 *
 * @example
 * setFirebaseAuthAdapter({
 *   signInWithEmailAndPassword: async () => 'mock-id-token',
 *   signOut: async () => {},
 *   getCurrentIdToken: async () => 'mock-id-token',
 * });
 */
export function setFirebaseAuthAdapter(adapter: FirebaseAuthAdapter): void {
  _adapter = adapter;
}

/** Reset the adapter to the stub (no-op) implementation. */
export function resetFirebaseAuthAdapter(): void {
  _adapter = new StubFirebaseAuthAdapter();
}

// ---------------------------------------------------------------------------
// Public API — delegates to the current adapter
// ---------------------------------------------------------------------------

/**
 * Sign in with email and password via Firebase Auth.
 * Returns the Firebase ID token on success.
 * Requirements: 1.1
 */
export async function firebaseSignIn(
  email: string,
  password: string,
): Promise<string> {
  return _adapter.signInWithEmailAndPassword(email, password);
}

/**
 * Sign out the currently authenticated Firebase user.
 * Requirements: 7.1
 */
export async function firebaseSignOut(): Promise<void> {
  return _adapter.signOut();
}

/**
 * Get the current user's Firebase ID token.
 * Returns null when no user is signed in.
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  return _adapter.getCurrentIdToken();
}
