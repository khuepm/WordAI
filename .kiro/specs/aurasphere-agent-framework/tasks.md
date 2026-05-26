# Implementation Plan: AuraSphere Agent Framework

## Overview

This plan implements the AuraSphere Agent Framework as a new module within `apps/bridge-api/src/agent/`. Phase 1 focuses on the complete core framework using MockProvider only — no real LLM integration needed. The implementation builds incrementally: types → providers → agents → tools → context → orchestration → routes → observability, ensuring each step integrates with the previous.

## Tasks

- [x] 1. Set up type definitions and shared interfaces
  - [x] 1.1 Create `src/agent/types.ts` with all shared type definitions
    - Define AgentMessage, ModelCapabilities, CompletionParams, CompletionResult
    - Define LLMProviderErrorCode, LLMProviderError
    - Define AgentTask, AgentResult, AgentStatus, AgentRole
    - Define ComplexityIndicators, TierDecision
    - Define ToolDefinition, ToolCall, ToolResult, ValidationError
    - Define ExecutionStep, StepType, FailurePolicy, BranchCondition, ExecutionPlan
    - Define OrchestratorEvent, OrchestrationResult
    - Define SSE event types and API request/response interfaces
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.9, 3.1, 4.1, 4.2, 7.1, 7.2_

  - [x] 1.2 Create `src/agent/errors/AgentError.ts` with structured error types
    - Define AgentErrorCode union type covering all error codes
    - Implement AgentError class extending Error with error_code, agent_id, task_id, recoverable
    - Implement isRecoverable() classification function
    - _Requirements: 8.1, 8.2, 1.12_

- [ ] 2. Implement LLM Provider Layer
  - [x] 2.1 Create `src/agent/providers/LLMProvider.ts` with the provider interface
    - Define LLMProvider interface with generateCompletion, generateStream, getModelCapabilities
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Create `src/agent/providers/LLMProviderRegistry.ts`
    - Implement register(), get(), has(), list() methods
    - Enforce MAX_PROVIDERS limit of 10
    - Return PROVIDER_NOT_FOUND error for unknown provider IDs
    - Replace existing provider on duplicate ID registration
    - Validate provider ID format (1-64 chars, alphanumeric and hyphens)
    - _Requirements: 1.5, 1.6, 1.13, 1.14_

  - [x] 2.3 Create `src/agent/providers/MockProvider.ts`
    - Implement LLMProvider interface with deterministic responses (hash first message)
    - Support configurable latency (0-30000ms, default 0)
    - Implement generateStream yielding deterministic token chunks
    - Return ModelCapabilities with max_context_length 128000
    - Validate input parameters and return INVALID_REQUEST for out-of-bounds values
    - _Requirements: 1.7, 1.8, 1.9, 1.15_

  - [x] 2.4 Write property test for MockProvider determinism
    - **Property 2: Tier Determinism (adapted for Mock)** — identical inputs always produce identical outputs
    - **Validates: Requirements 1.8**

  - [x] 2.5 Write property test for LLMProviderRegistry round-trip
    - **Property: Registry Round-trip** — register provider with ID X, retrieve by ID X returns same instance
    - **Validates: Requirements 1.5, 1.6, 1.13, 1.14**

