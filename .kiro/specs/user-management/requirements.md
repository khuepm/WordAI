# Requirements Document: User Management

## Introduction

This document specifies the requirements for a comprehensive User Management system for the WordAI desktop application (React + Tauri). The system integrates Firebase for authentication (AuthN) with Directus/Lumibase for authorization and user data management (AuthZ), connected through a Bridge API. The system manages the complete user lifecycle, role-based access control, AI entitlement and quota management, multi-device session control, and comprehensive audit logging for compliance and security.

The architecture follows a clear separation of concerns:
- **Firebase**: Identity Provider (authentication)
- **Directus/Lumibase**: Source of truth for user domain data (authorization, profiles, entitlements)
- **Bridge API**: Integration layer that unifies the two systems
- **PostgreSQL/Supabase**: Database managed through Directus

## Glossary

- **User_Management_System**: The complete system encompassing authentication, authorization, profile management, and entitlement control
- **Firebase_Auth**: Firebase Authentication service providing identity verification and token issuance
- **Directus**: Headless CMS managing PostgreSQL schema, API configuration, and permission policies
- **Lumibase**: Open-source codebase for Directus providing schema management and migrations
- **Bridge_API**: Authentication synchronization service that verifies Firebase tokens and manages user data in Directus
- **Client_App**: React + Tauri desktop application
- **Access_Context**: Authorization payload containing user roles, permissions, and entitlements
- **User_Status**: Enumeration of user account states: pending, active, suspended, deleted
- **Role**: Named collection of permissions (guest, user, pro, admin, support)
- **Permission**: Atomic authorization grant (e.g., ai.use, user.manage, quota.override)
- **Entitlement**: User's AI access rights including quota, plan, and allowed models
- **Quota**: Request-based or token-based limit on AI service usage
- **Session**: Authenticated user connection bound to a specific device
- **Device_ID**: Unique identifier for each desktop application instance
- **Audit_Log**: Immutable record of sensitive system actions for compliance and investigation
- **Firebase_ID_Token**: JWT issued by Firebase Auth containing verified user identity
- **Firebase_UID**: Unique user identifier from Firebase Authentication
- **Actor**: User or system component performing an audited action
- **Soft_Delete**: Marking a record as deleted without physical removal from database

## Requirements

### Requirement 1: User Authentication and Token Exchange

**User Story:** As a user, I want to log in using Firebase authentication and have my identity synchronized with the application's authorization system, so that I can access features according to my permissions and entitlements.

#### Acceptance Criteria

1. WHEN a user successfully authenticates with Firebase_Auth, THE Client_App SHALL obtain a Firebase_ID_Token
2. WHEN the Client_App receives a Firebase_ID_Token, THE Client_App SHALL send the token and Device_ID to Bridge_API endpoint POST /auth/exchange
3. WHEN Bridge_API receives a valid Firebase_ID_Token, THE Bridge_API SHALL verify the token using Firebase public keys
4. WHEN Bridge_API successfully verifies a Firebase_ID_Token, THE Bridge_API SHALL extract the Firebase_UID from the token
5. WHEN Bridge_API extracts a Firebase_UID, THE Bridge_API SHALL upsert the user record in Directus users collection
6. WHEN Bridge_API upserts a user record for the first time, THE Bridge_API SHALL complete the operation within 2 seconds
7. WHEN Bridge_API successfully upserts a user, THE Bridge_API SHALL retrieve the user's roles, permissions, and entitlements from Directus
8. WHEN Bridge_API retrieves authorization data, THE Bridge_API SHALL construct an Access_Context containing role_codes, permission_codes, and entitlement details
9. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL return it to the Client_App
10. IF Bridge_API receives an invalid or expired Firebase_ID_Token, THEN THE Bridge_API SHALL return error code TOKEN_EXPIRED_OR_INVALID
11. WHEN a user's first login completes successfully, THE User_Management_System SHALL create an audit_log entry with action "user_created"

**Property-Based Testing Guidance:**
- **Idempotence**: Multiple token exchanges with the same Firebase_ID_Token SHALL produce equivalent Access_Context results (excluding timestamps)
- **Round-trip**: Serializing and deserializing Access_Context SHALL preserve all authorization data
- **Invariant**: After token exchange, the user record in Directus SHALL have firebase_uid matching the token's uid claim

