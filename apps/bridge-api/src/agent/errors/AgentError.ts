/**
 * AuraSphere Agent Framework — Structured Error Types
 *
 * Defines the error taxonomy for the agent engine, including error codes,
 * a custom error class, and recoverability classification.
 *
 * @module agent/errors/AgentError
 */

// ---------------------------------------------------------------------------
// LLM Provider Error Codes
// ---------------------------------------------------------------------------

/**
 * Error codes specific to LLM Provider interactions.
 * These represent failures at the provider communication layer.
 */
export type LLMProviderErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CONTEXT_TOO_LONG'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR';

// ---------------------------------------------------------------------------
// Agent Error Codes (superset of LLMProviderErrorCode)
// ---------------------------------------------------------------------------

/**
 * Complete error code taxonomy for the AuraSphere Agent Engine.
 * Includes all LLM provider errors plus agent-specific, tool, and API errors.
 */
export type AgentErrorCode =
  | LLMProviderErrorCode
  | 'TASK_ROLE_MISMATCH'
  | 'AGENT_ID_DUPLICATE'
  | 'TOOL_NOT_ALLOWED'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_INVALID_INPUT'
  | 'TOOL_TIMEOUT'
  | 'TOOL_NOT_REGISTERED'
  | 'PROVIDER_NOT_FOUND'
  | 'ALL_PROVIDERS_UNAVAILABLE'
  | 'CONTEXT_REDUCTION_FAILED'
  | 'AI_QUOTA_EXCEEDED'
  | 'AUTH_REQUIRED';

// ---------------------------------------------------------------------------
// AgentError Class
// ---------------------------------------------------------------------------

/**
 * Structured error class for the AuraSphere Agent Engine.
 *
 * Extends the built-in Error with machine-readable error_code, optional
 * agent_id and task_id for traceability, and a recoverable flag indicating
 * whether the operation can be retried.
 */
export class AgentError extends Error {
  public readonly name = 'AgentError';

  constructor(
    public readonly error_code: AgentErrorCode,
    message: string,
    public readonly agent_id?: string,
    public readonly task_id?: string,
    public readonly recoverable: boolean = false,
  ) {
    super(message);

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

/** Error codes that are considered recoverable (safe to retry). */
const RECOVERABLE_CODES: ReadonlySet<AgentErrorCode> = new Set<AgentErrorCode>([
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'CONTEXT_TOO_LONG',
]);

/**
 * Determines whether an error code represents a recoverable condition.
 *
 * Recoverable errors are those where a retry (possibly with modified context)
 * has a reasonable chance of succeeding:
 * - PROVIDER_UNAVAILABLE — transient network/service issue
 * - RATE_LIMITED — temporary throttling, retry after backoff
 * - CONTEXT_TOO_LONG — can be retried with reduced/summarized context
 *
 * @param code - The error code to classify
 * @returns true if the error is recoverable, false otherwise
 */
export function isRecoverable(code: AgentErrorCode): boolean {
  return RECOVERABLE_CODES.has(code);
}
