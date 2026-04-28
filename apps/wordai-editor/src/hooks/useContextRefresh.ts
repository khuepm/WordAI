/**
 * useContextRefresh — React hook for refreshing the Access Context after
 * receiving error responses that indicate server-side state has changed.
 *
 * When the Bridge API returns ACCOUNT_SUSPENDED, SESSION_REVOKED, or
 * AI_QUOTA_EXCEEDED, the client must call GET /auth/context to fetch the
 * latest authorization state and update the store.
 *
 * Requirements: 13.12
 */

import { useCallback } from 'react';
import { useAuthState } from '../services/authStore';
import { refreshAccessContext } from '../services/authService';
import { requiresContextRefresh } from '../services/authService';
import type { BridgeErrorCodeValue } from '../types/auth';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseContextRefreshReturn {
  /**
   * Refresh the Access Context from the Bridge API.
   *
   * Fetches a fresh GET /auth/context response and updates the auth store.
   * If the refresh fails (e.g. session is fully revoked), the auth state is
   * cleared so the user is returned to the guest state.
   *
   * Requirements: 13.12
   */
  refreshContext: () => Promise<void>;

  /**
   * Handle a Bridge API error code.
   *
   * If the error code is one that requires a context refresh
   * (ACCOUNT_SUSPENDED, SESSION_REVOKED, AI_QUOTA_EXCEEDED), this function
   * automatically calls refreshContext.
   *
   * Requirements: 13.12
   */
  handleBridgeError: (code: BridgeErrorCodeValue) => Promise<void>;
}

export function useContextRefresh(): UseContextRefreshReturn {
  const { authState, refreshContext: storeRefreshContext, clearAuth } = useAuthState();

  const refreshContext = useCallback(async (): Promise<void> => {
    const sessionId = authState.accessContext?.session.id;
    if (!sessionId) {
      // No active session — nothing to refresh, ensure guest state
      clearAuth();
      return;
    }

    const freshContext = await refreshAccessContext(sessionId);
    if (freshContext) {
      // Update the store with the latest context; aiAccessState is re-derived
      storeRefreshContext(freshContext);
    } else {
      // Refresh failed (session fully revoked, network error, etc.) — clear auth
      clearAuth();
    }
  }, [authState.accessContext, storeRefreshContext, clearAuth]);

  const handleBridgeError = useCallback(
    async (code: BridgeErrorCodeValue): Promise<void> => {
      // Only refresh for the three error codes that indicate server-side state change
      // Requirements: 13.12
      if (requiresContextRefresh(code)) {
        await refreshContext();
      }
    },
    [refreshContext],
  );

  return { refreshContext, handleBridgeError };
}
