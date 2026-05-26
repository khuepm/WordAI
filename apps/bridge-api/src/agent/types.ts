/**
 * AuraSphere Agent Framework — Shared Type Definitions
 *
 * All interfaces, types, and enumerations used across the agent framework.
 * This file serves as the single source of truth for the framework's type system.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.9, 3.1, 4.1, 4.2, 7.1, 7.2
 */

// ---------------------------------------------------------------------------
// LLM Provider Layer (Requirement 1)
// ---------------------------------------------------------------------------

/**
 * A structured message exchanged between agents and the LLM provider.
 * Follows the OpenAI-compatible message format.
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * Capabilities reported by an LLM provider, used for routing and context management.
 */
export interface ModelCapabilities {
  max_context_length: number;
  supports_function_calling: boolean;
  supports_streaming: boolean;
  supported_output_formats: string[];
}

/**
 * Parameters for an LLM completion request.
 */
export interface CompletionParams {
  messages: AgentMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
  stop_sequences?: string[];
  tools?: ToolDefinition[];
}

/**
 * Result returned from an LLM completion call.
 */
export interface CompletionResult {
  content: string;
  tokens_used: number;
  finish_reason: 'stop' | 'max_tokens' | 'tool_call';
  tool_calls?: ToolCall[];
}

/**
 * Standard error codes for LLM provider failures.
 */
export type LLMProviderErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CONTEXT_TOO_LONG'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR';

/**
 * Structured error from an LLM provider.
 */
export interface LLMProviderError {
  provider_id: string;
  error_code: LLMProviderErrorCode;
  message: string;
  retry_after_ms?: number;
}

// ---------------------------------------------------------------------------
// Agent System (Requirement 2)
// ---------------------------------------------------------------------------

/** Specialized roles available in the agent framework. */
export type AgentRole = 'research' | 'writer' | 'editor' | 'formatter';

/** Terminal status of an agent execution. */
export type AgentStatus = 'success' | 'error' | 'partial' | 'max_iterations_reached';

/**
 * Configuration for an agent instance.
 */
export interface AgentConfig {
  /** Unique identifier for the agent (max 64 characters). */
  agent_id: string;
  /** Specialized role of the agent. */
  role: AgentRole;
  /** System prompt defining the agent's behavior (max 8000 characters). */
  system_prompt: string;
  /** Tool identifiers this agent is allowed to invoke. */
  allowed_tools: string[];
  /** Performance tiers this agent supports. */
  supported_tiers: ('turbo' | 'pro')[];
  /** Maximum LLM calls per execution (1-100, default 10). */
  max_iterations: number;
}

/**
 * A unit of work submitted to the Agent Engine.
 */
export interface AgentTask {
  task_id: string;
  /** User intent describing what to accomplish (1-2000 characters). */
  intent: string;
  /** Optional content to process (max 50000 characters). */
  content?: string;
  /** User's explicit tier preference. */
  tier_preference?: 'turbo' | 'pro';
  /** Optional workflow template to use. */
  template_id?: string;
  /** Authenticated user ID. */
  user_id: string;
  /** Distributed tracing identifier. */
  trace_id: string;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** Derived complexity indicators (computed by TierRouter). */
  complexity?: ComplexityIndicators;
}

/**
 * Result produced by an agent after processing a task.
 */
export interface AgentResult {
  status: AgentStatus;
  /** Generated content (non-empty on success). */
  output_content: string;
  /** Confidence in the output quality (0.0 - 1.0). */
  confidence_score: number;
  /** Total tokens consumed during execution. */
  tokens_used: number;
  /** Wall-clock time for the execution in milliseconds. */
  processing_time_ms: number;
}

// ---------------------------------------------------------------------------
// Tier Router (Requirement 4)
// ---------------------------------------------------------------------------

/**
 * Complexity indicators used by the TierRouter to classify tasks.
 */
export interface ComplexityIndicators {
  estimated_output_length: number;
  requires_research: boolean;
  requires_multi_step: boolean;
  user_explicit_tier_selection?: 'turbo' | 'pro';
}

/**
 * Decision output from the TierRouter.
 */
export interface TierDecision {
  tier: 'turbo' | 'pro';
  reasoning: string;
  provider_id: string;
}

// ---------------------------------------------------------------------------
// Tool System (Requirement 7)
// ---------------------------------------------------------------------------

/**
 * Schema definition for a tool, following OpenAI function-calling format.
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

/**
 * A tool invocation request from the LLM.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON-encoded arguments
  };
}

/**
 * Result of a tool execution.
 */
export interface ToolResult {
  success: boolean;
  output: unknown;
  execution_time_ms: number;
  error_message?: string;
}

/**
 * Validation error for tool input.
 */