- [x] 3. Implement Configuration and Error Infrastructure
  - [x] 3.1 Create `src/agent/config.ts` with configuration loader
    - Load from AURASPHERE_* environment variables
    - Load from JSON config file (AURASPHERE_CONFIG_PATH or default)
    - Env vars take precedence over config file
    - Validate all values at load time, report invalid keys with details
    - Default to development mode when AURASPHERE_MODE not set
    - In development mode, force MockProvider for all tiers
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.12, 9.13_

  - [x] 3.2 Create `src/agent/errors/CircuitBreaker.ts`
    - Track failures per provider with timestamps
    - Mark provider unhealthy after 5 consecutive failures within 60s window
    - Cooldown period of 30s before probe request
    - Implement isHealthy(), recordFailure(), recordSuccess(), reset()
    - _Requirements: 8.10, 8.11, 8.12_

  - [x] 3.3 Write property test for CircuitBreaker activation
    - **Property 10: Circuit Breaker Activation** — exactly 5 consecutive failures within 60s triggers unhealthy state
    - **Validates: Requirements 8.10**

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Tool System
  - [x] 5.1 Create `src/agent/tools/Tool.ts` with Tool interface
    - Define Tool interface with execute, getSchema, validateInput methods
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.2 Create `src/agent/tools/ToolRegistry.ts`
    - Implement register(), get(), has(), list() methods
    - Implement invoke() with access control check (TOOL_NOT_ALLOWED)
    - Validate input against JSON Schema (TOOL_INVALID_INPUT)
    - Enforce 30s execution timeout (TOOL_TIMEOUT)
    - Return TOOL_NOT_FOUND for unregistered tool IDs
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.10, 7.11, 7.12, 7.13_

  - [x] 5.3 Create `src/agent/tools/DocumentRetrievalTool.ts`
    - Implement Tool interface for document_retrieval
    - Accept document_id parameter, return stub content
    - Define JSON Schema for input validation
    - _Requirements: 7.8_

  - [x] 5.4 Create `src/agent/tools/WebSearchTool.ts`
    - Implement Tool interface for web_search placeholder
    - Accept query string parameter, return empty results array
    - Define JSON Schema for input validation
    - _Requirements: 7.9_

  - [x] 5.5 Write property test for Tool isolation
    - **Property 9: Tool Isolation** — agents can only invoke tools in their allowed_tools; others are blocked
    - **Validates: Requirements 7.5, 7.6**

- [x] 6. Implement Agent System
  - [x] 6.1 Create `src/agent/agents/BaseAgent.ts` with abstract base class
    - Implement AgentConfig validation (agent_id max 64 chars, system_prompt max 8000 chars, max_iterations 1-100)
    - Implement execute() with task-role validation, iteration counting, LLM call loop
    - Return TASK_ROLE_MISMATCH for mismatched task types
    - Enforce max_iterations limit, return partial result with status "max_iterations_reached"
    - Define abstract methods: buildSystemPrompt, evaluateCompletion, extractConfidence
    - _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [x] 6.2 Create `src/agent/agents/ResearchAgent.ts`
    - Extend BaseAgent with role "research"
    - Configure allowed_tools: document_retrieval, web_search
    - Implement research-focused system prompt and completion evaluation
    - _Requirements: 2.2_

  - [x] 6.3 Create `src/agent/agents/WriterAgent.ts`
    - Extend BaseAgent with role "writer"
    - Configure allowed_tools: document_retrieval
    - Implement writing-focused system prompt and completion evaluation
    - _Requirements: 2.3_

  - [x] 6.4 Create `src/agent/agents/EditorAgent.ts`
    - Extend BaseAgent with role "editor"
    - Configure allowed_tools: none
    - Implement editing-focused system prompt and completion evaluation
    - _Requirements: 2.4_

  - [x] 6.5 Create `src/agent/agents/FormatterAgent.ts`
    - Extend BaseAgent with role "formatter"
    - Configure allowed_tools: none
    - Implement formatting-focused system prompt and completion evaluation
    - _Requirements: 2.5_

  - [x] 6.6 Write property test for Agent role validation
    - **Property: Role Validation** — matching task type accepted, non-matching rejected with TASK_ROLE_MISMATCH
    - **Validates: Requirements 2.7, 2.8**

  - [x] 6.7 Write property test for Agent iteration bound
    - **Property: Iteration Bound** — LLM_Provider calls never exceed max_iterations
    - **Validates: Requirements 2.10, 2.11**

