import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode, ErrorResponse } from '../types/index';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Trace ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a UUID v4 trace ID using Node.js built-in crypto module.
 * Used to correlate a request across logs and error responses.
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Extend Express Request to carry trace_id and authenticated user
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Trace ID attached by requestLogger middleware. */
      traceId?: string;
      /** Authenticated user attached by auth middleware. */
      user?: { id: string };
    }
  }
}

// ---------------------------------------------------------------------------
// Request logger middleware
// ---------------------------------------------------------------------------

/**
 * Logs every incoming HTTP request and attaches a trace_id to `req` so that
 * downstream handlers and the error handler can reference the same ID.
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  req.traceId = generateTraceId();

  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    trace_id: req.traceId,
    timestamp: new Date().toISOString(),
  });

  next();
}

// ---------------------------------------------------------------------------
// 404 Not Found handler
// ---------------------------------------------------------------------------

/**
 * Catches requests that did not match any route and returns a standard 404
 * error response in the `ErrorResponse` format.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const traceId = req.traceId ?? generateTraceId();

  const body: ErrorResponse = {
    error: {
      code: ErrorCode.AUTH_REQUIRED,
      message: `Route not found: ${req.method} ${req.path}`,
      trace_id: traceId,
    },
  };

  res.status(404).json(body);
}

// ---------------------------------------------------------------------------
// Centralized error handler middleware
// ---------------------------------------------------------------------------

/**
 * Express error-handling middleware.
 *
 * Maps internal errors to the standard `ErrorResponse` format:
 * - `AppError` instances use their own `code` and `statusCode`.
 * - Any other `Error` is treated as an unexpected internal error (500).
 *
 * Logs every error with structured fields for observability:
 * error_code, user_id, path, method, trace_id, timestamp.
 *
 * Requirements: 8.9, 8.10, 15.5, 15.6, 15.7, 15.8
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const traceId = req.traceId ?? generateTraceId();

  let statusCode: number;
  let errorCode: string;
  let message: string;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
  } else if (err instanceof Error) {
    // Unexpected error — do not leak internal details to the client
    statusCode = 500;
    errorCode = ErrorCode.AUTH_REQUIRED;
    message = 'An unexpected internal error occurred';
  } else {
    statusCode = 500;
    errorCode = ErrorCode.AUTH_REQUIRED;
    message = 'An unexpected internal error occurred';
  }

  // Structured error log for observability
  logger.error('Request error', {
    error_code: errorCode,
    user_id: req.user?.id ?? null,
    path: req.path,
    method: req.method,
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    // Include stack trace in development for easier debugging
    ...(process.env.NODE_ENV !== 'production' && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });

  const body: ErrorResponse = {
    error: {
      code: errorCode as ErrorResponse['error']['code'],
      message,
      trace_id: traceId,
    },
  };

  res.status(statusCode).json(body);
}
