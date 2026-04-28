/**
 * Transaction service — atomic multi-record operation wrappers.
 *
 * In the in-memory model, "transactions" are implemented by:
 * 1. Capturing the state BEFORE the operation (the "savepoint").
 * 2. Running the operation.
 * 3. If the operation throws, returning the original state (rollback).
 * 4. If the operation succeeds, returning the new state (commit).
 *
 * This makes the all-or-nothing guarantee explicit and testable.
 *
 * Requirements: 15.9, 15.10
 */

import { FullDatabaseState } from './accessContextService';
import { FirebaseClaims } from '../auth/firebaseVerifier';
import { processTokenExchange } from '../routes/auth';
import { ExchangeResponse } from '../types/index';
import { assignRole, removeRole } from './roleService';
import { revokeSession } from './sessionService';

// ---------------------------------------------------------------------------
// Generic transaction wrapper
// ---------------------------------------------------------------------------

/**
 * Generic transaction wrapper for atomic multi-record operations.
 *
 * Takes the current state and an operation function. If the operation throws,
 * the original state is returned unchanged (rollback). If it succeeds, the
 * new state is returned (commit).
 *
 * This models the SQL `BEGIN / COMMIT / ROLLBACK` pattern in the functional
 * in-memory world.
 *
 * Requirements: 15.9, 15.10
 *
 * @param state     - Current in-memory full database state (the "savepoint").
 * @param operation - Function that takes state and returns new state + result.
 * @returns New state and result if successful; original state if operation throws.
 * @throws Re-throws the error from the operation so callers know it failed.
 */
