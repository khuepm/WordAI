/**
 * Tests for useAuth — Firebase login/logout flow
 * Requirements: 1.1, 1.2, 7.1, 7.2, 7.5, 7.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { useAuth } from './useAuth';
import { AuthStateProvider } from '../services/authStore';
import { setFirebaseAuthAdapter, resetFirebaseAuthAdapter } from '../services/firebaseAuth';
import * as authService from '../services/authService';
import type { AccessContext } from '../types/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(sessionId = 'session-1'): AccessContext {
  return {
    user: {
      id: 'user-1',
      firebase_uid: 'uid-1',
      email: 'test@example.com',
      display_name: 'Test',
      avatar_url: null,
      status: 'active',
      last_login_at: new Date().toISOString(),
    },
    roles: ['user'],
    permissions: ['ai.use'],
    entitlement: {
      ai_enabled: true,
      plan_code: 'free',
      monthly_quota: 100,
      used_quota: 0,
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
  // Inject a mock Firebase adapter so tests never touch the real SDK
  setFirebaseAuthAdapter({
    signInWithEmailAndPassword: vi.fn().mockResolvedValue('mock-firebase-id-token'),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentIdToken: vi.fn().mockResolvedValue('mock-firebase-id-token'),
  });
});

afterEach(() => {
  resetFirebaseAuthAdapter();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

describe('useAuth — signIn', () => {
  it('calls Firebase signIn then Bridge API login and stores the Access Context (Req 1.1, 1.2)', async () => {
    const ctx = buildContext();
    vi.spyOn(authService, 'login').mockResolvedValue(ctx);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });

    expect(authService.login).toHaveBeenCalledWith('mock-firebase-id-token');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('sets authError and re-throws when Firebase signIn fails', async () => {
    setFirebaseAuthAdapter({
      signInWithEmailAndPassword: vi.fn().mockRejectedValue(new Error('Wrong password')),
      signOut: vi.fn(),
      getCurrentIdToken: vi.fn(),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.signIn('user@example.com', 'wrong');
      }),
    ).rejects.toThrow('Wrong password');

    expect(result.current.authError).toBe('Wrong password');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets authError and re-throws when Bridge API token exchange fails', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(new Error('TOKEN_EXPIRED_OR_INVALID'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.signIn('user@example.com', 'password123');
      }),
    ).rejects.toThrow('TOKEN_EXPIRED_OR_INVALID');

    expect(result.current.authError).toBe('TOKEN_EXPIRED_OR_INVALID');
  });
});

// ---------------------------------------------------------------------------
// Logout flow
// ---------------------------------------------------------------------------

describe('useAuth — signOut', () => {
  it('revokes Bridge API session, calls Firebase signOut, and clears auth state (Req 7.1, 7.2, 7.5, 7.7)', async () => {
    const ctx = buildContext('session-abc');
    vi.spyOn(authService, 'login').mockResolvedValue(ctx);
    vi.spyOn(authService, 'logout').mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // First sign in to get a session
    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });

    // Now sign out
    await act(async () => {
      await result.current.signOut();
    });

    expect(authService.logout).toHaveBeenCalledWith('session-abc');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('clears auth state even when Bridge API logout fails (Req 7.5)', async () => {
    const ctx = buildContext('session-xyz');
    vi.spyOn(authService, 'login').mockResolvedValue(ctx);
    vi.spyOn(authService, 'logout').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('user@example.com', 'password123');
    });

    // Logout should not throw even when the API call fails
    await act(async () => {
      await result.current.signOut();
    });

    // Auth state should be cleared regardless
    expect(result.current.isLoading).toBe(false);
  });

  it('handles signOut when no session is active (no-op)', async () => {
    vi.spyOn(authService, 'logout').mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Sign out without signing in first
    await act(async () => {
      await result.current.signOut();
    });

    // logout should not be called when there is no session
    expect(authService.logout).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
