/**
 * useAuth — React hook for the complete Firebase login/logout flow.
 *
 * Orchestrates:
 *   Login:  Firebase signIn → Bridge API token exchange → store Access Context
 *   Logout: Bridge API session revoke → Firebase signOut → clear local cache
 *
 * Requirements: 1.1, 1.2, 7.1, 7.2, 7.5, 7.7
 */

import { useCallback } from 'react';
import { useAuthState } from '../services/authStore';
import { login, logout } from '../services/authService';
import { firebaseSignIn, firebaseSignOut } from '../services/firebaseAuth';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAuthReturn {
  /** True while a login or logout operation is in flight. */
  isLoading: boolean;
  /** Last auth error message, or null. */
  authError: string | null;

  /**
   * Sign in with email and password.
   *
   * Flow:
   * 1. Call Firebase signInWithEmailAndPassword → obtain Firebase ID token.
   * 2. POST /auth/exchange with the token and device ID → obtain Access Context.
   * 3. Store the Access Context in the auth store.
   *
   * Requirements: 1.1, 1.2
   */
  signIn: (email: string, password: string) => Promise<void>;

  /**
   * Sign out the current user.
   *
   * Flow (all three steps must complete — Req 7.7):
   * 1. POST /auth/logout to revoke the Bridge API session.
   * 2. Call Firebase signOut.
   * 3. Clear local auth cache and tokens.
   *
   * Requirements: 7.1, 7.2, 7.5, 7.7
   */
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { authState, setAuthLoading, setAccessContext, setAuthError, clearAuth } =
    useAuthState();

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setAuthLoading();
      try {
        // Step 1: Firebase authentication → Firebase ID token (Req 1.1)
        const firebaseIdToken = await firebaseSignIn(email, password);

        // Step 2 + 3: Bridge API token exchange → Access Context (Req 1.2)
        const context = await login(firebaseIdToken);

        // Store the Access Context; aiAccessState is derived automatically
        setAccessContext(context);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Login failed. Please try again.';
        setAuthError(message);
        throw err; // re-throw so callers can handle UI feedback
      }
    },
    [setAuthLoading, setAccessContext, setAuthError],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setAuthLoading();
    const sessionId = authState.accessContext?.session.id ?? null;

    try {
      // Step 1: Revoke Bridge API session (Req 7.2)
      // Step 3: Clear local auth cache (handled inside logout()) (Req 7.5)
      if (sessionId) {
        await logout(sessionId);
      }

      // Step 2: Firebase sign out (Req 7.1)
      await firebaseSignOut();

      // Clear the Access Context from the store (Req 7.7)
      clearAuth();
    } catch (err) {
      // Even on error, clear local state so the user is not stuck (Req 7.5)
      clearAuth();
      const message =
        err instanceof Error ? err.message : 'Logout failed.';
      setAuthError(message);
      // Do not re-throw — logout errors should not block the UI from clearing
    }
  }, [authState.accessContext, setAuthLoading, clearAuth, setAuthError]);

  return {
    isLoading: authState.isLoading,
    authError: authState.authError,
    signIn,
    signOut,
  };
}