export interface ValidationError {
  field_path: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Orchestration Engine (Requirement 3)
// ---------------------------------------------------------------------------

/** Execution mode for a step in the plan. */
export type StepType = 'sequential' | 'parallel' | 'conditional';

/** Policy for handling step failures. */
export type FailurePolicy = 'retry' | 'skip' | 'abort';

/**
 * A single step in an execution plan DAG.
 */
export interface ExecutionStep {
  step_id: string;
  agent_role: AgentRole;
  step_type: StepType;
  /** Step IDs this step depends on (must complete before this step runs). */
  depends_on: string[];
  failure_policy: FailurePolicy;
  /** Fallback value used when failure_policy is 'skip'. */
  fallback_value?: string;
  /** Branch condition used when step_type is 'conditional'. */
  condition?: BranchCondition;
}

/**
 * Condition for conditional branching in the execution plan.
 */
export interface BranchCondition {
  source_step_id: string;
  type: 'confidence_threshold' | 'pattern_match';
  /** Minimum confidence score (for confidence_threshold type). */
  threshold?: number;
  /** Regex pattern to match against output (for pattern_match type). */
  pattern?: string;
}

/**
 * A directed acyclic graph of execution steps for a task.
 */
export interface ExecutionPlan {
  plan_id: string;
  task_id: string;
  tier: 'turbo' | 'pro';
  steps: ExecutionStep[];
  /** Maximum allowed execution time: 120000ms for turbo, 300000ms for pro. */
  max_execution_time_ms: number;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

/**
 * Events emitted during orchestration for observability.
 */
export interface OrchestratorEvent {
  type:
    | 'plan_started'
    | 'agent_started'
    | 'agent_completed'
    | 'agent_failed'
    | 'plan_completed';
  task_id: string;
  timestamp: string;
  agent_id?: string;
  data?: Record<string, unknown>;
}

/**
 * Final result of an orchestrated execution plan.
 */
export interface OrchestrationResult {
  status: 'success' | 'partial' | 'timeout_exceeded' | 'aborted';
  /** Final agent's output content. */
  output_content: string;
  /** IDs of all agents that participated. */
  agents_used: string[];
  /** Results keyed by step_id. */
  step_results: Map<string, AgentResult>;
  /** Total tokens consumed across all agents. */
  total_tokens: number;
  /** Total wall-clock execution time in milliseconds. */
  execution_time_ms: number;
  /** Error details if the plan did not fully succeed. */
  error?: LLMProviderError;
}

// ---------------------------------------------------------------------------
// Workflow Templates
// ---------------------------------------------------------------------------

/**
 * A predefined execution pattern for common content workflows.
 */
export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  steps: ExecutionStep[];
}

// ---------------------------------------------------------------------------
// Bridge API — Request/Response Interfaces (Requirement 6)
// ---------------------------------------------------------------------------

/**
 * Request body for POST /ai/agent/execute and POST /ai/agent/stream.
 */
export interface AgentExecuteRequest {
  /** User intent (required, 1-2000 characters). */
  intent: string;
  /** Optional content to process (max 50000 characters). */
  content?: string;
  /** Optional tier preference. */
  tier_preference?: 'turbo' | 'pro';
  /** Optional workflow template ID. */
  template_id?: string;
}

/**
 * Response from POST /ai/agent/execute.
 */
export interface AgentExecuteResponse {
  task_id: string;
  status: 'success' | 'partial' | 'timeout_exceeded';
  output_content: string;
  agents_used: string[];
  total_tokens: number;
  execution_time_ms: number;
  tier_used: 'turbo' | 'pro';
}

/**
 * Response from GET /ai/agent/status/:taskId.
 */
export interface AgentStatusResponse {
  task_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_percentage: number;
  result?: AgentExecuteResponse;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// SSE Event Types (Requirement 6 — Streaming)
// ---------------------------------------------------------------------------

export interface SSETaskAcceptedEvent {
  event: 'task_accepted';
  data: { task_id: string; tier: string };
}

export interface SSEAgentStartedEvent {
  event: 'agent_started';
  data: { agent_id: string; role: string };
}

export interface SSETokenChunkEvent {
  event: 'token_chunk';
  data: { content: string };
}

export interface SSEAgentCompletedEvent {
  event: 'agent_completed';
  data: { agent_id: string; tokens_used: number };
}

export interface SSETaskCompletedEvent {
  event: 'task_completed';
  data: AgentExecuteResponse;
}

/** Union of all SSE event types emitted during streaming execution. */
export type SSEEvent =
  | SSETaskAcceptedEvent
  | SSEAgentStartedEvent
  | SSETokenChunkEvent
  | SSEAgentCompletedEvent
  | SSETaskCompletedEvent;

// ---------------------------------------------------------------------------
// Health & Templates API Responses
// ---------------------------------------------------------------------------

/**
 * Response from GET /ai/agent/health.
 */
export interface AgentHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  provider_status: Record<string, 'connected' | 'disconnected'>;
  configuration_valid: boolean;
  uptime_seconds: number;
}

/**
 * Response from GET /ai/agent/templates.
 */
export interface AgentTemplatesResponse {
  templates: Array<{
    template_id: string;
    name: string;
    description: string;
    agents_involved: string[];
  }>;
}
