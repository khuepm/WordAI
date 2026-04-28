/**
 * Access Context construction service — in-memory model.
 *
 * Implements the Access Context building logic for the Bridge API using an
 * in-memory database state. This design allows the core business logic to be
 * tested without a real database connection.
 *
 * Requirements: 1.7, 1.8, 1.9, 4.10, 4.11, 4.12, 8.1, 8.2, 8.3, 8.4
 */

import { AccessContext, PlanCode, UserStatus } from '../types/index';
import {
  DatabaseState,
  UserRecord,
  EntitlementRecord,
} from './userService';

// ---------------------------------------------------------------------------
// Extended record types for roles, permissions, and sessions
// ---------------------------------------------------------------------------

export interface RoleRecord {
  role_code: string;
  description: string;
}

export interface PermissionRecord {
  permission_code: string;
  description: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role_code: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface RolePermissionRecord {
  role_code: string;
  permission_code: string;
}

export interface UserSessionRecord {
  id: string;
  user_id: string;
  device_id: string;
  session_state: 'active' | 'revoked';
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Extended database state
// ---------------------------------------------------------------------------

/**
 * Extends the base DatabaseState with roles, permissions, user_roles,
 * role_permissions, and sessions tables — the full set of tables needed
 * to construct an Access Context.
 */
export interface FullDatabaseState extends DatabaseState {
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  userRoles: UserRoleRecord[];
  rolePermissions: RolePermissionRecord[];
  sessions: UserSessionRecord[];
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Create an empty FullDatabaseState.
 * Useful as a starting point for tests.
 */
export function createFullEmptyState(): FullDatabaseState {
  return {
    users: [],
    entitlements: [],
    auditLogs: [],
    roles: [],
    permissions: [],
    userRoles: [],
    rolePermissions: [],
    sessions: [],
  };
}

// ---------------------------------------------------------------------------
// buildAccessContext
// ---------------------------------------------------------------------------

/**
 * Build an Access Context for a given user and session from the in-memory state.
 *
 * Steps:
 * 1. Find the user record by userId.
 * 2. Find the user's roles from userRoles where user_id === userId.
 * 3. Compute the permission set as the union of all role_permissions for those
 *    roles (deduplicated).
 * 4. Find the user's entitlement record.
 * 5. Find the session record by sessionId.
 * 6. Construct and return the complete AccessContext object.
 *
 * Requirements: 1.7, 1.8, 1.9, 4.10, 4.11, 4.12, 8.1, 8.2, 8.3, 8.4
 *
 * @param state     - Current in-memory full database state.
 * @param userId    - The user's UUID.
 * @param sessionId - The session's UUID.
 * @returns Complete AccessContext object.
 * @throws Error if the user, entitlement, or session is not found.
 */
export function buildAccessContext(
  state: FullDatabaseState,
  userId: string,
  sessionId: string,
): AccessContext {
  // Step 1: Find user record
  const user = state.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Step 2: Get user's roles (Req 4.10)
  const userRoleRecords = state.userRoles.filter(
    (ur) => ur.user_id === userId,
  );
  const roleCodes = userRoleRecords.map((ur) => ur.role_code);

  // Step 3: Compute permission set as union of all role permissions (Req 4.11, 4.12)
  const permissionSet = new Set<string>();
  for (const roleCode of roleCodes) {
    const rolePerms = state.rolePermissions.filter(
      (rp) => rp.role_code === roleCode,
    );
    for (const rp of rolePerms) {
      permissionSet.add(rp.permission_code);
    }
  }
  const permissions = Array.from(permissionSet);

  // Step 4: Find entitlement record (Req 8.3)
  const entitlement = state.entitlements.find((e) => e.user_id === userId);
  if (!entitlement) {
    throw new Error(`Entitlement not found for user: ${userId}`);
  }

  // Step 5: Find session record (Req 8.1, 8.2)
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Step 6: Construct and return AccessContext (Req 1.8, 1.9, 8.4)
  const accessContext: AccessContext = {
    user: {
      id: user.id,
      firebase_uid: user.firebase_uid,
      email: user.email,
      display_name: user.display_name ?? '',
      avatar_url: user.avatar_url,
      status: user.status,
      last_login_at: user.last_login_at ?? new Date().toISOString(),
    },
    roles: roleCodes,
    permissions,
    entitlement: {
      ai_enabled: entitlement.ai_enabled,
      plan_code: entitlement.plan_code,
      monthly_quota: entitlement.monthly_quota,
      used_quota: entitlement.used_quota,
      quota_reset_at: entitlement.quota_reset_at,
      allowed_models: entitlement.allowed_models,
      max_requests_per_minute: entitlement.max_requests_per_minute,
    },
    session: {
      id: session.id,
      device_id: session.device_id,
      session_state: 'active',
      last_seen_at: session.last_seen_at,
    },
  };

  return accessContext;
}
