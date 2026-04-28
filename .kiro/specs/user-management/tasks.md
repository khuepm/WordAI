# Implementation Plan: User Management

## Overview

Implement the User Management system for the WordAI desktop application, integrating Firebase Authentication with Directus/Lumibase for authorization and user data management, connected through a Bridge API. The implementation follows the phased approach defined in the design: database foundation → core authentication → authorization & quota → user management endpoints → client state management.

## Tasks

- [x] 1. Set up database schema with Lumibase migrations
  - [x] 1.1 Create migration group 001_users_core
    - Create `users` table with all fields, constraints, and indexes (firebase_uid UNIQUE, email UNIQUE, status CHECK, risk_level CHECK)
    - Create rollback script for 001_users_core
    - _Requirements: 12.1, 12.2, 12.9, 12.10_

  - [x] 1.2 Write property test for migration idempotence (Property 35)
    - **Property 35: Migration Idempotence**
    - **Validates: Requirements 12.3**

  - [x] 1.3 Write property test for migration rollback correctness (Property 36)
    - **Property 36: Migration Rollback Correctness**
    - **Validates: Requirements 12.4, 12.5**

  - [x] 1.4 Create migration group 002_roles_permissions
    - Create `roles`, `permissions`, `user_roles`, and `role_permissions` tables with foreign keys and indexes
    - Seed default roles: guest, user, pro, admin, support
    - Seed default permissions: ai.use, ai.use.pro_model, user.manage, quota.override, role.assign, audit.view
    - Seed default role_permissions mappings
    - Create rollback script for 002_roles_permissions
    - _Requirements: 12.1, 12.2, 12.6, 12.7, 12.8, 12.11_

  - [x] 1.5 Create migration group 003_entitlements_sessions
    - Create `user_entitlements` table with check constraint (used_quota >= 0 AND used_quota <= monthly_quota)
    - Create `user_sessions` table with unique constraint on (user_id, device_id)
    - Create rollback scripts for 003_entitlements_sessions
    - _Requirements: 12.1, 12.2, 12.9, 12.10, 12.11_

  - [x] 1.6 Write property test for database constraint enforcement (Property 37)
    - **Property 37: Database Constraint Enforcement**
    - **Validates: Requirements 12.10, 12.11**

  - [x] 1.7 Create migration group 004_audit
    - Create `audit_logs` table with all fields and indexes
    - Add PostgreSQL rules to prevent UPDATE and DELETE on audit_logs
    - Create rollback script for 004_audit
    - _Requirements: 10.1, 10.6, 12.1, 12.2_

- [x] 2. Checkpoint — Ensure all migrations apply and roll back cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Bridge API project structure and Firebase token verification
  - [x] 3.1 Set up Bridge API project (Node.js + TypeScript + Express/Fastify)
    - Initialize project with TypeScript config, ESLint, Prettier
    - Install dependencies: firebase-admin, @directus/sdk, express, winston, fast-check (dev)
    - Define TypeScript interfaces: `ExchangeRequest`, `ExchangeResponse`, `AccessContext`, `ErrorResponse`, and all data model types
    - _Requirements: 11.1_

  - [x] 3.2 Implement Firebase token verification module
    - Implement `verifyFirebaseToken(idToken: string)` using Firebase Admin SDK
    - Validate token signature, expiration, issuer, and audience
    - Return extracted claims (firebase_uid, email, display_name, avatar_url) on success
    - Throw `TOKEN_EXPIRED_OR_INVALID` error on any verification failure
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 3.3 Write property test for invalid token rejection (Property 4)
    - **Property 4: Invalid Token Rejection**
    - **Validates: Requirements 1.10, 11.1–11.5**

  - [x] 3.4 Write property test for Firebase UID extraction correctness (Property 3)
    - **Property 3: Firebase UID Extraction Correctness**
    - **Validates: Requirements 1.4**

  - [x] 3.5 Implement error response middleware
    - Create centralized error handler that maps internal errors to standard `ErrorResponse` format
    - Include error code, human-readable message, and trace_id in every error response
    - Log all errors with error_code, user_id, request_context, trace_id, and timestamp
    - _Requirements: 8.9, 8.10, 15.5, 15.6, 15.7, 15.8_

  - [x] 3.6 Write property test for error response consistency (Property 40)
    - **Property 40: Error Response Consistency**
    - **Validates: Requirements 15.8**

