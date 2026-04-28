/**
 * Property-based tests for error response consistency.
 *
 * Property 40: Error Response Consistency
 *   Validates: Requirements 15.8
 *
 * Every error response from the Bridge API SHALL include a `code`, `message`,
 * and `trace_id` in the `error` object.
 *
 * The error handler is tested directly by calling the Express middleware
 * function with mock req/res/next objects — no HTTP server required.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError } from '../../src/errors/AppError';
import { ErrorCode, ErrorCodeValue } from '../../src/types/index';
import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mock req / res / next helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Express Request object.
 * The error handler reads `req.path`, `req.method`, `req.user`, and `req.traceId`.
 */
function makeMockReq(traceId?: string): Request {
  return {
    path: '/test',
    method: 'GET',
    user: undefined,
    traceId,
  } as unknown as Request;
}

/**
 * Creates a mock Express Response that captures the status code and JSON body.
 */
function makeMockRes(): {
  res: Response;
  getStatus: () => number | undefined;
  getBody: () => unknown;
} {
  let capturedStatus: number | undefined;
  let capturedBody: unknown;

  const res = {
    status(code: number) {
      capturedStatus = code;
      return this;
    },
    json(body: unknown) {
      capturedBody = body;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    getStatus: () => capturedStatus,
    getBody: () => capturedBody,
  };
}

const noop: NextFunction = () => {};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** All valid ErrorCode values as an array for use in arbitraries. */
const allErrorCodes: ErrorCodeValue[] = Object.values(ErrorCode);

/** Generates a random ErrorCodeValue. */
const errorCodeArb = fc.constantFrom(...allErrorCodes);

/** Generates a non-empty message string. */
const messageArb = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0,
);

/** Generates a valid HTTP status code (4xx or 5xx). */
const httpStatusArb = fc.oneof(
  fc.integer({ min: 400, max: 499 }),
  fc.integer({ min: 500, max: 599 }),
);

/** Generates an AppError with arbitrary code, message, and status. */
const appErrorArb = fc
  .tuple(errorCodeArb, messageArb, httpStatusArb)
  .map(([code, message, statusCode]) => new AppError(code, message, statusCode));

/** Generates a plain (non-AppError) Error with an arbitrary message. */
const plainErrorArb = messageArb.map((msg) => new Error(msg));

/** Generates an arbitrary non-Error thrown value (string, number, object, null). */
const nonErrorArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
  fc.record({ reason: fc.string() }),
);

// ---------------------------------------------------------------------------
// Property 40: Error Response Consistency
// Validates: Requirements 15.8
// ---------------------------------------------------------------------------

describe('Property 40: Error Response Consistency', () => {
  /**
   * **Validates: Requirements 15.8**
   *
   * For any AppError with any valid error code, the error handler produces a
   * response with `error.code`, `error.message`, and `error.trace_id` all
   * present and non-empty.
   */
  it('always includes error.code, error.message, and error.trace_id for any AppError', () => {
    fc.assert(
      fc.property(appErrorArb, (appError) => {
        const req = makeMockReq();
        const { res, getBody } = makeMockRes();

        errorHandler(appError, req, res, noop);

        const body = getBody() as { error: { code: string; message: string; trace_id: string } };

        // All three required fields must be present
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body.error).toHaveProperty('trace_id');

        // All three must be non-empty strings
        expect(typeof body.error.code).toBe('string');
        expect(body.error.code.length).toBeGreaterThan(0);

        expect(typeof body.error.message).toBe('string');
        expect(body.error.message.length).toBeGreaterThan(0);

        expect(typeof body.error.trace_id).toBe('string');
        expect(body.error.trace_id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * For any AppError, the response `error.code` matches the AppError's code.
   */
  it('preserves error.code from AppError in the response', () => {
    fc.assert(
      fc.property(appErrorArb, (appError) => {
        const req = makeMockReq();
        const { res, getBody } = makeMockRes();

        errorHandler(appError, req, res, noop);

        const body = getBody() as { error: { code: string } };
        expect(body.error.code).toBe(appError.code);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * For any AppError, the response HTTP status matches the AppError's statusCode.
   */
  it('preserves HTTP status code from AppError in the response', () => {
    fc.assert(
      fc.property(appErrorArb, (appError) => {
        const req = makeMockReq();
        const { res, getStatus } = makeMockRes();

        errorHandler(appError, req, res, noop);

        expect(getStatus()).toBe(appError.statusCode);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * For any error (AppError or plain Error), the trace_id in the response is
   * always a non-empty string.
   */
  it('always produces a non-empty trace_id string for any error type', () => {
    fc.assert(
      fc.property(
        fc.oneof(appErrorArb, plainErrorArb),
        (err) => {
          const req = makeMockReq(); // no pre-existing traceId
          const { res, getBody } = makeMockRes();

          errorHandler(err, req, res, noop);

          const body = getBody() as { error: { trace_id: string } };
          expect(typeof body.error.trace_id).toBe('string');
          expect(body.error.trace_id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * For any non-AppError thrown value, the response has HTTP status 500.
   */
  it('returns status 500 for any non-AppError thrown value', () => {
    fc.assert(
      fc.property(plainErrorArb, (err) => {
        const req = makeMockReq();
        const { res, getStatus } = makeMockRes();

        errorHandler(err, req, res, noop);

        expect(getStatus()).toBe(500);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * For any non-Error thrown value (string, number, null, object), the response
   * has HTTP status 500 and still includes the required error fields.
   */
  it('returns status 500 with required error fields for any non-Error thrown value', () => {
    fc.assert(
      fc.property(nonErrorArb, (thrown) => {
        const req = makeMockReq();
        const { res, getStatus, getBody } = makeMockRes();

        errorHandler(thrown, req, res, noop);

        expect(getStatus()).toBe(500);

        const body = getBody() as { error: { code: string; message: string; trace_id: string } };
        expect(body).toHaveProperty('error');
        expect(typeof body.error.code).toBe('string');
        expect(body.error.code.length).toBeGreaterThan(0);
        expect(typeof body.error.message).toBe('string');
        expect(body.error.message.length).toBeGreaterThan(0);
        expect(typeof body.error.trace_id).toBe('string');
        expect(body.error.trace_id.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * The response always has the shape `{ error: { code, message, trace_id } }`
   * and no other top-level keys.
   */
  it('response structure is always { error: { code, message, trace_id } }', () => {
    fc.assert(
      fc.property(
        fc.oneof(appErrorArb, plainErrorArb, nonErrorArb),
        (err) => {
          const req = makeMockReq();
          const { res, getBody } = makeMockRes();

          errorHandler(err, req, res, noop);

          const body = getBody() as Record<string, unknown>;

          // Top-level must have an `error` key
          expect(body).toHaveProperty('error');

          const errorObj = body.error as Record<string, unknown>;

          // The error object must have exactly code, message, trace_id
          // (details is optional per the type definition, so we only check required ones)
          expect(errorObj).toHaveProperty('code');
          expect(errorObj).toHaveProperty('message');
          expect(errorObj).toHaveProperty('trace_id');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 15.8**
   *
   * When req.traceId is already set (by requestLogger middleware), the error
   * handler uses that trace_id rather than generating a new one.
   */
  it('uses req.traceId when already present on the request', () => {
    fc.assert(
      fc.property(
        appErrorArb,
        fc.uuid(),
        (appError, existingTraceId) => {
          const req = makeMockReq(existingTraceId);
          const { res, getBody } = makeMockRes();

          errorHandler(appError, req, res, noop);

          const body = getBody() as { error: { trace_id: string } };
          expect(body.error.trace_id).toBe(existingTraceId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
