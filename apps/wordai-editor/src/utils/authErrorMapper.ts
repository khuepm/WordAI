/**
 * Auth Error Mapper — Maps Firebase and Bridge API error codes to localized messages.
 *
 * Provides user-friendly, localized error messages for authentication failures.
 * Uses react-i18next TFunction to resolve translation keys.
 *
 * Requirements: 3.3, 3.4, 3.5, 3.6, 3.7
 */

import type { TFunction } from 'i18next';
import type { BridgeErrorCodeValue } from '../types/auth';

/**
 * Maps a Firebase Auth error code to a localized user-facing message.
 *
 * Handles known Firebase error codes and network errors.
 * Falls back to a generic error message for unrecognized codes.
 */
export function mapFirebaseError(code: string, t: TFunction): string {
  switch (code) {
    case 'auth/invalid-credential':
      return t('auth.errors.invalidCredential');
    case 'auth/user-not-found':
      return t('auth.errors.userNotFound');
    case 'auth/email-already-in-use':
      return t('auth.errors.emailInUse');
    case 'auth/weak-password':
      return t('auth.errors.weakPassword');
    case 'auth/too-many-requests':
      return t('auth.errors.tooManyRequests');
    case 'auth/network-request-failed':
      return t('auth.errors.networkError');
    default:
      return t('auth.errors.generic');
  }
}

/**
 * Maps a Bridge API error code to a localized user-facing message.
 *
 * Handles known Bridge API error codes returned in error responses.
 * Falls back to a generic error message for unrecognized codes.
 */
export function mapBridgeError(code: BridgeErrorCodeValue, t: TFunction): string {
  switch (code) {
    case 'ACCOUNT_SUSPENDED':
      return t('auth.errors.accountSuspended');
    case 'TOKEN_EXPIRED_OR_INVALID':
      return t('auth.errors.tokenInvalid');
    default:
      return t('auth.errors.generic');
  }
}

/**
 * Determines if an error is a network error and returns the appropriate message.
 *
 * Checks for Firebase network error codes and TypeError instances with "network"
 * in the message (e.g., fetch failures).
 *
 * Returns the localized network error message if it's a network error,
 * or null if it's not a network error.
 */
export function mapNetworkError(error: unknown, t: TFunction): string | null {
  // Firebase network error code
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'auth/network-request-failed'
  ) {
    return t('auth.errors.networkError');
  }

  // TypeError with "network" in message (e.g., fetch API network failures)
  if (error instanceof TypeError && /network/i.test(error.message)) {
    return t('auth.errors.networkError');
  }

  return null;
}