- [x] 4. Implement email normalization and user upsert logic
  - [x] 4.1 Implement `normalizeEmail(email: string): string`
    - Lowercase and trim whitespace from email addresses
    - _Requirements: 2.9_

  - [x] 4.2 Write property test for email normalization idempotence (Property 7)
    - **Property 7: Email Normalization Idempotence**
    - **Validates: Requirements 2.9**

  - [x] 4.3 Implement user upsert function
    - On first login: create user record with firebase_uid, email (normalized), display_name, avatar_url, status="pending"
    - On subsequent logins: update display_name, avatar_url, last_login_at only; never modify firebase_uid, email, status, or risk_level
    - Create default `user_entitlements` record (free plan) for new users
    - Create audit_log entry with action "user_created" for new users
    - _Requirements: 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 5.3_

  - [x] 4.4 Write property test for profile field immutability (Property 6)
    - **Property 6: Profile Field Immutability**
    - **Validates: Requirements 2.4, 2.10, 2.11**

  - [x] 4.5 Write property test for user creation audit log (Property 5)
    - **Property 5: User Creation Audit Log**
    - **Validates: Requirements 1.11, 10.2**

- [x] 5. Implement Access Context construction
  - [x] 5.1 Implement `buildAccessContext(userId: string): AccessContext`
    - Query user record, roles (via user_roles JOIN roles), permissions (via role_permissions), and entitlement from Directus
    - Compute permission set as union of all role permissions
    - Construct and return complete `AccessContext` object
    - _Requirements: 1.7, 1.8, 1.9, 4.10, 4.11, 4.12, 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Write property test for Access Context serialization round-trip (Property 2)
    - **Property 2: Access Context Serialization Round-Trip**
    - **Validates: Requirements 1.8, 1.9**

  - [x] 5.3 Write property test for permission closure (Property 13)
    - **Property 13: Permission Closure**
    - **Validates: Requirements 4.10–4.12**

  - [x] 5.4 Write property test for Access Context consistency (Property 29)
    - **Property 29: Access Context Consistency**
    - **Validates: Requirements 8.8**

- [x] 6. Implement POST /auth/exchange endpoint
  - [x] 6.1 Implement the token exchange handler
    - Verify Firebase ID token, upsert user, upsert user_sessions record (session_state="active", last_seen_at=now)
    - Build and return Access Context
    - Apply rate limiting (reject with RATE_LIMIT_EXCEEDED when exceeded)
    - _Requirements: 1.1, 1.2, 1.3, 6.2, 6.3, 6.4, 11.8, 11.10_

  - [x] 6.2 Write property test for token exchange idempotence (Property 1)
    - **Property 1: Token Exchange Idempotence**
    - **Validates: Requirements 1.1, 1.5, 15.1**

  - [x] 6.3 Write property test for rate limiting effectiveness (Property 34)
    - **Property 34: Rate Limiting Effectiveness**
    - **Validates: Requirements 11.8–11.10**