export function withTransaction<T>(
  state: FullDatabaseState,
  operation: (state: FullDatabaseState) => { state: FullDatabaseState; result: T },
): { state: FullDatabaseState; result: T } {
  try {
    // Run the operation
    const { state: newState, result } = operation(state);
    // Success — commit by returning the new state
    return { state: newState, result };
  } catch (error) {
    // Failure — rollback by returning the original state unchanged
    // Re-throw the error so the caller knows the operation failed
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Token exchange transaction
// ---------------------------------------------------------------------------

/**
 * Result of a token exchange transaction.
 */
export interface TokenExchangeTransactionResult {
  /** Updated database state after the transaction. */
  state: FullDatabaseState;
  /** The Access Context response to return to the client. */
  response: ExchangeResponse;
  /** Whether the transaction was committed (true) or rolled back (false). */
  committed: boolean;
}

/**
 * Execute the POST /auth/exchange multi-record operation atomically.
 *
 * Wraps the following operations in a transaction:
 * - User upsert + entitlement creation (via `upsertUser`)
 * - Session upsert (create or update)
 * - Audit log creation (already done inside `upsertUser` for new users)
 *
 * Uses `withTransaction` internally to ensure atomicity.
 *
 * Requirements: 15.9, 15.10
 *
 * @param state    - Current in-memory full database state.
 * @param claims   - Already-verified Firebase claims from the ID token.
 * @param deviceId - Unique identifier for the client device.
 * @returns Transaction result with updated state, response, and commit status.
 */
export function executeTokenExchangeTransaction(
  state: FullDatabaseState,
  claims: FirebaseClaims,
  deviceId: string,
): TokenExchangeTransactionResult {
  try {
    const { state: newState, result } = withTransaction(state, (s) => {
      const { state: updatedState, response } = processTokenExchange(
        s,
        claims,
        deviceId,
      );
      return { state: updatedState, result: response };
    });

    return {
      state: newState,
      response: result,
      committed: true,
    };
  } catch (error) {
    // Transaction failed — state is unchanged (rollback)
    return {
      state,
      response: {} as ExchangeResponse, // Placeholder — caller should check committed flag
      committed: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Role assignment transaction
// ---------------------------------------------------------------------------

/**
 * Result of a role assignment or removal transaction.
 */
export interface RoleTransactionResult {
  /** Updated database state after the transaction. */
  state: FullDatabaseState;
  /** Whether the transaction was committed (true) or rolled back (false). */
  committed: boolean;
}

/**
 * Execute a role assignment + audit log creation atomically.
 *
 * Wraps the following operations in a transaction:
 * - Role assignment (via `assignRole`)
 * - Audit log creation (already done inside `assignRole`)
 *
 * Uses `withTransaction` internally to ensure atomicity.
 *
 * Requirements: 15.9, 15.10
 *
 * @param state    - Current in-memory full database state.
 * @param actorId  - ID of the user performing the assignment (null for system).
 * @param userId   - ID of the user receiving the role.
 * @param roleCode - Code of the role to assign.
 * @returns Transaction result with updated state and commit status.
 */
export function executeRoleAssignmentTransaction(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  roleCode: string,
): RoleTransactionResult {
  try {
    const { state: newState } = withTransaction(state, (s) => {
      const updatedState = assignRole(s, actorId, userId, roleCode);
      return { state: updatedState, result: null };
    });

    return {
      state: newState,
      committed: true,
    };
  } catch (error) {
    // Transaction failed — state is unchanged (rollback)
    return {
      state,
      committed: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Session revocation transaction
// ---------------------------------------------------------------------------

/**
 * Result of a session revocation transaction.
 */
export interface SessionRevocationTransactionResult {
  /** Updated database state after the transaction. */
  state: FullDatabaseState;
  /** Whether the transaction was committed (true) or rolled back (false). */
  committed: boolean;
  /** ISO 8601 timestamp when the session was revoked, or null if rollback. */
  revokedAt: string | null;
}

/**
 * Execute a session revocation + audit log creation atomically.
 *
 * Wraps the following operations in a transaction:
 * - Session revocation (via `revokeSession`)
 * - Audit log creation (already done inside `revokeSession`)
 *
 * Uses `withTransaction` internally to ensure atomicity.
 *
 * Requirements: 15.9, 15.10
 *
 * @param state     - Current in-memory full database state.
 * @param actorId   - ID of the user performing the revocation (null for system).
 * @param sessionId - UUID of the session to revoke.
 * @returns Transaction result with updated state, commit status, and revoked_at.
 */
export function executeSessionRevocationTransaction(
  state: FullDatabaseState,
  actorId: string | null,
  sessionId: string,
): SessionRevocationTransactionResult {
  try {
    const { state: newState } = withTransaction(state, (s) => {
      const updatedState = revokeSession(s, actorId, sessionId);
      return { state: updatedState, result: null };
    });

    // Extract the revoked_at timestamp from the updated session
    const revokedSession = newState.sessions.find((s) => s.id === sessionId);
    const revokedAt = revokedSession?.revoked_at ?? null;

    return {
      state: newState,
      committed: true,
      revokedAt,
    };
  } catch (error) {
    // Transaction failed — state is unchanged (rollback)
    return {
      state,
      committed: false,
      revokedAt: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Role removal transaction
// ---------------------------------------------------------------------------

/**
 * Execute a role removal + audit log creation atomically.
 *
 * Wraps the following operations in a transaction:
 * - Role removal (via `removeRole`)
 * - Audit log creation (already done inside `removeRole`)
 *
 * Uses `withTransaction` internally to ensure atomicity.
 *
 * Requirements: 15.9, 15.10
 *
 * @param state    - Current in-memory full database state.
 * @param actorId  - ID of the user performing the removal (null for system).
 * @param userId   - ID of the user losing the role.
 * @param roleCode - Code of the role to remove.
 * @returns Transaction result with updated state and commit status.
 */
export function executeRoleRemovalTransaction(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  roleCode: string,
): RoleTransactionResult {
  try {
    const { state: newState } = withTransaction(state, (s) => {
      const updatedState = removeRole(s, actorId, userId, roleCode);
      return { state: updatedState, result: null };
    });

    return {
      state: newState,
      committed: true,
    };
  } catch (error) {
    // Transaction failed — state is unchanged (rollback)
    return {
      state,
      committed: false,
    };
  }
}
