/**
 * Unit tests for authErrorMapper utility
 *
 * Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { describe, it, expect, vi } from 'vitest';
import { mapFirebaseError, mapBridgeError, mapNetworkError } from './authErrorMapper';
import type { TFunction } from 'i18next';

// Simple mock t function that returns the key as-is
const t = vi.fn((key: string) => key) as unknown as TFunction;

describe('mapFirebaseError', () => {
  it('maps auth/invalid-credential to invalidCredential message', () => {
    const result = mapFirebaseError('auth/invalid-credential', t);
    expect(result).toBe('auth.errors.invalidCredential');
  });

  it('maps auth/user-not-found to userNotFound message', () => {
    const result = mapFirebaseError('auth/user-not-found', t);
    expect(result).toBe('auth.errors.userNotFound');
  });

  it('maps auth/email-already-in-use to emailInUse message', () => {
    const result = mapFirebaseError('auth/email-already-in-use', t);
    expect(result).toBe('auth.errors.emailInUse');
  });

  it('maps auth/weak-password to weakPassword message', () => {
    const result = mapFirebaseError('auth/weak-password', t);
    expect(result).toBe('auth.errors.weakPassword');
  });

  it('maps auth/too-many-requests to tooManyRequests message', () => {
    const result = mapFirebaseError('auth/too-many-requests', t);
    expect(result).toBe('auth.errors.tooManyRequests');
  });

  it('maps auth/network-request-failed to networkError message', () => {
    const result = mapFirebaseError('auth/network-request-failed', t);
    expect(result).toBe('auth.errors.networkError');
  });

  it('maps unknown error codes to generic message', () => {
    const result = mapFirebaseError('auth/unknown-error', t);
    expect(result).toBe('auth.errors.generic');
  });

  it('maps empty string to generic message', () => {
    const result = mapFirebaseError('', t);
    expect(result).toBe('auth.errors.generic');
  });
});

describe('mapBridgeError', () => {
  it('maps ACCOUNT_SUSPENDED to accountSuspended message', () => {
    const result = mapBridgeError('ACCOUNT_SUSPENDED', t);
    expect(result).toBe('auth.errors.accountSuspended');
  });

  it('maps TOKEN_EXPIRED_OR_INVALID to tokenInvalid message', () => {
    const result = mapBridgeError('TOKEN_EXPIRED_OR_INVALID', t);
    expect(result).toBe('auth.errors.tokenInvalid');
  });

  it('maps other Bridge error codes to generic message', () => {
    const result = mapBridgeError('RATE_LIMIT_EXCEEDED', t);
    expect(result).toBe('auth.errors.generic');
  });

  it('maps AUTH_REQUIRED to generic message', () => {
    const result = mapBridgeError('AUTH_REQUIRED', t);
    expect(result).toBe('auth.errors.generic');
  });
});

describe('mapNetworkError', () => {
  it('detects Firebase network error by code', () => {
    const error = { code: 'auth/network-request-failed', message: 'Network error' };
    const result = mapNetworkError(error, t);
    expect(result).toBe('auth.errors.networkError');
  });

  it('detects TypeError with "network" in message', () => {
    const error = new TypeError('Failed to fetch: network error');
    const result = mapNetworkError(error, t);
    expect(result).toBe('auth.errors.networkError');
  });

  it('detects TypeError with "Network" (case-insensitive)', () => {
    const error = new TypeError('Network request failed');
    const result = mapNetworkError(error, t);
    expect(result).toBe('auth.errors.networkError');
  });

  it('returns null for non-network errors', () => {
    const error = new Error('Something went wrong');
    const result = mapNetworkError(error, t);
    expect(result).toBeNull();
  });

  it('returns null for TypeError without "network" in message', () => {
    const error = new TypeError('Cannot read property of undefined');
    const result = mapNetworkError(error, t);
    expect(result).toBeNull();
  });

  it('returns null for null error', () => {
    const result = mapNetworkError(null, t);
    expect(result).toBeNull();
  });

  it('returns null for undefined error', () => {
    const result = mapNetworkError(undefined, t);
    expect(result).toBeNull();
  });
});
