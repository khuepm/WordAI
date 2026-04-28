/**
 * Role and permission management service — in-memory model.
 *
 * Implements role assignment, role removal, and role-permission update logic
 * for the Bridge API using an in-memory database state. This design allows
 * the core business logic to be tested without a real database connection.
 *
 * Requirements: 4.6, 4.7, 4.8, 4.9, 4.14
 */

import { AuditLogRecord } from './userService';
import {
  FullDatabaseState,
  UserRoleRecord,
  RolePermissionRecord,
} from './accessContextService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a simple UUID-like identifier for in-memory records.
 * Uses crypto.randomUUID when available, falls back to a timestamp-based ID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// assignRole
// ---------------------------------------------------------------------------

/**
 * Assign a role to a user.
 *
 * Steps:
 * 1. Verify the user exists.
 * 2. Verify the role exists.
 * 3. Check whether the user already has the role (idempotent guard).
 * 4. Create a user_roles record with user_id, role_code, assigned_at, assigned_by.
 * 5. Create an audit_log entry with action "role_assigned".
 * 6. Return the updated state.
 *
 * Requirements: 4.6, 4.7
 *
 * @param state    - Current in-memory full database state.
 * @param actorId  - ID of the user performing the assignment (null for system).
 * @param userId   - ID of the user receiving the role.
 * @param roleCode - Code of the role to assign.
 * @returns Updated FullDatabaseState with the new user_roles record and audit log.
 * @throws Error if the user or role is not found, or the user already has the role.
 */
export function assignRole(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  roleCode: string,
): FullDatabaseState {
  const now = new Date().toISOString();

  // Step 1: Verify user exists
  const user = state.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Step 2: Verify role exists
  const role = state.roles.find((r) => r.role_code === roleCode);
  if (!role) {
    throw new Error(`Role not found: ${roleCode}`);
  }

  // Step 3: Check for duplicate assignment
  const alreadyAssigned = state.userRoles.some(
    (ur) => ur.user_id === userId && ur.role_code === roleCode,
  );
  if (alreadyAssigned) {
    throw new Error(
      `User ${userId} already has role ${roleCode}`,
    );
  }

  // Step 4: Create user_roles record (Req 4.6)
  const newUserRole: UserRoleRecord = {
    id: generateId(),
    user_id: userId,
    role_code: roleCode,
    assigned_at: now,
    assigned_by: actorId,
  };

  // Step 5: Create audit log entry (Req 4.7)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'role_assigned',
    resource: 'user_role',
    resource_id: userId,
    before_data: null,
    after_data: newUserRole,
    created_at: now,
  };

  // Step 6: Return updated state
  return {
    ...state,
    userRoles: [...state.userRoles, newUserRole],
    auditLogs: [...state.auditLogs, auditLog],
  };
}

// ---------------------------------------------------------------------------
// removeRole
// ---------------------------------------------------------------------------

/**
 * Remove a role from a user.
 *
 * Steps:
 * 1. Verify the user exists.
 * 2. Find the user_roles record for (userId, roleCode).
 * 3. Delete the user_roles record.
 * 4. Create an audit_log entry with action "role_removed".
 * 5. Return the updated state.
 *
 * Requirements: 4.8, 4.9
 *
 * @param state    - Current in-memory full database state.
 * @param actorId  - ID of the user performing the removal (null for system).
 * @param userId   - ID of the user losing the role.
 * @param roleCode - Code of the role to remove.
 * @returns Updated FullDatabaseState with the user_roles record removed and audit log.
 * @throws Error if the user is not found or the user does not have the role.
 */
export function removeRole(
  state: FullDatabaseState,
  actorId: string | null,
  userId: string,
  roleCode: string,
): FullDatabaseState {
  const now = new Date().toISOString();

  // Step 1: Verify user exists
  const user = state.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Step 2: Find the user_roles record
  const userRoleRecord = state.userRoles.find(
    (ur) => ur.user_id === userId && ur.role_code === roleCode,
  );
  if (!userRoleRecord) {
    throw new Error(
      `User ${userId} does not have role ${roleCode}`,
    );
  }

  // Step 3: Delete the user_roles record (Req 4.8)
  const updatedUserRoles = state.userRoles.filter(
    (ur) => !(ur.user_id === userId && ur.role_code === roleCode),
  );

  // Step 4: Create audit log entry (Req 4.9)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'role_removed',
    resource: 'user_role',
    resource_id: userId,
    before_data: userRoleRecord,
    after_data: null,
    created_at: now,
  };

  // Step 5: Return updated state
  return {
    ...state,
    userRoles: updatedUserRoles,
    auditLogs: [...state.auditLogs, auditLog],
  };
}

// ---------------------------------------------------------------------------
// updateRolePermissions
// ---------------------------------------------------------------------------

/**
 * Replace the full set of permissions for a role.
 *
 * Steps:
 * 1. Verify the role exists.
 * 2. Verify all permission codes exist.
 * 3. Capture the before-state (current role_permissions for this role).
 * 4. Remove all existing role_permissions records for the role.
 * 5. Insert new role_permissions records for each permission code.
 * 6. Create an audit_log entry with action "permission_changed".
 * 7. Return the updated state.
 *
 * Requirements: 4.14
 *
 * @param state           - Current in-memory full database state.
 * @param actorId         - ID of the user performing the update (null for system).
 * @param roleCode        - Code of the role whose permissions are being updated.
 * @param permissionCodes - Complete new set of permission codes for the role.
 * @returns Updated FullDatabaseState with new role_permissions and audit log.
 * @throws Error if the role or any permission code is not found.
 */
export function updateRolePermissions(
  state: FullDatabaseState,
  actorId: string | null,
  roleCode: string,
  permissionCodes: string[],
): FullDatabaseState {
  const now = new Date().toISOString();

  // Step 1: Verify role exists
  const role = state.roles.find((r) => r.role_code === roleCode);
  if (!role) {
    throw new Error(`Role not found: ${roleCode}`);
  }

  // Step 2: Verify all permission codes exist
  for (const permCode of permissionCodes) {
    const permission = state.permissions.find(
      (p) => p.permission_code === permCode,
    );
    if (!permission) {
      throw new Error(`Permission not found: ${permCode}`);
    }
  }

  // Step 3: Capture before-state
  const beforePermissions = state.rolePermissions.filter(
    (rp) => rp.role_code === roleCode,
  );

  // Step 4: Remove existing role_permissions for this role
  const remainingRolePermissions = state.rolePermissions.filter(
    (rp) => rp.role_code !== roleCode,
  );

  // Step 5: Insert new role_permissions records (deduplicated)
  const uniquePermCodes = Array.from(new Set(permissionCodes));
  const newRolePermissions: RolePermissionRecord[] = uniquePermCodes.map(
    (permCode) => ({
      role_code: roleCode,
      permission_code: permCode,
    }),
  );

  // Step 6: Create audit log entry (Req 4.14)
  const auditLog: AuditLogRecord = {
    id: generateId(),
    actor_user_id: actorId,
    action: 'permission_changed',
    resource: 'role_permissions',
    resource_id: roleCode,
    before_data: beforePermissions,
    after_data: newRolePermissions,
    created_at: now,
  };

  // Step 7: Return updated state
  return {
    ...state,
    rolePermissions: [...remainingRolePermissions, ...newRolePermissions],
    auditLogs: [...state.auditLogs, auditLog],
  };
}