- [x] 7. Checkpoint — Ensure all tests pass for authentication foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement user lifecycle state machine
  - [x] 8.1 Implement `validateStatusTransition(from: UserStatus, to: UserStatus): boolean`
    - Allow: pending→active, active→suspended, suspended→active, active→deleted, suspended→deleted
    - Deny: deleted→any, pending→suspended, pending→deleted, and all other unlisted transitions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 8.2 Write property test for state machine validity (Property 9)
    - **Property 9: State Machine Validity**
    - **Validates: Requirements 3.1–3.10**

  - [x] 8.3 Write property test for deleted status irreversibility (Property 11)
    - **Property 11: Deleted Status Irreversibility**
    - **Validates: Requirements 3.8**

  - [x] 8.4 Implement `changeUserStatus(actorId, userId, newStatus)` with audit logging
    - Validate transition using `validateStatusTransition`
    - Perform soft delete (retain record with status="deleted") when transitioning to deleted
    - Create audit_log entry with action "user_status_changed", actor_user_id, before_data, after_data
    - Prevent new session creation for suspended/deleted users
    - _Requirements: 3.11, 3.12, 3.13, 3.14_

  - [x] 8.5 Write property test for status change audit completeness (Property 10)
    - **Property 10: Status Change Audit Completeness**
    - **Validates: Requirements 3.11, 3.12, 10.2**

  - [x] 8.6 Write property test for suspended user session prevention (Property 12)
    - **Property 12: Suspended User Session Prevention**
    - **Validates: Requirements 3.14**

- [x] 9. Implement role and permission management
  - [x] 9.1 Implement `assignRole(actorId, userId, roleCode)` and `removeRole(actorId, userId, roleCode)`
    - Create/delete user_roles record
    - Create audit_log entry with action "role_assigned" or "role_removed"
    - _Requirements: 4.6, 4.7, 4.8, 4.9_

  - [x] 9.2 Write property test for role assignment audit completeness (Property 14)
    - **Property 14: Role Assignment Audit Completeness**
    - **Validates: Requirements 4.7, 4.9, 10.2**

  - [x] 9.3 Write property test for multiple role support (Property 15)
    - **Property 15: Multiple Role Support**
    - **Validates: Requirements 4.13**

  - [x] 9.4 Implement `updateRolePermissions(actorId, roleCode, permissionCodes[])` with audit logging
    - Update role_permissions mappings
    - Create audit_log entry with action "permission_changed"
    - _Requirements: 4.14_

- [x] 10. Implement AI quota management
  - [x] 10.1 Implement `validateAIAccess(userId, model)` pre-check
    - Verify user status is "active", has "ai.use" permission, used_quota < monthly_quota, and model is in allowed_models
    - Return appropriate error code on failure: ACCOUNT_SUSPENDED, PERMISSION_DENIED, AI_QUOTA_EXCEEDED, MODEL_NOT_ALLOWED
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 10.2 Write property test for model validation (Property 20)
    - **Property 20: Model Validation**
    - **Validates: Requirements 5.8, 5.9**

  - [x] 10.3 Implement atomic quota consumption in POST /ai/usage/consume
    - Use SQL transaction: `UPDATE user_entitlements SET used_quota = used_quota + 1 WHERE id = ? AND used_quota < monthly_quota`
    - If UPDATE affects 0 rows, rollback and return AI_QUOTA_EXCEEDED
    - Apply rate limiting on this endpoint
    - _Requirements: 5.10, 5.11, 11.9_

  - [x] 10.4 Write property test for quota constraint invariant (Property 16)
    - **Property 16: Quota Constraint Invariant**
    - **Validates: Requirements 5.4, 5.10, 5.11**

  - [x] 10.5 Write property test for quota atomicity (Property 17)
    - **Property 17: Quota Atomicity**
    - **Validates: Requirements 5.10, 5.11**

  - [x] 10.6 Write property test for no negative quota (Property 18)
    - **Property 18: No Negative Quota**
    - **Validates: Requirements 5.4**

  - [x] 10.7 Implement quota reset scheduler
    - When current date reaches quota_reset_at: set used_quota=0, set quota_reset_at to first day of next month
    - Implement as idempotent operation safe to run multiple times
    - _Requirements: 5.12, 5.13_

  - [x] 10.8 Write property test for quota reset idempotence (Property 19)
    - **Property 19: Quota Reset Idempotence**
    - **Validates: Requirements 5.12, 5.13, 15.4**

  - [x] 10.9 Implement `overrideEntitlement(actorId, userId, changes)` with audit logging
    - Update user_entitlements fields
    - Create audit_log entry with action "entitlement_overridden"
    - _Requirements: 5.14, 9.6_

  - [x] 10.10 Write property test for entitlement override audit (Property 21)
    - **Property 21: Entitlement Override Audit**
    - **Validates: Requirements 5.14, 10.2**