### Requirement 2: User Profile Management

**User Story:** As a user, I want my profile information to be automatically synchronized and manageable, so that my display name and avatar are consistent across sessions and devices.

#### Acceptance Criteria

1. WHEN Bridge_API creates a new user record, THE Bridge_API SHALL populate firebase_uid, email, display_name, and avatar_url from the Firebase_ID_Token claims
2. WHEN Bridge_API creates a new user record, THE Bridge_API SHALL set status to "pending"
3. WHEN Bridge_API updates an existing user record during login, THE Bridge_API SHALL update display_name, avatar_url, and last_login_at
4. WHEN Bridge_API updates an existing user record, THE Bridge_API SHALL NOT modify firebase_uid, email, status, or risk_level without explicit admin action
5. WHEN a user requests their profile via GET /users/me, THE Bridge_API SHALL return the user's current profile data from Directus
6. WHEN a user updates their profile via PATCH /users/me, THE Client_App SHALL only allow modification of display_name and avatar_url
7. WHEN Bridge_API receives a profile update request, THE Bridge_API SHALL validate that only permitted fields are modified
8. IF a profile update request attempts to modify restricted fields, THEN THE Bridge_API SHALL return error code PERMISSION_DENIED
9. WHEN Bridge_API stores an email address, THE Bridge_API SHALL normalize it to lowercase and trim whitespace
10. THE User_Management_System SHALL enforce uniqueness constraint on firebase_uid
11. THE User_Management_System SHALL enforce uniqueness constraint on normalized email

**Property-Based Testing Guidance:**
- **Invariant**: After any profile update, firebase_uid and email SHALL remain unchanged
- **Normalization**: For all email inputs, normalize(normalize(email)) = normalize(email)
- **Idempotence**: Applying the same profile update twice SHALL produce the same final state

### Requirement 3: User Lifecycle State Machine

**User Story:** As an administrator, I want to manage user account states through a well-defined lifecycle, so that I can activate, suspend, reactivate, or delete user accounts with proper audit trails.

#### Acceptance Criteria

1. THE User_Management_System SHALL support user status values: pending, active, suspended, deleted
2. WHEN a new user is created, THE User_Management_System SHALL set status to "pending"
3. THE User_Management_System SHALL allow status transition from pending to active
4. THE User_Management_System SHALL allow status transition from active to suspended
5. THE User_Management_System SHALL allow status transition from suspended to active
6. THE User_Management_System SHALL allow status transition from active to deleted
7. THE User_Management_System SHALL allow status transition from suspended to deleted
8. THE User_Management_System SHALL NOT allow status transition from deleted to any other status
9. THE User_Management_System SHALL NOT allow status transition from pending to suspended
10. THE User_Management_System SHALL NOT allow status transition from pending to deleted
11. WHEN a user's status changes, THE User_Management_System SHALL create an audit_log entry with action "user_status_changed"
12. WHEN a user's status changes, THE Audit_Log SHALL record the actor_user_id, before_data, and after_data
13. WHEN a user's status is set to deleted, THE User_Management_System SHALL perform a soft delete (retain record with status=deleted)
14. WHEN a user's status is deleted or suspended, THE User_Management_System SHALL prevent creation of new sessions for that user

**Property-Based Testing Guidance:**
- **State machine validity**: For any sequence of valid transitions, the final status SHALL be reachable through the defined state machine
- **Audit completeness**: For every status change, there SHALL exist exactly one corresponding audit_log entry
- **Irreversibility**: Once status reaches "deleted", no sequence of operations SHALL change it to another status

### Requirement 4: Role-Based Access Control

**User Story:** As a system administrator, I want to assign roles to users and manage role-permission mappings, so that users have appropriate access to features based on their role.

#### Acceptance Criteria