- [ ] 7. Implement Context Management
  - [x] 7.1 Create `src/agent/context/AgentContext.ts` with ContextManager
    - Implement create(), get(), addIntermediateResult(), addSharedKnowledge(), dispose()
    - Implement serialize()/deserialize() for JSON persistence
    - Implement retention timer with configurable duration (1min-24hr, default 30min)
    - Implement cleanup interval to dispose expired contexts
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 5.11_

  - [x] 7.2 Create `src/agent/context/ContextWindow.ts`
    - Implement fitToWindow() with token estimation (~4 chars/token)
    - Preserve system_prompt + most recent 3 messages when truncating
    - Implement summarization placeholder (falls back to truncation in Phase 1)
    - Summary budget: max 20% of max_context_length
    - Track current_tokens and max_tokens as observable metrics
    - _Requirements: 5.3, 5.4, 5.9, 5.10, 5.12_

  - [~] 7.3 Write property test for Context serialization round-trip
    - **Property 8: Context Round-trip** — deserialize(serialize(C)) produces structurally equal output
    - **Validates: Requirements 5.11**

  - [~] 7.4 Write property test for Token bound enforcement
    - **Property 4: Token Bound** — context passed to LLM never exceeds max_context_length
    - **Validates: Requirements 5.3**

- [~] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Tier Router and Execution Plan
  - [~] 9.1 Create `src/agent/orchestrator/TierRouter.ts`
    - Implement classify() with complexity indicator rules
    - Honor user_explicit_tier_selection override
    - Turbo: output < 500 tokens, no research, no multi-step
    - Pro: requires_research OR requires_multi_step OR output > 2000 tokens
    - Middle range (500-2000, no research, no multi-step): Turbo
    - Integrate with CircuitBreaker for provider health checks
    - Implement fallback to other tier when primary provider unhealthy
    - Return ALL_PROVIDERS_UNAVAILABLE when both fail
    - Log tier decisions with task_id, assigned_tier, reasoning
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.12, 4.13, 4.14_

  - [~] 9.2 Create `src/agent/orchestrator/ExecutionPlan.ts`
    - Define ExecutionPlan structure with DAG of ExecutionSteps
    - Implement validateDAG() using topological sort (cycle detection)
    - Support step types: sequential, parallel, conditional
    - Support failure policies: retry, skip, abort
    - Set max_execution_time_ms based on tier (120000 turbo, 300000 pro)
    - _Requirements: 3.1, 3.5_

  - [~] 9.3 Write property test for DAG acyclicity
    - **Property 1: DAG Acyclicity** — every generated ExecutionPlan passes topological sort
    - **Validates: Requirements 3.5**

  - [~] 9.4 Write property test for Tier determinism
    - **Property 2: Tier Determinism** — same complexity indicators always produce same tier
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [ ] 10. Implement Orchestrator and Workflow Templates
  - [~] 10.1 Create `src/agent/orchestrator/Orchestrator.ts`
    - Implement execute() with topological sort step execution
    - Support sequential execution (output feeds next agent's input)
    - Support parallel execution (Promise.all for independent steps, max 5 concurrent)
    - Support conditional branching (confidence threshold, pattern match)
    - Implement per-step failure policies (retry with backoff, skip with fallback, abort)
    - Enforce tier-specific timeout (120s turbo, 300s pro)
    - Emit execution events: plan_started, agent_started, agent_completed, agent_failed, plan_completed
    - Return partial results on abort/timeout with all completed step outputs
    - Integrate with ContextManager for intermediate result passing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.11, 3.12, 3.13_

  - [~] 10.2 Create workflow templates in `src/agent/orchestrator/templates/`
    - Create `index.ts` with template registry
    - Create `researchThenWrite.ts`: Research → Writer (sequential)
    - Create `writeThenEdit.ts`: Writer → Editor (sequential)
    - Create `researchWriteEditFormat.ts`: Research → Writer → Editor → Formatter (sequential)
    - _Requirements: 3.9, 3.10_

  - [~] 10.3 Implement retry logic with exponential backoff
    - Create withRetry() utility (max 3 retries, 1s base, 8s cap)
    - Handle rate-limit retry-after duration (up to 60s max wait)
    - Handle context-too-long with summarization retry (up to 2 times)
    - Treat CONTEXT_REDUCTION_FAILED as non-recoverable after exhaustion
    - _Requirements: 1.10, 1.11, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [~] 10.4 Write property test for Retry bound
    - **Property 3: Retry Bound** — no operation retried more than 3 times (4 total attempts)
    - **Validates: Requirements 8.3**

  - [~] 10.5 Write property test for Data flow integrity
    - **Property 5: Data Flow Integrity** — sequential agents receive complete upstream output_content
    - **Validates: Requirements 3.2**

  - [~] 10.6 Write property test for Parallel barrier
    - **Property 6: Parallel Barrier** — all parallel agents complete before dependent step begins
    - **Validates: Requirements 3.6**

- [~] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Bridge API Routes
  - [~] 12.1 Create `src/routes/agent.ts` with Express router
    - Implement POST /ai/agent/execute (validate request, auth, quota, execute task, return result)
    - Implement POST /ai/agent/stream (SSE with event ordering: task_accepted → agent_started → token_chunk → agent_completed → task_completed)
    - Implement GET /ai/agent/status/:taskId (return status, progress, result)
    - Implement GET /ai/agent/templates (list available workflow templates)
    - Implement GET /ai/agent/health (provider status, config validity, uptime)
    - Validate request body: intent (1-2000 chars), content (max 50000), tier_preference, template_id
    - Enforce 100KB request body size limit
    - Return HTTP 400 for validation failures with INVALID_REQUEST
    - Return HTTP 401 for missing/invalid session with AUTH_REQUIRED
    - Return HTTP 403 for quota exceeded with AI_QUOTA_EXCEEDED
    - Count each task execution as one quota unit
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15_

  - [~] 12.2 Create `src/agent/index.ts` as the AgentEngine entry point
    - Initialize LLMProviderRegistry with MockProvider
    - Initialize ToolRegistry with built-in tools
    - Initialize all 4 specialized agents
    - Initialize ContextManager, TierRouter, Orchestrator
    - Export AgentEngine class with execute() and executeStream() methods
    - Wire configuration loading and validation
    - _Requirements: 1.7, 9.1, 9.2_

  - [~] 12.3 Integrate agent routes into existing Express app in `src/index.ts`
    - Import and mount createAgentRouter at /ai/agent path
    - Initialize AgentEngine and pass to router
    - Ensure existing auth/quota middleware is reused
    - _Requirements: 6.7, 6.9_

  - [~] 12.4 Write property test for SSE event ordering
    - **Property: SSE Event Ordering** — events arrive in order: task_accepted → (agent_started → token_chunk* → agent_completed)+ → task_completed
    - **Validates: Requirements 6.13**

- [ ] 13. Implement Observability
  - [~] 13.1 Create `src/agent/observability/Logger.ts`
    - Leverage existing winston logger from bridge-api
    - Implement logAgentInvocation() with structured metadata
    - Implement logPlanSummary() with aggregated metrics
    - In dev mode: include full prompt/response content
    - In prod mode: metadata only, structured JSON format
    - Ensure logging is async and non-blocking
    - _Requirements: 10.1, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12_

  - [~] 13.2 Create `src/agent/observability/Metrics.ts`
    - Implement in-memory MetricsCollector with counters and histograms
    - Track: agent_execution_duration_ms, agent_token_usage, orchestration_plan_duration_ms, provider_request_count, tier_routing_decisions
    - Implement getSnapshot() for health endpoint consumption
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

  - [~] 13.3 Create `src/agent/observability/Tracer.ts`
    - Implement trace_id propagation from Bridge_API request through all agent invocations
    - Attach trace_id to all log entries and metrics
    - _Requirements: 10.8_

- [~] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Phase 1 uses MockProvider exclusively — no real LLM API keys needed
- The framework reuses existing bridge-api infrastructure: Express, Winston, auth middleware, quota service
- All new code lives under `apps/bridge-api/src/agent/` except the route file and index.ts integration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "5.2"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.3", "5.3", "5.4"] },
    { "id": 4, "tasks": ["5.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["6.6", "6.7", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4", "9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3", "9.4", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "10.5", "10.6"] },
    { "id": 11, "tasks": ["12.1", "12.2", "13.1", "13.2", "13.3"] },
    { "id": 12, "tasks": ["12.3", "12.4"] }
  ]
}
```
