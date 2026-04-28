/**
 * User profile routes — pure business logic.
 *
 * Implements the core logic for:
 *   GET   /users/me
 *   PATCH /users/me
 *
 * as pure functions that take in-memory state and return a new state +
 * response. This design makes the handlers fully testable without HTTP
 * infrastructure.
 *
 * Requirements: 2.5, 2.6, 2.7, 2.8
 */

import { ErrorCode, UserProfile, UpdateProfileRequest } from '../types/index';
import { AppError } from '../errors/AppError';
import { FullDatabaseState } from '../services/accessContextService';
import { UserRecord } from '../services/userService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Map a UserRecord to a UserProfile response object.
 *
 * - display_name defaults to '' if null.
 * - last_login_at defaults to created_at if null.
 */
function mapUserRecordToProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    firebase_uid: user.firebase_uid,
    email: user.email,
    display_name: user.display_name ?? '',
    avatar_url: user.avatar_url,
    status: user.status,
    risk_level: user.risk_level,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at ?? user.created_at,
  };
}

// ---------------------------------------------------------------------------
// processGetProfile
// ---------------------------------------------------------------------------

/**
 * Core business logic for GET /users/me.
 *
 * Returns the current user's profile.
 *
 * Requirements: 2.5
 *
 * @param state  - Current in-memory full database state.
 * @param userId - The authenticated user's UUID.
 * @returns UserProfile response object.
 * @throws AppError(AUTH_REQUIRED, 401) if the user is not found.
 */
export function processGetProfile(
  state: FullDatabaseState,
  userId: string,
): UserProfile {
  const user = state.users.find((u) => u.id === userId);

  if (!user) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'User not found', 401);
  }

  return mapUserRecordToProfile(user);
}

// ---------------------------------------------------------------------------
// processUpdateProfile
// ---------------------------------------------------------------------------

/**
 * Result of a profile update operation.
 */
export interface UpdateProfileResult {
  /** Updated database state after the profile update. */
  state: FullDatabaseState;
  /** The updated user profile. */
  user: UserProfile;
}

/**
 * Core business logic for PATCH /users/me.
 *
 * Allows modification of display_name and avatar_url only.
 * Rejects requests that attempt to modify any other fields.
 *
 * Requirements: 2.6, 2.7, 2.8
 *
 * @param state   - Current in-memory full database state.
 * @param userId  - The authenticated user's UUID.
 * @param updates - The profile update request body.
 * @returns New database state and the updated UserProfile.
 * @throws AppError(AUTH_REQUIRED, 401) if the user is not found.
 * @throws AppError(PERMISSION_DENIED, 403) if restricted fields are present.
 * @throws AppError(VALIDATION_ERROR, 400) if display_name is invalid.
 */
export function processUpdateProfile(
  state: FullDatabaseState,
  userId: string,
  updates: UpdateProfileRequest,
): UpdateProfileResult {
  // Look up the user
  const userIndex = state.users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    throw new AppError(ErrorCode.AUTH_REQUIRED, 'User not found', 401);
  }

  // Restricted field check: only display_name and avatar_url are allowed
  const allowedKeys = new Set(['display_name', 'avatar_url']);
  const requestKeys = Object.keys(updates);
  const restrictedKeys = requestKeys.filter((k) => !allowedKeys.has(k));

  if (restrictedKeys.length > 0) {
    throw new AppError(
      ErrorCode.PERMISSION_DENIED,
      'Cannot modify restricted fields',
      403,
    );
  }

  // Validate display_name if provided
  if (updates.display_name !== undefined) {
    const name = updates.display_name;
    if (name.length === 0 || name.length > 100) {
      throw new AppError(
        'VALIDATION_ERROR' as any,
        'display_name must be 1–100 characters',
        400,
      );
    }
  }

  // Apply updates
  const existingUser = state.users[userIndex];
  const now = new Date().toISOString();

  const updatedUser: UserRecord = {
    ...existingUser,
    ...(updates.display_name !== undefined && { display_name: updates.display_name }),
    ...(updates.avatar_url !== undefined && { avatar_url: updates.avatar_url }),
    updated_at: now,
  };

  const updatedUsers = [...state.users];
  updatedUsers[userIndex] = updatedUser;

  const newState: FullDatabaseState = {
    ...state,
    users: updatedUsers,
  };

  return {
    state: newState,
    user: mapUserRecordToProfile(updatedUser),
  };
}

// ---------------------------------------------------------------------------
// HTTP handler factories (for use with Express)
// ---------------------------------------------------------------------------

/**
 * Create an Express-compatible GET /users/me handler.
 *
 * Requirements: 2.5
 *
 * @param getState  - Function to retrieve the current in-memory state.
 * @param getUserId - Function to extract the authenticated user ID from the request.
 */
export function createGetProfileHandler(
  getState: () => FullDatabaseState,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: { headers: Record<string, string | undefined> },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ) => {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: 'Authentication required',
          trace_id: generateId(),
        },
      });
      return;
    }

    try {
      const profile = processGetProfile(getState(), userId);
      res.json(profile);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
            trace_id: generateId(),
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            trace_id: generateId(),
          },
        });
      }
    }
  };
}

/**
 * Create an Express-compatible PATCH /users/me handler.
 *
 * Requirements: 2.6, 2.7, 2.8
 *
 * @param getState  - Function to retrieve the current in-memory state.
 * @param setState  - Function to persist the updated state.
 * @param getUserId - Function to extract the authenticated user ID from the request.
 */
export function createUpdateProfileHandler(
  getState: () => FullDatabaseState,
  setState: (state: FullDatabaseState) => void,
  getUserId: (req: { headers: Record<string, string | undefined> }) => string | null,
) {
  return (
    req: {
      body: UpdateProfileRequest;
      headers: Record<string, string | undefined>;
    },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      json: (body: unknown) => void;
    },
  ) => {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: 'Authentication required',
          trace_id: generateId(),
        },
      });
      return;
    }

    try {
      const { state: newState, user } = processUpdateProfile(
        getState(),
        userId,
        req.body,
      );
      setState(newState);
      res.json(user);
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          error: {
            code: err.code,
            message: err.message,
            trace_id: generateId(),
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            trace_id: generateId(),
          },
        });
      }
    }
  };
}