1. THE User_Management_System SHALL support role codes: guest, user, pro, admin, support
2. THE User_Management_System SHALL maintain a roles collection defining each role_code and description
3. THE User_Management_System SHALL maintain a permissions collection defining permission codes and descriptions
4. THE User_Management_System SHALL maintain a role_permissions collection mapping roles to permissions
5. THE User_Management_System SHALL maintain a user_roles collection mapping users to roles
6. WHEN an administrator assigns a role to a user, THE User_Management_System SHALL create a user_roles record with user_id, role_code, assigned_at, and assigned_by
7. WHEN an administrator assigns a role to a user, THE User_Management_System SHALL create an audit_log entry with action "role_assigned"
8. WHEN an administrator removes a role from a user, THE User_Management_System SHALL delete the user_roles record
9. WHEN an administrator removes a role from a user, THE User_Management_System SHALL create an audit_log entry with action "role_removed"
10. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL retrieve all roles assigned to the user from user_roles
11. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL retrieve all permissions associated with the user's roles from role_permissions
12. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL include the complete list of role_codes and permission_codes
13. THE User_Management_System SHALL allow a user to have multiple roles simultaneously
14. WHEN an administrator modifies role_permissions mappings, THE User_Management_System SHALL create an audit_log entry with action "permission_changed"

**Property-Based Testing Guidance:**
- **Permission closure**: For any user with roles R, the set of permissions SHALL equal the union of permissions for all roles in R
- **Audit trail completeness**: For every role assignment or removal, there SHALL exist a corresponding audit_log entry
- **Role consistency**: If a user has role R at time T, then Access_Context generated at time T SHALL include all permissions associated with R

### Requirement 5: AI Entitlement and Quota Management

**User Story:** As a user, I want my AI service access to be governed by my subscription plan and quota limits, so that I can use AI features within my allocated usage limits.

#### Acceptance Criteria

1. THE User_Management_System SHALL maintain a user_entitlements collection with fields: user_id, ai_enabled, plan_code, monthly_quota, used_quota, quota_reset_at, allowed_models, max_requests_per_minute
2. THE User_Management_System SHALL support plan codes: free, pro, enterprise
3. WHEN a new user is created, THE User_Management_System SHALL create a user_entitlements record with default values for the free plan
4. THE User_Management_System SHALL enforce database constraint: used_quota <= monthly_quota
5. WHEN a user makes an AI request, THE Bridge_API SHALL verify the user's status is "active"
6. WHEN a user makes an AI request, THE Bridge_API SHALL verify the user has permission "ai.use"
7. WHEN a user makes an AI request, THE Bridge_API SHALL verify used_quota < monthly_quota
8. WHEN a user makes an AI request, THE Bridge_API SHALL verify the requested model is in allowed_models
9. IF any AI request verification fails, THEN THE Bridge_API SHALL return an appropriate error code: ACCOUNT_SUSPENDED, PERMISSION_DENIED, AI_QUOTA_EXCEEDED, or MODEL_NOT_ALLOWED
10. WHEN an AI request completes successfully, THE Bridge_API SHALL atomically increment used_quota by 1 using a database transaction
11. WHEN Bridge_API increments used_quota, THE Bridge_API SHALL use a SQL transaction to prevent race conditions
12. WHEN the current date reaches quota_reset_at, THE User_Management_System SHALL reset used_quota to 0
13. WHEN the current date reaches quota_reset_at, THE User_Management_System SHALL set quota_reset_at to the first day of the next month
14. WHEN an administrator overrides a user's quota, THE User_Management_System SHALL create an audit_log entry with action "entitlement_overridden"
15. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL include the complete entitlement object

**Property-Based Testing Guidance:**
- **Quota atomicity**: For N concurrent AI requests where used_quota + N <= monthly_quota, exactly N requests SHALL succeed and used_quota SHALL increase by exactly N
- **No negative quota**: For any sequence of quota operations, used_quota SHALL always be >= 0
- **No quota overflow**: For any sequence of quota operations, used_quota SHALL never exceed monthly_quota
- **Reset idempotence**: Applying quota reset multiple times on the same date SHALL produce the same result as applying it once
- **Model validation**: For any AI request with model M, the request SHALL succeed only if M is in allowed_models

### Requirement 6: Multi-Device Session Management

**User Story:** As a user, I want to manage my active sessions across multiple devices, so that I can revoke access from lost or compromised devices.

#### Acceptance Criteria

