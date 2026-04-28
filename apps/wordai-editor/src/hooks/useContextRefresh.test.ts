/**
 * Tests for useContextRefresh — Access Context refresh on error responses.
 * Requirements: 13.12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { useContextRefresh } from './useContextRefresh';
import { AuthStateProvider, useAuthState } from '../services/authStore';
import * as authService from '../services/authService';
import type { AccessContext } from '../types/auth';
import { BridgeErrorCode } from '../types/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(
  sessionId = 'session-1',
  status: AccessContext['user']['status'] = 'active',
  usedQuota = 0,
  monthlyQuota = 100,
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
      ai_enabled: true,
      plan_code: 'free',
      monthly_quota: monthlyQuota,
      used_quota: usedQuota,
      quota_reset_at: new Date().toISOString(),
      allowed_models: ['gpt-3.5-turbo'],
      max_requests_per_minute: 10,
    },
    session: {
      id: sessionId,
      device_id: 'device-1',
      session_state: 'active',
      last_seen_at: new Date().toISOString(),
    },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(AuthStateProvider, null, children);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// refreshContext
// ---------------------------------------------------------------------------

describe('useContextRefresh — refreshContext', () => {
  it('fetches fresh context and updates the store when session is active (Req 13.12)', async () => {
    const initial = buildContext('session-1', 'active', 0, 100);
    const refreshed = buildContext('session-1', 'active', 100, 100); // quota now exhausted

    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(refreshed);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    // Seed the store with an initial context
    act(() => result.current.auth.setAccessContext(initial));
    expect(result.current.auth.authState.aiAccessState).toBe('active');

    // Trigger a refresh
    await act(async () => {
      await result.current.refresh.refreshContext();
    });

    expect(authService.refreshAccessContext).toHaveBeenCalledWith('session-1');
    // aiAccessState should now reflect the refreshed context
    expect(result.current.auth.authState.aiAccessState).toBe('quota_exceeded');
    expect(result.current.auth.authState.accessContext).toEqual(refreshed);
  });

  it('clears auth state when refresh returns null (session fully revoked)', async () => {
    const initial = buildContext('session-1');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.refreshContext();
    });

    expect(result.current.auth.authState.accessContext).toBeNull();
    expect(result.current.auth.authState.aiAccessState).toBe('guest');
  });

  it('clears auth state when no session is active (no-op refresh)', async () => {
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    // No context set — no session
    await act(async () => {
      await result.current.refresh.refreshContext();
    });

    expect(authService.refreshAccessContext).not.toHaveBeenCalled();
    expect(result.current.auth.authState.aiAccessState).toBe('guest');
  });
});

// ---------------------------------------------------------------------------
// handleBridgeError
// ---------------------------------------------------------------------------

describe('useContextRefresh — handleBridgeError (Req 13.12)', () => {
  it('triggers a context refresh for ACCOUNT_SUSPENDED', async () => {
    const initial = buildContext('session-1', 'active');
    const refreshed = buildContext('session-1', 'suspended');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(refreshed);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.ACCOUNT_SUSPENDED);
    });

    expect(authService.refreshAccessContext).toHaveBeenCalledWith('session-1');
    expect(result.current.auth.authState.aiAccessState).toBe('suspended');
  });

  it('triggers a context refresh for SESSION_REVOKED', async () => {
    const initial = buildContext('session-1');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.SESSION_REVOKED);
    });

    expect(authService.refreshAccessContext).toHaveBeenCalledWith('session-1');
    // Refresh returned null → auth cleared
    expect(result.current.auth.authState.accessContext).toBeNull();
    expect(result.current.auth.authState.aiAccessState).toBe('guest');
  });

  it('triggers a context refresh for AI_QUOTA_EXCEEDED', async () => {
    const initial = buildContext('session-1', 'active', 99, 100);
    const refreshed = buildContext('session-1', 'active', 100, 100);
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(refreshed);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));
    expect(result.current.auth.authState.aiAccessState).toBe('active');

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.AI_QUOTA_EXCEEDED);
    });

    expect(authService.refreshAccessContext).toHaveBeenCalledWith('session-1');
    expect(result.current.auth.authState.aiAccessState).toBe('quota_exceeded');
  });

  it('does NOT trigger a context refresh for PERMISSION_DENIED', async () => {
    const initial = buildContext('session-1');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.PERMISSION_DENIED);
    });

    expect(authService.refreshAccessContext).not.toHaveBeenCalled();
    // State unchanged
    expect(result.current.auth.authState.accessContext).toEqual(initial);
  });

  it('does NOT trigger a context refresh for TOKEN_EXPIRED_OR_INVALID', async () => {
    const initial = buildContext('session-1');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.TOKEN_EXPIRED_OR_INVALID);
    });

    expect(authService.refreshAccessContext).not.toHaveBeenCalled();
  });

  it('does NOT trigger a context refresh for RATE_LIMIT_EXCEEDED', async () => {
    const initial = buildContext('session-1');
    vi.spyOn(authService, 'refreshAccessContext').mockResolvedValue(null);

    const { result } = renderHook(
      () => ({ auth: useAuthState(), refresh: useContextRefresh() }),
      { wrapper },
    );

    act(() => result.current.auth.setAccessContext(initial));

    await act(async () => {
      await result.current.refresh.handleBridgeError(BridgeErrorCode.RATE_LIMIT_EXCEEDED);
    });

    expect(authService.refreshAccessContext).not.toHaveBeenCalled();
  });
});
