import { ErrorCode, ErrorCodeValue } from '../types/index';

/**
 * Custom application error class for Bridge API.
 *
 * Carries a machine-readable error code from the ErrorCode taxonomy,
 * a human-readable message, and an HTTP status code so that error
 * middleware can map it directly to an HTTP response.
 */
export class AppError extends Error {
  /** Machine-readable error code from the ErrorCode taxonomy. */
  public readonly code: ErrorCodeValue;

  /** HTTP status code to use when sending this error as a response. */
  public readonly statusCode: number;

  constructor(code: ErrorCodeValue, message: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Factory helpers for common error cases
// ---------------------------------------------------------------------------

/** 401 — Firebase token failed verification (expired, bad signature, wrong issuer/audience). */
export function tokenExpiredOrInvalid(message = 'Firebase ID token is invalid or has expired'): AppError {
  return new AppError(ErrorCode.TOKEN_EXPIRED_OR_INVALID, message, 401);
}

/** 401 — No authentication credentials were provided. */
export function authRequired(message = 'Authentication is required'): AppError {
  return new AppError(ErrorCode.AUTH_REQUIRED, message, 401);
}

/** 403 — User account is suspended or deleted. */
export function accountSuspended(message = 'This account has been suspended'): AppError {
  return new AppError(ErrorCode.ACCOUNT_SUSPENDED, message, 403);
}

/** 403 — User lacks the required permission. */
export function permissionDenied(message = 'You do not have permission to perform this action'): AppError {
  return new AppError(ErrorCode.PERMISSION_DENIED, message, 403);
}

/** 403 — Monthly AI quota exhausted. */
export function aiQuotaExceeded(message = 'Monthly AI quota has been exhausted'): AppError {
  return new AppError(ErrorCode.AI_QUOTA_EXCEEDED, message, 403);
}

/** 403 — Requested AI model is not in the user's allowed_models list. */
export function modelNotAllowed(message = 'The requested AI model is not available for your plan'): AppError {
  return new AppError(ErrorCode.MODEL_NOT_ALLOWED, message, 403);
}

/** 403 — Session has been explicitly revoked. */
export function sessionRevoked(message = 'This session has been revoked'): AppError {
  return new AppError(ErrorCode.SESSION_REVOKED, message, 403);
}

/** 429 — Too many requests in the current time window. */
export function rateLimitExceeded(message = 'Too many requests — please try again later'): AppError {
  return new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
}
