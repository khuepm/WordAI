/**
 * authStore — Access Context store for the Client App.
 *
 * Manages authentication state using React Context + useReducer, consistent
 * with the existing stateManager pattern in this codebase.
 *
 * Stores the Access Context received from the Bridge API after a successful
 * token exchange and exposes the derived AI access state to components.
 *
 * Requirements: 13.1, 13.2
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type { AccessContext, AIAccessState } from '../types/auth';
import { deriveAIAccessState } from './aiAccessState';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AuthState {
  /**
   * The current Access Context, or null when no session is active.
   * Set after a successful POST /auth/exchange or GET /auth/context call.
   * Requirements: 13.1
   */
  accessContext: AccessContext | null;

  /**
   * Derived AI access state — computed from accessContext on every update.
   * Never stored independently; always derived from accessContext.
   * Requirements: 13.2
   */
  aiAccessState: AIAccessState;

  /**
   * True while an auth operation (login, logout, context refresh) is in flight.
   */
  isLoading: boolean;

  /**
   * Last auth error message, or null when no error.
   */
  authError: string | null;
}

const initialState: AuthState = {
  accessContext: null,
  aiAccessState: 'guest', // Req 13.4 — no session → guest
  isLoading: false,
  authError: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type AuthAction =
  | { type: 'AUTH_LOADING' }
  | { type: 'AUTH_SUCCESS'; payload: AccessContext }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_CLEAR' }
  | { type: 'CONTEXT_REFRESHED'; payload: AccessContext };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, isLoading: true, authError: null };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        authError: null,
        accessContext: action.payload,
        // Req 13.2 — derive AI access state from the new context
        aiAccessState: deriveAIAccessState(action.payload),
      };

    case 'AUTH_ERROR':
      return {
        ...state,
        isLoading: false,
        authError: action.payload,
      };

    case 'AUTH_CLEAR':
      return {
        ...state,
        isLoading: false,
        authError: null,
        accessContext: null,
        // Req 13.4 — no session → guest
        aiAccessState: 'guest',
      };

    case 'CONTEXT_REFRESHED':
      return {
        ...state,
        accessContext: action.payload,
        // Req 13.2 — re-derive AI access state after refresh
        aiAccessState: deriveAIAccessState(action.payload),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Current authentication state. */
  authState: AuthState;

  /**
   * Mark an auth operation as in-flight.
   * Call before starting login/logout/refresh.
   */
  setAuthLoading: () => void;

  /**
   * Store a successfully obtained Access Context.
   * Automatically derives and updates aiAccessState.
   * Requirements: 13.1, 13.2
   */
  setAccessContext: (context: AccessContext) => void;

  /**
   * Record an auth error (e.g. login failure, token exchange failure).
   */
  setAuthError: (message: string) => void;

  /**
   * Clear the Access Context and reset to guest state.
   * Call after logout or session revocation.
   * Requirements: 13.4
   */
  clearAuth: () => void;

  /**
   * Update the Access Context after a GET /auth/context refresh.
   * Automatically re-derives aiAccessState.
   * Requirements: 13.12
   */
  refreshContext: (context: AccessContext) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [authState, dispatch] = useReducer(authReducer, initialState);

  const setAuthLoading = useCallback(() => {
    dispatch({ type: 'AUTH_LOADING' });
  }, []);

  const setAccessContext = useCallback((context: AccessContext) => {
    dispatch({ type: 'AUTH_SUCCESS', payload: context });
  }, []);

  const setAuthError = useCallback((message: string) => {
    dispatch({ type: 'AUTH_ERROR', payload: message });
  }, []);

  const clearAuth = useCallback(() => {
    dispatch({ type: 'AUTH_CLEAR' });
  }, []);

  const refreshContext = useCallback((context: AccessContext) => {
    dispatch({ type: 'CONTEXT_REFRESHED', payload: context });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authState,
        setAuthLoading,
        setAccessContext,
        setAuthError,
        clearAuth,
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access authentication state and actions.
 * Must be used inside AuthStateProvider.
 */
export function useAuthState(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthState must be used within AuthStateProvider');
  }
  return ctx;
}

/**
 * Convenience hook — returns only the derived AI access state.
 * Useful for components that only need to gate AI features.
 * Requirements: 13.2
 */
export function useAIAccessState(): AIAccessState {
  return useAuthState().authState.aiAccessState;
}

/**
 * Convenience hook — returns the current Access Context (may be null).
 * Requirements: 13.1
 */
export function useAccessContext(): AccessContext | null {
  return useAuthState().authState.accessContext;
}