- [x] 11. Checkpoint — Ensure all tests pass for authorization and quota
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement session management endpoints
  - [x] 12.1 Implement GET /users/me/sessions
    - Return all sessions where session_state="active" and revoked_at is null for the authenticated user
    - _Requirements: 6.5_

  - [x] 12.2 Implement `revokeSession(actorId, sessionId)` and POST /users/me/sessions/revoke
    - Set revoked_at=now() and session_state="revoked" for specified session(s)
    - Support revokeAll flag to revoke all sessions except current
    - Create audit_log entry with action "session_revoked" for each revoked session
    - Reject new token exchange requests for revoked sessions with SESSION_REVOKED
    - _Requirements: 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 9.7, 9.8_

  - [x] 12.3 Write property test for session revocation effectiveness (Property 22)
    - **Property 22: Session Revocation Effectiveness**
    - **Validates: Requirements 6.9, 6.10**

  - [x] 12.4 Write property test for session isolation (Property 23)
    - **Property 23: Session Isolation**
    - **Validates: Requirements 6.11**

  - [x] 12.5 Write property test for session revocation audit (Property 24)
    - **Property 24: Session Revocation Audit**
    - **Validates: Requirements 6.8, 10.2**

  - [x] 12.6 Write property test for session uniqueness (Property 25)
    - **Property 25: Session Uniqueness**
    - **Validates: Requirements 6.12**

- [x] 13. Implement logout endpoint
  - [x] 13.1 Implement POST /auth/logout
    - Revoke the specified session (set revoked_at, session_state="revoked")
    - Create audit_log entry with action "session_revoked"
    - Return idempotent success even if session already revoked
    - _Requirements: 7.2, 7.3, 7.4, 7.6, 15.3_

  - [x] 13.2 Write property test for logout completeness (Property 26)
    - **Property 26: Logout Completeness**
    - **Validates: Requirements 7.6**

  - [x] 13.3 Write property test for logout idempotence (Property 27)
    - **Property 27: Logout Idempotence**
    - **Validates: Requirements 7.3, 7.4, 15.3**

- [x] 14. Implement user profile endpoints
  - [x] 14.1 Implement GET /users/me
    - Return current user profile from Directus for the authenticated user
    - _Requirements: 2.5_

  - [x] 14.2 Implement PATCH /users/me
    - Allow modification of display_name (1–100 chars) and avatar_url only
    - Reject requests attempting to modify firebase_uid, email, status, or risk_level with PERMISSION_DENIED
    - _Requirements: 2.6, 2.7, 2.8_

  - [x] 14.3 Write property test for profile update idempotence (Property 8)
    - **Property 8: Profile Update Idempotence**
    - **Validates: Requirements 2.6, 2.7, 15.2**

- [x] 15. Implement GET /auth/context and authorization source-of-truth enforcement
  - [x] 15.1 Implement GET /auth/context
    - Always fetch fresh Access Context from Directus (no caching)
    - Return same structure as ExchangeResponse
    - _Requirements: 8.8_

  - [x] 15.2 Enforce server-side authorization source of truth
    - Ensure Bridge API never trusts role, permission, or quota data from Client_App requests
    - All authorization data retrieved from Directus on every request
    - _Requirements: 8.6, 8.7_

  - [x] 15.3 Write property test for authorization source of truth (Property 28)
    - **Property 28: Authorization Source of Truth**
    - **Validates: Requirements 8.6, 8.7**

  - [x] 15.4 Write property test for error code determinism (Property 30)
    - **Property 30: Error Code Determinism**
    - **Validates: Requirements 8.10**

