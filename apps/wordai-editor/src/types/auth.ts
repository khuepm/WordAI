/**
 * Client App authentication and authorization types.
 *
 * These types mirror the Bridge API contract defined in apps/bridge-api/src/types/index.ts
 * and are used by the Client App to manage auth state and gate AI features.
 *
 * Requirements: 1.1, 1.2, 7.1, 7.2, 13.1–13.12
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

/**
 * Derived AI access state used by the Client App to gate AI features.
 * Computed from the Access Context — never stored directly.
 *
 * Requirements: 13.3
 */
export type AIAccessState = 'guest' | 'active' | 'quota_exceeded' | 'suspended';

// ---------------------------------------------------------------------------
// Access Context — mirrors ExchangeResponse from Bridge API
// ---------------------------------------------------------------------------

/**
 * Authorization payload returned by POST /auth/exchange and GET /auth/context.
 * Stored in application state after a successful token exchange.
 *
 * Requirements: 1.8, 1.9, 13.1
 */
export interface AccessContext {
  user: {
    id: string;
    firebase_uid: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    status: UserStatus;
    last_login_at: string;
  };
  /** Role codes assigned to the user (e.g. ['user', 'pro']). */
  roles: string[];
  /** Permission codes derived from the user's roles (e.g. ['ai.use']). */
  permissions: string[];
  entitlement: {
    ai_enabled: boolean;
    plan_code: PlanCode;
    monthly_quota: number;
    used_quota: number;
    quota_reset_at: string;
    allowed_models: string[];
    max_requests_per_minute: number;
  };
  session: {
    id: string;
    device_id: string;
    session_state: 'active';
    last_seen_at: string;
  };
}

// ---------------------------------------------------------------------------
// Bridge API error codes
// ---------------------------------------------------------------------------

/**
 * Canonical error codes returned by the Bridge API.
 * Requirements: 8.9, 13.12
 */
export const BridgeErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TOKEN_EXPIRED_OR_INVALID: 'TOKEN_EXPIRED_OR_INVALID',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  MODEL_NOT_ALLOWED: 'MODEL_NOT_ALLOWED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type BridgeErrorCodeValue = (typeof BridgeErrorCode)[keyof typeof BridgeErrorCode];

/** Error response shape returned by all Bridge API error paths. */
export interface BridgeErrorResponse {
  error: {
    code: BridgeErrorCodeValue;
    message: string;
    trace_id: string;
    details?: unknown;
  };
}