1. THE User_Management_System SHALL maintain a user_sessions collection with fields: id, user_id, device_id, session_state, last_seen_at, revoked_at
2. WHEN Bridge_API successfully exchanges a Firebase_ID_Token, THE Bridge_API SHALL create or update a user_sessions record for the Device_ID
3. WHEN Bridge_API creates a user_sessions record, THE Bridge_API SHALL set session_state to "active"
4. WHEN Bridge_API creates a user_sessions record, THE Bridge_API SHALL set last_seen_at to the current timestamp
5. WHEN a user requests their active sessions via GET /users/me/sessions, THE Bridge_API SHALL return all sessions where session_state is "active" and revoked_at is null
6. WHEN a user or administrator revokes a session via POST /users/me/sessions/revoke, THE Bridge_API SHALL set revoked_at to the current timestamp
7. WHEN a user or administrator revokes a session, THE Bridge_API SHALL set session_state to "revoked"
8. WHEN a user or administrator revokes a session, THE User_Management_System SHALL create an audit_log entry with action "session_revoked"
9. WHEN Bridge_API receives a token exchange request for a revoked session, THE Bridge_API SHALL return error code SESSION_REVOKED
10. WHEN a session is revoked, THE User_Management_System SHALL make the revocation effective within 60 seconds
11. THE User_Management_System SHALL allow multiple active sessions per user for different Device_IDs
12. THE User_Management_System SHALL enforce uniqueness constraint on (user_id, device_id) pairs in active sessions

**Property-Based Testing Guidance:**
- **Revocation effectiveness**: For any session S revoked at time T, all authentication attempts using S after T+60s SHALL fail
- **Session isolation**: Revoking session S1 SHALL NOT affect the validity of session S2 where S1 and S2 have different device_ids
- **Audit completeness**: For every session revocation, there SHALL exist exactly one audit_log entry with action "session_revoked"

### Requirement 7: Consistent Logout Across Systems

**User Story:** As a user, I want to log out completely from the application, so that my session is terminated in both Firebase and the application backend.

#### Acceptance Criteria

1. WHEN a user initiates logout, THE Client_App SHALL call Firebase signOut
2. WHEN a user initiates logout, THE Client_App SHALL call Bridge_API POST /auth/logout with the session_id
3. WHEN Bridge_API receives a logout request, THE Bridge_API SHALL revoke the specified session in user_sessions
4. WHEN Bridge_API revokes a session during logout, THE Bridge_API SHALL set revoked_at and session_state to "revoked"
5. WHEN a user initiates logout, THE Client_App SHALL clear all local authentication cache and tokens
6. WHEN logout completes, THE User_Management_System SHALL prevent the revoked session from being used for subsequent requests
7. THE Client_App SHALL complete all three logout steps (Firebase signOut, Bridge_API logout, local cache clear) before considering logout complete

**Property-Based Testing Guidance:**
- **Logout completeness**: After logout completes, attempting to use the previous session SHALL fail with SESSION_REVOKED
- **Idempotence**: Calling logout multiple times for the same session SHALL produce the same final state

### Requirement 8: Authorization Policy Evaluation

**User Story:** As a developer, I want the system to evaluate authorization policies consistently, so that access control decisions are predictable and auditable.

#### Acceptance Criteria

1. WHEN Bridge_API evaluates authorization for a request, THE Bridge_API SHALL retrieve the user's current roles from Directus
2. WHEN Bridge_API evaluates authorization for a request, THE Bridge_API SHALL retrieve the permissions associated with those roles from Directus
3. WHEN Bridge_API evaluates authorization for a request, THE Bridge_API SHALL retrieve the user's entitlement from Directus
4. WHEN Bridge_API constructs an Access_Context, THE Bridge_API SHALL include role_codes, permission_codes, and entitlement
5. WHEN Client_App receives an Access_Context, THE Client_App SHALL use it to determine feature availability
6. THE Bridge_API SHALL NOT trust role, permission, or quota data provided by the Client_App
7. THE Bridge_API SHALL always retrieve authorization data from Directus as the source of truth
8. WHEN a user requests their current authorization context via GET /auth/context, THE Bridge_API SHALL return a fresh Access_Context from Directus
9. THE User_Management_System SHALL define standard error codes: AUTH_REQUIRED, TOKEN_EXPIRED_OR_INVALID, ACCOUNT_SUSPENDED, PERMISSION_DENIED, AI_QUOTA_EXCEEDED, MODEL_NOT_ALLOWED, SESSION_REVOKED
10. WHEN an authorization check fails, THE Bridge_API SHALL return the appropriate error code from the standard taxonomy

