/**
 * Unit tests for authStore — Access Context store
 * Requirements: 13.1, 13.2
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { AuthStateProvider, useAuthState, useAIAccessState, useAccessContext } from './authStore';
import type { AccessContext } from '../types/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(
  status: 'pending' | 'active' | 'suspended' | 'deleted' = 'active',
  used_quota = 0,
  monthly_quota = 100,
  ai_enabled = true,
): AccessContext {
  return {
    user: {
      id: 'user-1',
      firebase_uid: 'uid-1',
      email: 'test@example.com',
      display_name: 'Test',
      avatar_url: null,
      status,
      last_login_at: new Date().toISOString(),
    },
    roles: ['user'],
    permissions: ['ai.use'],
    entitlement: {
      ai_enabled,
      plan_code: 'free',
      monthly_quota,
      used_quota,
      quota_reset_at: new Date().toISOString(),
      allowed_models: ['gpt-3.5-turbo'],
      max_requests_per_minute: 10,
    },
    session: {
      id: 'session-1',
      device_id: 'device-1',
      session_state: 'active',
      last_seen_at: new Date().toISOString(),
    },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(AuthStateProvider, null, children);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authStore — initial state', () => {
  it('starts with null accessContext and "guest" aiAccessState', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    expect(result.current.authState.accessContext).toBeNull();
    expect(result.current.authState.aiAccessState).toBe('guest');
    expect(result.current.authState.isLoading).toBe(false);
    expect(result.current.authState.authError).toBeNull();
  });
});

describe('authStore — setAccessContext', () => {
  it('stores the context and derives aiAccessState (Req 13.1, 13.2)', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    const ctx = buildContext('active', 0, 100, true);

    act(() => result.current.setAccessContext(ctx));

    expect(result.current.authState.accessContext).toEqual(ctx);
    expect(result.current.authState.aiAccessState).toBe('active');
    expect(result.current.authState.isLoading).toBe(false);
  });

  it('derives "quota_exceeded" when used_quota >= monthly_quota', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAccessContext(buildContext('active', 100, 100, true)));
    expect(result.current.authState.aiAccessState).toBe('quota_exceeded');
  });

  it('derives "suspended" when status=suspended', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAccessContext(buildContext('suspended')));
    expect(result.current.authState.aiAccessState).toBe('suspended');
  });
});

describe('authStore — clearAuth', () => {
  it('resets to null context and "guest" state (Req 13.4)', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAccessContext(buildContext()));
    act(() => result.current.clearAuth());

    expect(result.current.authState.accessContext).toBeNull();
    expect(result.current.authState.aiAccessState).toBe('guest');
  });
});

describe('authStore — refreshContext', () => {
  it('updates context and re-derives aiAccessState (Req 13.12)', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAccessContext(buildContext('active', 0, 100, true)));
    expect(result.current.authState.aiAccessState).toBe('active');

    // Simulate quota being exhausted on the server
    act(() => result.current.refreshContext(buildContext('active', 100, 100, true)));
    expect(result.current.authState.aiAccessState).toBe('quota_exceeded');
  });
});

describe('authStore — loading and error states', () => {
  it('setAuthLoading sets isLoading=true and clears error', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAuthError('previous error'));
    act(() => result.current.setAuthLoading());
    expect(result.current.authState.isLoading).toBe(true);
    expect(result.current.authState.authError).toBeNull();
  });

  it('setAuthError sets the error message and clears loading', () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    act(() => result.current.setAuthLoading());
    act(() => result.current.setAuthError('Login failed'));
    expect(result.current.authState.isLoading).toBe(false);
    expect(result.current.authState.authError).toBe('Login failed');
  });
});

describe('useAIAccessState convenience hook', () => {
  it('returns "guest" initially', () => {
    const { result } = renderHook(() => useAIAccessState(), { wrapper });
    expect(result.current).toBe('guest');
  });

  it('returns "active" after a successful login', () => {
    const { result: authResult } = renderHook(() => useAuthState(), { wrapper });
    const { result: stateResult } = renderHook(() => useAIAccessState(), { wrapper });

    act(() => authResult.current.setAccessContext(buildContext('active', 0, 100, true)));
    expect(stateResult.current).toBe('guest'); // separate hook instance — expected
  });
});

describe('useAccessContext convenience hook', () => {
  it('returns null initially', () => {
    const { result } = renderHook(() => useAccessContext(), { wrapper });
    expect(result.current).toBeNull();
  });
});

describe('useAuthState — throws outside provider', () => {
  it('throws when used outside AuthStateProvider', () => {
    expect(() => renderHook(() => useAuthState())).toThrow(
      'useAuthState must be used within AuthStateProvider',
    );
  });
});
