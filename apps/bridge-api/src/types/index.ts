/**
 * Bridge API — TypeScript type definitions
 *
 * All data model interfaces for the authentication synchronization service.
 * These types represent the contract between the Bridge API, Firebase Auth,
 * Directus, and the Client App.
 */

// ---------------------------------------------------------------------------
// Primitive enumerations
// ---------------------------------------------------------------------------

/** Account lifecycle states for a user record. */
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

/** Subscription plan tiers. */
export type PlanCode = 'free' | 'pro' | 'enterprise';

/** Session lifecycle states. */
export type SessionState = 'active' | 'revoked';

/** Security risk assessment level for a user. */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Derived AI access state used by the Client App to gate AI features.
 * Computed from the Access Context — never stored directly.
 */
export type AIAccessState = 'guest' | 'active' | 'quota_exceeded' | 'suspended';

// ---------------------------------------------------------------------------
// Standard error codes
// ---------------------------------------------------------------------------

/**
 * Canonical error codes returned by the Bridge API.
 * All error responses use one of these codes in the `error.code` field.
 */
export const ErrorCode = {
  /** No authentication credentials were provided. */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /** Firebase ID token failed signature, expiry, issuer, or audience validation. */
  TOKEN_EXPIRED_OR_INVALID: 'TOKEN_EXPIRED_OR_INVALID',
  /** User account is suspended or deleted. */
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  /** User lacks the required permission for the requested operation. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  /** Monthly AI quota has been exhausted. */
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  /** Requested AI model is not in the user's allowed_models list. */
  MODEL_NOT_ALLOWED: 'MODEL_NOT_ALLOWED',
  /** The session has been explicitly revoked. */
  SESSION_REVOKED: 'SESSION_REVOKED',
  /** Too many requests in the current time window. */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// Core data model types
// ---------------------------------------------------------------------------

/**
 * Full user profile as stored in the Directus `users` collection.
 * Returned by GET /users/me and embedded in Access Context responses.
 */
export interface UserProfile {
  /** UUID primary key. */
  id: string;
  /** Unique identifier from Firebase Auth — immutable after creation. */
  firebase_uid: string;
  /** Normalized (lowercase, trimmed) email address — immutable after creation. */
  email: string;
  /** User's display name — mutable via PATCH /users/me. */
  display_name: string;
  /** URL to the user's avatar image — mutable via PATCH /users/me. */
  avatar_url: string | null;
  /** Current account lifecycle state. */
  status: UserStatus;
  /** Security risk assessment level. */
  risk_level: RiskLevel;
  /** ISO 8601 timestamp of account creation. */
  created_at: string;
  /** ISO 8601 timestamp of last profile update. */
  updated_at: string;
  /** ISO 8601 timestamp of the most recent successful login. */
  last_login_at: string;
}

/**
 * AI entitlement record for a user, sourced from the `user_entitlements` collection.
 * Includes a computed `remaining_quota` field for convenience.
 */
export interface UserEntitlement {
  /** Whether AI features are enabled for this user. */
  ai_enabled: boolean;
  /** Subscription plan tier. */
  plan_code: PlanCode;
  /** Maximum AI requests allowed in the current billing period. */
  monthly_quota: number;
  /** AI requests consumed in the current billing period. */
  used_quota: number;
  /** Computed: monthly_quota − used_quota. */
  remaining_quota: number;
  /** ISO 8601 timestamp when used_quota will reset to 0. */
  quota_reset_at: string;
  /** List of AI model identifiers the user is permitted to use. */
  allowed_models: string[];
  /** Maximum AI requests per minute (rate limit). */
  max_requests_per_minute: number;
}

/**
 * A single user session record from the `user_sessions` collection.
 */
export interface UserSession {
  /** UUID primary key. */
  id: string;
  /** Unique identifier for the device/client instance. */
  device_id: string;
  /** Current session lifecycle state. */
  session_state: SessionState;
  /** ISO 8601 timestamp of the last activity on this session. */
  last_seen_at: string;
  /** ISO 8601 timestamp when the session was revoked, or null if still active. */
  revoked_at: string | null;
  /** ISO 8601 timestamp when the session was created. */
  created_at: string;
}

// ---------------------------------------------------------------------------
// Request / Response types — POST /auth/exchange
// ---------------------------------------------------------------------------

/**
 * Request body for POST /auth/exchange.
 * The client sends a Firebase ID token and device identifier to obtain an Access Context.
 */
export interface ExchangeRequest {
  /** JWT issued by Firebase Auth after successful sign-in. */
  firebaseIdToken: string;
  /** Unique identifier for the device/client instance. */
  deviceId: string;
  /** Optional client application version string. */
  clientVersion?: string;
}

/**
 * Successful response from POST /auth/exchange.
 * Contains the full Access Context needed by the Client App to gate features.
 */
export interface ExchangeResponse {
  /** Current user profile. */
  user: {
    id: string;
    firebase_uid: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    status: UserStatus;
    last_login_at: string;
  };
  /** List of role codes assigned to the user (e.g. ['user', 'pro']). */
  roles: string[];
  /** Flat list of permission codes derived from the user's roles (e.g. ['ai.use']). */
  permissions: string[];
  /** AI entitlement details (without computed remaining_quota for wire format). */
  entitlement: {
    ai_enabled: boolean;
    plan_code: PlanCode;
    monthly_quota: number;
    used_quota: number;
    quota_reset_at: string;
    allowed_models: string[];
    max_requests_per_minute: number;
  };
  /** Active session details for the current device. */
  session: {
    id: string;
    device_id: string;
    session_state: 'active';
    last_seen_at: string;
  };
}

/**
 * Internal Access Context object used within the Bridge API and stored by the Client App.
 * Structurally equivalent to ExchangeResponse — kept as a separate type for clarity.
 */
export type AccessContext = ExchangeResponse;

// ---------------------------------------------------------------------------
// Request / Response types — POST /auth/logout
// ---------------------------------------------------------------------------

/** Request body for POST /auth/logout. */
export interface LogoutRequest {
  /** ID of the session to revoke. */
  sessionId: string;
}

/** Successful response from POST /auth/logout. */
export interface LogoutResponse {
  /** Whether the session was successfully revoked. */
  revoked: boolean;
  /** ISO 8601 timestamp when the session was revoked. */
  revoked_at: string;
}

// ---------------------------------------------------------------------------
// Request / Response types — PATCH /users/me
// ---------------------------------------------------------------------------

/**
 * Request body for PATCH /users/me.
 * Only display_name and avatar_url may be modified; all other fields are immutable.
 */
export interface UpdateProfileRequest {
  /** New display name (1–100 characters). */
  display_name?: string;
  /** New avatar URL, or null to remove the avatar. */
  avatar_url?: string | null;
}

// ---------------------------------------------------------------------------
// Request / Response types — GET /users/me/sessions
// ---------------------------------------------------------------------------

/** Response from GET /users/me/sessions. */
export interface SessionList {
  sessions: Array<{
    id: string;
    device_id: string;
    session_state: 'active';
    last_seen_at: string;
    created_at: string;
  }>;
}

// ---------------------------------------------------------------------------
// Request / Response types — POST /users/me/sessions/revoke
// ---------------------------------------------------------------------------

/** Request body for POST /users/me/sessions/revoke. */
export interface RevokeSessionRequest {
  /** ID of a specific session to revoke. Mutually exclusive with revokeAll. */
  sessionId?: string;
  /** When true, revoke all sessions except the current one. */
  revokeAll?: boolean;
}

/** Successful response from POST /users/me/sessions/revoke. */
export interface RevokeSessionResponse {
  /** Number of sessions that were revoked. */
  revoked_count: number;
  /** IDs of all sessions that were revoked. */
  revoked_session_ids: string[];
}

// ---------------------------------------------------------------------------
// Request / Response types — POST /ai/usage/consume
// ---------------------------------------------------------------------------

/** Request body for POST /ai/usage/consume. */
export interface ConsumeUsageRequest {
  /** Identifier of the AI model being used (must be in allowed_models). */
  model: string;
  /** Estimated token count for future token-based quota (optional). */
  estimated_tokens?: number;
}

/** Successful response from POST /ai/usage/consume. */
export interface ConsumeUsageResponse {
  /** Whether quota was successfully consumed. */
  consumed: boolean;
  /** Remaining quota after this consumption. */
  remaining_quota: number;
  /** ISO 8601 timestamp when the quota will reset. */
  quota_reset_at: string;
}

// ---------------------------------------------------------------------------
// Standard error response
// ---------------------------------------------------------------------------

/**
 * Uniform error response shape returned by all Bridge API error paths.
 */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code from the ErrorCode taxonomy. */
    code: ErrorCodeValue;
    /** Human-readable description of the error. */
    message: string;
    /** Correlation ID for tracing this error across logs. */
    trace_id: string;
    /** Optional additional context (validation errors, debug info). */
    details?: unknown;
  };
}