**Property-Based Testing Guidance:**
- **Source of truth**: For any authorization decision, the result SHALL be determined solely by data in Directus, not by client-provided data
- **Consistency**: Two Access_Context requests for the same user at the same time SHALL return equivalent authorization data
- **Error determinism**: For a given authorization failure condition, the error code SHALL always be the same

### Requirement 9: Admin User Management Panel

**User Story:** As an administrator, I want to manage users through a centralized admin panel, so that I can perform user management tasks efficiently with proper audit trails.

#### Acceptance Criteria

1. THE User_Management_System SHALL provide a Directus CMS interface for user administration
2. WHEN an administrator searches for users, THE Directus_CMS SHALL support search by email and firebase_uid
3. WHEN an administrator views a user, THE Directus_CMS SHALL display user profile, status, roles, and entitlements
4. WHEN an administrator changes a user's status, THE User_Management_System SHALL validate the status transition against the state machine rules
5. WHEN an administrator assigns or removes a role, THE User_Management_System SHALL update user_roles and create an audit_log entry
6. WHEN an administrator overrides a user's quota, THE User_Management_System SHALL update user_entitlements and create an audit_log entry with action "entitlement_overridden"
7. WHEN an administrator revokes a user's session, THE User_Management_System SHALL update user_sessions and create an audit_log entry with action "session_revoked"
8. WHEN an administrator revokes all sessions for a user, THE User_Management_System SHALL revoke all active sessions and create audit_log entries for each
9. THE User_Management_System SHALL record the actor_user_id for all administrative actions in audit_logs
10. THE User_Management_System SHALL prevent administrators from modifying their own admin role assignment
11. WHEN an administrator modifies role_permissions mappings, THE User_Management_System SHALL require staging and approval before applying to production

**Property-Based Testing Guidance:**
- **Audit completeness**: For every administrative action (status change, role assignment, quota override, session revocation), there SHALL exist a corresponding audit_log entry
- **Actor traceability**: For every audit_log entry, the actor_user_id SHALL reference a valid user with admin or support role

### Requirement 10: Comprehensive Audit Logging

**User Story:** As a compliance officer, I want all sensitive system actions to be logged immutably, so that I can investigate security incidents and demonstrate compliance.

#### Acceptance Criteria

1. THE User_Management_System SHALL maintain an audit_logs collection with fields: id, actor_user_id, action, resource, before_data, after_data, created_at
2. THE User_Management_System SHALL create audit_log entries for actions: user_created, user_status_changed, role_assigned, role_removed, permission_changed, entitlement_overridden, session_revoked
3. WHEN an audit_log entry is created, THE User_Management_System SHALL record the actor_user_id of the user or system performing the action
4. WHEN an audit_log entry is created for a data modification, THE User_Management_System SHALL record before_data and after_data as JSON
5. WHEN an audit_log entry is created, THE User_Management_System SHALL set created_at to the current timestamp
6. THE User_Management_System SHALL make audit_logs immutable (no updates or deletes allowed)
7. THE User_Management_System SHALL retain audit_logs according to compliance requirements (minimum 1 year)
8. WHEN an administrator queries audit_logs, THE Directus_CMS SHALL support filtering by actor_user_id, action, resource, and date range
9. THE User_Management_System SHALL include a trace_id in audit_logs for correlating related actions
10. WHEN a system component performs an automated action, THE User_Management_System SHALL record actor_user_id as a system user identifier

**Property-Based Testing Guidance:**
- **Immutability**: Once an audit_log entry is created, it SHALL never be modified or deleted
- **Completeness**: For every sensitive action defined in the action taxonomy, there SHALL exist a corresponding audit_log entry
- **Temporal ordering**: For any sequence of related actions, the audit_log entries SHALL have created_at timestamps in the same order

### Requirement 11: Security and Token Verification

**User Story:** As a security engineer, I want all authentication tokens to be cryptographically verified, so that the system is protected against token forgery and unauthorized access.

#### Acceptance Criteria