- [x] 16. Implement GET /ai/entitlement endpoint
  - Retrieve current AI entitlement and quota status for authenticated user
  - Include computed `remaining_quota` field (monthly_quota - used_quota)
  - _Requirements: 5.1, 5.2_

- [x] 17. Implement audit log immutability and query support
  - [x] 17.1 Verify audit_logs immutability rules are enforced at the application layer
    - Ensure no code path allows UPDATE or DELETE on audit_logs (rely on PostgreSQL rules from migration 004_audit)
    - _Requirements: 10.6, 10.7_

  - [x] 17.2 Write property test for audit log immutability (Property 31)
    - **Property 31: Audit Log Immutability**
    - **Validates: Requirements 10.6**

  - [x] 17.3 Write property test for audit completeness (Property 32)
    - **Property 32: Audit Completeness**
    - **Validates: Requirements 10.2, 10.3**

  - [x] 17.4 Write property test for audit temporal ordering (Property 33)
    - **Property 33: Audit Temporal Ordering**
    - **Validates: Requirements 10.5**

- [x] 18. Checkpoint — Ensure all tests pass for user management and audit
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implement Client App authentication state management
  - [x] 19.1 Implement `deriveAIAccessState(context: AccessContext | null): AIAccessState`
    - Return "guest" when no active session
    - Return "active" when status="active", used_quota < monthly_quota, ai_enabled=true
    - Return "quota_exceeded" when status="active" and used_quota >= monthly_quota
    - Return "suspended" when status="suspended"
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 19.2 Write property test for client state derivation determinism (Property 38)
    - **Property 38: Client State Derivation Determinism**
    - **Validates: Requirements 13.2–13.7**

  - [x] 19.3 Implement Access Context store (Zustand or Redux Toolkit slice)
    - Store Access Context in application state after token exchange
    - Expose derived AI access state to components
    - _Requirements: 13.1, 13.2_

  - [x] 19.4 Implement Firebase login/logout flow in Client App
    - Call Firebase signInWithEmailAndPassword, then POST /auth/exchange with firebaseIdToken and deviceId
    - On logout: call Firebase signOut, POST /auth/logout, clear local auth cache and tokens
    - _Requirements: 1.1, 1.2, 7.1, 7.2, 7.5, 7.7_

  - [x] 19.5 Implement Access Context refresh on error responses
    - When API returns ACCOUNT_SUSPENDED, SESSION_REVOKED, or AI_QUOTA_EXCEEDED, call GET /auth/context and update state
    - _Requirements: 13.12_

- [x] 20. Wire AI feature access control to UI components
  - [x] 20.1 Implement AI feature gating based on AI access state
    - "guest": disable AI features, show login prompt
    - "active": enable AI features
    - "quota_exceeded": disable AI features, show quota exceeded message with reset date
    - "suspended": disable AI features, show account suspended message
    - _Requirements: 13.8, 13.9, 13.10, 13.11_

- [x] 21. Implement transaction atomicity for multi-record operations
  - [x] 21.1 Wrap all multi-record Bridge API operations in database transactions
    - User upsert + entitlement creation + session upsert + audit log creation in POST /auth/exchange
    - Role assignment + audit log creation in role management
    - Session revocation + audit log creation in logout/revoke
    - _Requirements: 15.9, 15.10_

  - [x] 21.2 Write property test for transaction atomicity (Property 39)
    - **Property 39: Transaction Atomicity**
    - **Validates: Requirements 15.9, 15.10**

- [x] 22. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Property tests use fast-check with minimum 100 iterations per property
- All 40 correctness properties defined in the design document have corresponding property test sub-tasks
- Unit tests validate specific examples and edge cases; property tests validate universal correctness
- The Bridge API uses Node.js 20+ with TypeScript; the Client App uses React 18+ with Vitest