1. WHEN Bridge_API receives a Firebase_ID_Token, THE Bridge_API SHALL verify the token signature using Firebase public keys
2. WHEN Bridge_API verifies a Firebase_ID_Token, THE Bridge_API SHALL validate the token expiration time
3. WHEN Bridge_API verifies a Firebase_ID_Token, THE Bridge_API SHALL validate the token issuer matches Firebase
4. WHEN Bridge_API verifies a Firebase_ID_Token, THE Bridge_API SHALL validate the token audience matches the application's Firebase project ID
5. IF any token verification check fails, THEN THE Bridge_API SHALL reject the token and return error code TOKEN_EXPIRED_OR_INVALID
6. THE Bridge_API SHALL NOT expose the Directus admin token to the Client_App
7. THE Bridge_API SHALL use the Directus admin token only for server-side API calls to Directus
8. THE User_Management_System SHALL implement rate limiting on POST /auth/exchange endpoint
9. THE User_Management_System SHALL implement rate limiting on POST /ai/usage/consume endpoint
10. WHEN rate limit is exceeded, THE Bridge_API SHALL return error code RATE_LIMIT_EXCEEDED
11. THE User_Management_System SHALL log all failed authentication attempts with reason codes
12. THE User_Management_System SHALL alert administrators when failed authentication attempts exceed threshold

**Property-Based Testing Guidance:**
- **Token rejection**: For any invalid token (expired, wrong signature, wrong issuer, wrong audience), verification SHALL fail
- **Rate limiting effectiveness**: For N+1 requests in a time window with limit N, exactly N SHALL succeed and 1 SHALL fail with RATE_LIMIT_EXCEEDED

### Requirement 12: Database Schema Management with Lumibase

**User Story:** As a database administrator, I want database schema changes to be version-controlled and reversible, so that I can safely evolve the schema and rollback if needed.

#### Acceptance Criteria

1. THE User_Management_System SHALL define all Directus collections using Lumibase migrations
2. THE User_Management_System SHALL organize migrations into groups: 001_users_core, 002_roles_permissions, 003_entitlements_sessions, 004_audit
3. WHEN a migration is applied, THE Lumibase SHALL record the migration version in a schema_migrations table
4. THE User_Management_System SHALL provide rollback scripts for each migration
5. WHEN a migration is rolled back, THE Lumibase SHALL restore the schema to the previous version
6. THE User_Management_System SHALL include seed data migrations for default roles: guest, user, pro, admin, support
7. THE User_Management_System SHALL include seed data migrations for baseline permissions: ai.use, ai.use.pro_model, user.manage, quota.override
8. THE User_Management_System SHALL include seed data migrations for default role_permissions mappings
9. WHEN a migration creates a collection, THE migration SHALL define all fields, data types, constraints, and indexes
10. THE User_Management_System SHALL enforce database constraints: firebase_uid unique, email unique, used_quota <= monthly_quota
11. THE User_Management_System SHALL enforce foreign key constraints between collections (user_roles.user_id → users.id, etc.)

**Property-Based Testing Guidance:**
- **Migration idempotence**: Applying a migration that is already applied SHALL have no effect
- **Rollback correctness**: For any migration M, applying M then rolling back M SHALL restore the schema to its original state
- **Constraint enforcement**: For any constraint C defined in migrations, the database SHALL reject operations that violate C

### Requirement 13: Client Application State Management

**User Story:** As a user, I want the application to display my current authorization state accurately, so that I understand what features are available to me.

#### Acceptance Criteria

1. WHEN Client_App receives an Access_Context from Bridge_API, THE Client_App SHALL store it in application state
2. WHEN Client_App stores an Access_Context, THE Client_App SHALL determine the user's AI access state
3. THE Client_App SHALL support AI access states: guest, active, quota_exceeded, suspended
4. WHEN a user has no active session, THE Client_App SHALL display AI access state as "guest"
5. WHEN a user has status "active" and used_quota < monthly_quota and ai_enabled is true, THE Client_App SHALL display AI access state as "active"
6. WHEN a user has status "active" and used_quota >= monthly_quota, THE Client_App SHALL display AI access state as "quota_exceeded"
7. WHEN a user has status "suspended", THE Client_App SHALL display AI access state as "suspended"
8. WHEN Client_App displays AI access state "guest", THE Client_App SHALL disable AI features and show login prompt
9. WHEN Client_App displays AI access state "active", THE Client_App SHALL enable AI features
10. WHEN Client_App displays AI access state "quota_exceeded", THE Client_App SHALL disable AI features and show quota exceeded message
11. WHEN Client_App displays AI access state "suspended", THE Client_App SHALL disable AI features and show account suspended message
12. WHEN an API call returns error code ACCOUNT_SUSPENDED, SESSION_REVOKED, or AI_QUOTA_EXCEEDED, THE Client_App SHALL refresh the Access_Context and update the displayed state

**Property-Based Testing Guidance:**
- **State consistency**: For any Access_Context A, the derived AI access state SHALL be deterministic and consistent
- **State transitions**: For any valid state transition in the backend, the Client_App SHALL reflect the new state after refreshing Access_Context

### Requirement 14: Observability and Monitoring

**User Story:** As a site reliability engineer, I want comprehensive metrics and alerts for the user management system, so that I can detect and respond to issues proactively.

#### Acceptance Criteria

1. THE User_Management_System SHALL emit metric: login_success_rate (percentage of successful logins)
2. THE User_Management_System SHALL emit metric: auth_exchange_latency_p95 (95th percentile latency for POST /auth/exchange)
3. THE User_Management_System SHALL emit metric: ai_denied_rate_by_reason (count of AI request denials grouped by error code)
4. THE User_Management_System SHALL emit metric: quota_exhausted_users (count of users with used_quota >= monthly_quota)
5. THE User_Management_System SHALL emit metric: active_sessions_count (count of active sessions)
6. THE User_Management_System SHALL emit metric: failed_auth_attempts_count (count of failed authentication attempts)
7. THE User_Management_System SHALL create alert when login_success_rate drops below 95%
8. THE User_Management_System SHALL create alert when auth_exchange_latency_p95 exceeds 2 seconds
9. THE User_Management_System SHALL create alert when failed_auth_attempts_count increases by more than 50% in 5 minutes
10. THE User_Management_System SHALL create alert when database transaction errors occur in quota consumption
11. THE User_Management_System SHALL log all error responses with error code, user_id, and request context
12. THE User_Management_System SHALL provide dashboards displaying key metrics and recent audit events

**Property-Based Testing Guidance:**
- **Metric accuracy**: For any time window, login_success_rate SHALL equal (successful_logins / total_login_attempts) * 100
- **Alert triggering**: When a metric crosses its threshold, an alert SHALL be created within 1 minute

### Requirement 15: API Idempotency and Error Handling

**User Story:** As a client application developer, I want API operations to be idempotent where appropriate, so that I can safely retry failed requests without causing duplicate side effects.

#### Acceptance Criteria

1. WHEN Bridge_API receives multiple POST /auth/exchange requests with the same Firebase_ID_Token and Device_ID, THE Bridge_API SHALL return equivalent Access_Context responses
2. WHEN Bridge_API upserts a user during token exchange, THE operation SHALL be idempotent (multiple calls produce the same final state)
3. WHEN Bridge_API revokes a session that is already revoked, THE operation SHALL succeed without error
4. WHEN Bridge_API resets quota for a user whose quota is already reset, THE operation SHALL be idempotent
5. WHEN Bridge_API receives a malformed request, THE Bridge_API SHALL return HTTP 400 with a descriptive error message
6. WHEN Bridge_API encounters a database error, THE Bridge_API SHALL return HTTP 500 and log the error with trace_id
7. WHEN Bridge_API encounters a Directus API error, THE Bridge_API SHALL return HTTP 502 and log the error with trace_id
8. WHEN Bridge_API returns an error response, THE response SHALL include an error code, message, and trace_id
9. THE Bridge_API SHALL use database transactions for operations that modify multiple records
10. IF a database transaction fails, THEN THE Bridge_API SHALL rollback all changes and return an error

**Property-Based Testing Guidance:**
- **Idempotence**: For any idempotent operation O, performing O multiple times SHALL produce the same final state as performing O once
- **Transaction atomicity**: For any multi-record operation, either all changes SHALL be committed or all changes SHALL be rolled back
- **Error consistency**: For the same error condition, the error code and message SHALL be consistent across requests

