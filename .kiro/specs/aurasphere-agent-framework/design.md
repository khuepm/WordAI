# Design Document

## Overview

This document describes the technical design for the AuraSphere Agent Framework — a multi-agent orchestration engine that integrates with WordAI's existing bridge-api. The design follows an "Agent-first, LLM-later" philosophy, enabling full development and testing with mock providers before any real LLM is deployed.

The framework is implemented as a new module within the existing `apps/bridge-api` TypeScript project, leveraging the same Express server, authentication, and quota infrastructure already in place.

## Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WordAI Editor (Tauri 2)                       │
│                     React Frontend + Rust Backend                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / SSE
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Bridge API (Express)                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Auth     │  │ AI Usage     │  │ Agent Routes │  │ User Prefs│  │
│  │ Routes   │  │ Routes       │  │ (NEW)        │  │ Routes    │  │
│  └──────────┘  └──────────────┘  └──────┬───────┘  └───────────┘  │
│                                          │                           │
│  ┌───────────────────────────────────────┴───────────────────────┐  │
│  │                   AuraSphere Agent Engine                      │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Tier Router │  │ Orchestrator │  │ Context Manager     │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └─────────────────────┘  │  │
│  │         │                 │                                    │  │
│  │  ┌──────┴──────┐  ┌──────┴───────────────────────────────┐   │  │
│  │  │ LLM Provider│  │            Agent Pool                 │   │  │
│  │  │ Registry    │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ │   │  │
│  │  │             │  │  │Resrch│ │Writer│ │Editor│ │Fmttr│ │   │  │
│  │  │ ┌─────────┐ │  │  └──────┘ └──────┘ └──────┘ └─────┘ │   │  │
│  │  │ │Mock     │ │  └──────────────────────────────────────┘   │  │
│  │  │ │OpenAI   │ │                                              │  │
│  │  │ │SelfHost │ │  ┌──────────────────────────────────────┐   │  │
│  │  │ └─────────┘ │  │          Tool Registry               │   │  │
│  │  └─────────────┘  │  ┌────────────┐  ┌─────────────┐    │   │  │
│  │                    │  │doc_retrieve│  │web_search   │    │   │  │
│  │                    │  └────────────┘  └─────────────┘    │   │  │
│  │                    └──────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
apps/bridge-api/src/
├── agent/                          # NEW: AuraSphere Agent Engine
│   ├── index.ts                    # Engine initialization & exports
│   ├── config.ts                   # Configuration loader & validator
│   ├── types.ts                    # All shared type definitions
│   ├── providers/
│   │   ├── LLMProvider.ts          # LLM_Provider interface
│   │   ├── LLMProviderRegistry.ts  # Provider registry
│   │   ├── MockProvider.ts         # Mock implementation
│   │   └── OpenAIProvider.ts       # OpenAI-compatible provider
│   ├── agents/
│   │   ├── BaseAgent.ts            # Abstract base agent class
│   │   ├── ResearchAgent.ts        # Research agent
│   │   ├── WriterAgent.ts          # Writer agent
│   │   ├── EditorAgent.ts          # Editor agent
│   │   └── FormatterAgent.ts       # Formatter agent
│   ├── orchestrator/
│   │   ├── Orchestrator.ts         # Main orchestration logic
│   │   ├── ExecutionPlan.ts        # DAG execution plan
│   │   ├── TierRouter.ts           # Tier classification & routing
│   │   └── templates/
│   │       ├── index.ts            # Template registry
│   │       ├── researchThenWrite.ts
│   │       ├── writeThenEdit.ts
│   │       └── researchWriteEditFormat.ts
│   ├── context/
│   │   ├── AgentContext.ts         # Context state management
│   │   └── ContextWindow.ts        # Token tracking & summarization
│   ├── tools/
│   │   ├── Tool.ts                 # Tool interface
│   │   ├── ToolRegistry.ts         # Tool registry
│   │   ├── DocumentRetrievalTool.ts
│   │   └── WebSearchTool.ts        # Stub implementation
│   ├── errors/
│   │   ├── AgentError.ts           # Structured error types
│   │   └── CircuitBreaker.ts       # Circuit breaker implementation
│   └── observability/
│       ├── Logger.ts               # Structured logging
│       ├── Metrics.ts              # Metrics emission
│       └── Tracer.ts               # Trace ID propagation
├── routes/
│   ├── agent.ts                    # NEW: Agent API routes
│   └── ... (existing routes)
└── ... (existing files)
```

## Components and Interfaces

### Component 1: LLM Provider Layer

**Fulfills:** Requirement 1

#### Interface Definition

```typescript
// agent/types.ts

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ModelCapabilities {
  max_context_length: number;
  supports_function_calling: boolean;
  supports_streaming: boolean;
  supported_output_formats: string[];
}

export interface CompletionParams {
  messages: AgentMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
  stop_sequences?: string[];
  tools?: ToolDefinition[];
}

export interface CompletionResult {
  content: string;
  tokens_used: number;
  finish_reason: 'stop' | 'max_tokens' | 'tool_call';
  tool_calls?: ToolCall[];
}

export type LLMProviderErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'CONTEXT_TOO_LONG'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR';

export interface LLMProviderError {
  provider_id: string;
  error_code: LLMProviderErrorCode;
  message: string;
  retry_after_ms?: number;
}
```

```typescript
// agent/providers/LLMProvider.ts

export interface LLMProvider {
  readonly providerId: string;

  generateCompletion(params: CompletionParams): Promise<CompletionResult>;

  generateStream(params: CompletionParams): AsyncIterable<string>;

  getModelCapabilities(): ModelCapabilities;
}
```

#### Registry Design

```typescript
// agent/providers/LLMProviderRegistry.ts

export class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private static readonly MAX_PROVIDERS = 10;

  register(provider: LLMProvider): void;
  get(providerId: string): LLMProvider; // throws PROVIDER_NOT_FOUND
  has(providerId: string): boolean;
  list(): string[];
}
```

#### Mock Provider

The MockProvider returns deterministic responses by hashing the first message content. It supports configurable latency for simulating network delays during development.

```typescript
// agent/providers/MockProvider.ts

export class MockProvider implements LLMProvider {
  readonly providerId = 'mock';
  private latencyMs: number;

  constructor(config?: { latencyMs?: number });

  generateCompletion(params: CompletionParams): Promise<CompletionResult> {
    // Deterministic: hash first message → fixed response
    // Supports tool_calls if tools are provided in params
  }

  generateStream(params: CompletionParams): AsyncIterable<string> {
    // Yields deterministic tokens with configured delay between chunks
  }

  getModelCapabilities(): ModelCapabilities {
    return {
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text', 'json', 'markdown'],
    };
  }
}
```

#### Retry Logic

Retry is handled at the engine level (not inside providers) using exponential backoff:

```typescript
// Retry wrapper used by Agent Engine
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 8000 }
): Promise<T>;
```

### Component 2: Agent System

**Fulfills:** Requirement 2

#### Base Agent

```typescript
// agent/agents/BaseAgent.ts

export type AgentRole = 'research' | 'writer' | 'editor' | 'formatter';
export type AgentStatus = 'success' | 'error' | 'partial' | 'max_iterations_reached';

export interface AgentConfig {
  agent_id: string;           // max 64 chars
  role: AgentRole;
  system_prompt: string;      // max 8000 chars
  allowed_tools: string[];
  supported_tiers: ('turbo' | 'pro')[];
  max_iterations: number;     // 1-100, default 10
}

export interface AgentResult {
  status: AgentStatus;
  output_content: string;
  confidence_score: number;   // 0.0 - 1.0
  tokens_used: number;
  processing_time_ms: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected provider: LLMProvider;
  protected toolRegistry: ToolRegistry;
  private iterationCount: number = 0;

  constructor(config: AgentConfig, provider: LLMProvider, toolRegistry: ToolRegistry);

  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    // 1. Validate task type matches role
    // 2. Build messages from context + system_prompt
    // 3. Loop: call LLM, handle tool calls, check iterations
    // 4. Return AgentResult
  }

  protected abstract buildSystemPrompt(task: AgentTask): string;
  protected abstract evaluateCompletion(result: CompletionResult): boolean;
  protected abstract extractConfidence(result: CompletionResult): number;
}
```

#### Specialized Agents

Each agent extends BaseAgent with role-specific system prompts and completion evaluation:

- **ResearchAgent**: System prompt focuses on information gathering, synthesis, and citation. Allowed tools: `document_retrieval`, `web_search`.
- **WriterAgent**: System prompt focuses on content generation from intents/outlines. Allowed tools: `document_retrieval`.
- **EditorAgent**: System prompt focuses on review, grammar, tone, clarity. Allowed tools: none (works on provided content).
- **FormatterAgent**: System prompt focuses on structural formatting and output transformation. Allowed tools: none.

### Component 3: Orchestration Engine

**Fulfills:** Requirement 3

#### Execution Plan (DAG)

```typescript
// agent/orchestrator/ExecutionPlan.ts

export type StepType = 'sequential' | 'parallel' | 'conditional';
export type FailurePolicy = 'retry' | 'skip' | 'abort';

export interface ExecutionStep {
  step_id: string;
  agent_role: AgentRole;
  step_type: StepType;
  depends_on: string[];         // step_ids this step depends on
  failure_policy: FailurePolicy;
  fallback_value?: string;      // used when policy is 'skip'
  condition?: BranchCondition;  // used when step_type is 'conditional'
}

export interface BranchCondition {
  source_step_id: string;
  type: 'confidence_threshold' | 'pattern_match';
  threshold?: number;           // for confidence_threshold
  pattern?: string;             // regex for pattern_match
}

export interface ExecutionPlan {
  plan_id: string;
  task_id: string;
  tier: 'turbo' | 'pro';
  steps: ExecutionStep[];
  max_execution_time_ms: number; // 120000 for turbo, 300000 for pro
  created_at: string;
}

// Validates DAG has no cycles using topological sort
export function validateDAG(plan: ExecutionPlan): boolean;
```

#### Orchestrator

```typescript
// agent/orchestrator/Orchestrator.ts

export interface OrchestratorEvent {
  type: 'plan_started' | 'agent_started' | 'agent_completed' | 'agent_failed' | 'plan_completed';
  task_id: string;
  timestamp: string;
  agent_id?: string;
  data?: Record<string, unknown>;
}

export class Orchestrator {
  private agents: Map<AgentRole, BaseAgent>;
  private eventEmitter: EventEmitter;
  private contextManager: ContextManager;

  constructor(agents: Map<AgentRole, BaseAgent>, contextManager: ContextManager);

  async execute(task: AgentTask, plan: ExecutionPlan): Promise<OrchestrationResult> {
    // 1. Emit plan_started
    // 2. Topological sort steps
    // 3. Execute steps respecting dependencies
    //    - Sequential: await previous, feed output
    //    - Parallel: Promise.all for independent steps
    //    - Conditional: evaluate branch condition
    // 4. Handle failures per step's failure_policy
    // 5. Enforce timeout
    // 6. Emit plan_completed
    // 7. Return aggregated results
  }

  onEvent(handler: (event: OrchestratorEvent) => void): void;
}

export interface OrchestrationResult {
  status: 'success' | 'partial' | 'timeout_exceeded' | 'aborted';
  output_content: string;       // final agent's output
  agents_used: string[];
  step_results: Map<string, AgentResult>;
  total_tokens: number;
  execution_time_ms: number;
  error?: LLMProviderError;
}
```

#### Workflow Templates

```typescript
// agent/orchestrator/templates/index.ts

export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  steps: ExecutionStep[];
}

// Pre-defined templates:
// - "research-then-write": Research → Writer (sequential)
// - "write-then-edit": Writer → Editor (sequential)
// - "research-write-edit-format": Research → Writer → Editor → Formatter (sequential)
```

### Component 4: Tier Router

**Fulfills:** Requirement 4

```typescript
// agent/orchestrator/TierRouter.ts

export interface TierDecision {
  tier: 'turbo' | 'pro';
  reasoning: string;
  provider_id: string;
}

export interface ComplexityIndicators {
  estimated_output_length: number;
  requires_research: boolean;
  requires_multi_step: boolean;
  user_explicit_tier_selection?: 'turbo' | 'pro';
}

export class TierRouter {
  private providerRegistry: LLMProviderRegistry;
  private circuitBreaker: CircuitBreaker;
  private config: { turboProviderId: string; proProviderId: string };

  classify(task: AgentTask): TierDecision {
    // 1. If user_explicit_tier_selection → honor it
    // 2. If requires_research || requires_multi_step || output > 2000 → Pro
    // 3. Otherwise → Turbo
    // 4. Check provider health, fallback if needed
  }

  getProvider(tier: 'turbo' | 'pro'): LLMProvider {
    // Returns provider for tier, with fallback logic
  }
}
```

### Component 5: Context Manager

**Fulfills:** Requirement 5

```typescript
// agent/context/AgentContext.ts

export interface AgentContextState {
  task_id: string;
  conversation_history: AgentMessage[];
  intermediate_results: Map<string, AgentResult>;
  task_metadata: Record<string, unknown>;
  shared_knowledge: Record<string, string>;
  created_at: string;
  expires_at: string;
}

export class ContextManager {
  private contexts: Map<string, AgentContextState> = new Map();
  private retentionMinutes: number;
  private cleanupInterval: NodeJS.Timeout;

  create(taskId: string, metadata: Record<string, unknown>): AgentContextState;
  get(taskId: string): AgentContextState | null;
  addIntermediateResult(taskId: string, stepId: string, result: AgentResult): void;
  addSharedKnowledge(taskId: string, key: string, value: string): void;
  dispose(taskId: string): void;
  serialize(taskId: string): string;  // JSON
  deserialize(json: string): AgentContextState;
}
```

```typescript
// agent/context/ContextWindow.ts

export class ContextWindow {
  private maxContextLength: number;
  private provider: LLMProvider;

  constructor(provider: LLMProvider);

  fitToWindow(
    systemPrompt: string,
    messages: AgentMessage[],
    maxTokens: number
  ): AgentMessage[] {
    // 1. Count tokens for all messages
    // 2. If within limit → return as-is
    // 3. If over limit:
    //    a. Preserve system_prompt + last 3 messages
    //    b. Summarize older messages (max 20% of context)
    //    c. If summarization fails → truncate oldest first
  }

  estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token (for English)
    // Can be replaced with tiktoken later
  }
}
```

### Component 6: Bridge API Routes

**Fulfills:** Requirement 6

```typescript
// routes/agent.ts

import { Router } from 'express';

export function createAgentRouter(engine: AgentEngine): Router {
  const router = Router();

  // POST /ai/agent/execute — submit task, wait for result
  router.post('/execute', authMiddleware, quotaMiddleware, async (req, res) => {
    // Validate: intent (1-2000 chars), content?, tier_preference?, template_id?
    // Create AgentTask → engine.execute() → return AgentResult
  });

  // POST /ai/agent/stream — submit task, stream via SSE
  router.post('/stream', authMiddleware, quotaMiddleware, async (req, res) => {
    // Set SSE headers
    // Create AgentTask → engine.executeStream()
    // Emit events: task_accepted, agent_started, token_chunk, agent_completed, task_completed
  });

  // GET /ai/agent/status/:taskId — poll execution status
  router.get('/status/:taskId', authMiddleware, (req, res) => {
    // Return: status, progress_percentage, result (if completed)
  });

  // GET /ai/agent/templates — list workflow templates
  router.get('/templates', authMiddleware, (req, res) => {
    // Return available WorkflowTemplate[]
  });

  // GET /ai/agent/health — health check
  router.get('/health', (req, res) => {
    // Return: status, provider_status, configuration_valid, uptime_seconds
  });

  return router;
}
```

Integration with existing Express app:

```typescript
// In src/index.ts (addition)
import { createAgentRouter } from './routes/agent';
import { AgentEngine } from './agent';

const agentEngine = new AgentEngine();
app.use('/ai/agent', createAgentRouter(agentEngine));
```

### Component 7: Tool System

**Fulfills:** Requirement 7

```typescript
// agent/tools/Tool.ts

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  execution_time_ms: number;
  error_message?: string;
}

export interface Tool {
  readonly toolId: string;
  getSchema(): ToolDefinition;
  validateInput(input: unknown): { valid: boolean; errors?: ValidationError[] };
  execute(input: unknown): Promise<ToolResult>;
}

export interface ValidationError {
  field_path: string;
  reason: string;
}
```

```typescript
// agent/tools/ToolRegistry.ts

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void;
  get(toolId: string): Tool;        // throws TOOL_NOT_FOUND
  has(toolId: string): boolean;
  list(): ToolDefinition[];

  // Validates and executes with timeout
  async invoke(toolId: string, input: unknown, allowedTools: string[]): Promise<ToolResult> {
    // 1. Check toolId exists → TOOL_NOT_FOUND
    // 2. Check toolId in allowedTools → TOOL_NOT_ALLOWED
    // 3. Validate input against schema → TOOL_INVALID_INPUT
    // 4. Execute with 30s timeout → TOOL_TIMEOUT
  }
}
```

### Component 8: Error Handling & Circuit Breaker

**Fulfills:** Requirement 8

```typescript
// agent/errors/AgentError.ts

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
  | 'INVALID_REQUEST'
  | 'AUTH_REQUIRED';

export class AgentError extends Error {
  constructor(
    public readonly error_code: AgentErrorCode,
    message: string,
    public readonly agent_id?: string,
    public readonly task_id?: string,
    public readonly recoverable: boolean = false,
  );
}

// Error classification
export function isRecoverable(code: AgentErrorCode): boolean {
  return ['PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'CONTEXT_TOO_LONG'].includes(code);
}
```

```typescript
// agent/errors/CircuitBreaker.ts

export interface CircuitBreakerConfig {
  failureThreshold: 5;
  windowMs: 60000;
  cooldownMs: 30000;
}

export class CircuitBreaker {
  private failures: Map<string, { count: number; firstFailureAt: number }>;
  private unhealthyUntil: Map<string, number>;

  isHealthy(providerId: string): boolean;
  recordFailure(providerId: string): void;
  recordSuccess(providerId: string): void;
  reset(providerId: string): void;
}
```

### Component 9: Configuration

**Fulfills:** Requirement 9

```typescript
// agent/config.ts

export interface AuraSphereConfig {
  mode: 'development' | 'production';
  turboProvider: 'mock' | 'openai';
  proProvider: 'mock' | 'openai';
  defaultTier: 'turbo' | 'pro';
  maxExecutionTimeSec: number;      // 10-600
  contextRetentionMinutes: number;  // 1-1440
  configFilePath: string;

  // From config file (optional overrides)
  agents?: Record<string, Partial<AgentConfig>>;
  providers?: {
    openai?: { apiKey: string; baseUrl?: string; model?: string };
  };
}

export function loadConfig(): AuraSphereConfig {
  // 1. Load from env vars (AURASPHERE_* prefix)
  // 2. Load from JSON config file (if exists)
  // 3. Env vars take precedence
  // 4. Validate all values
  // 5. Default mode to 'development' if not set
}

export function validateConfig(config: Partial<AuraSphereConfig>): {
  valid: boolean;
  errors: string[];
};
```

### Component 10: Observability

**Fulfills:** Requirement 10

```typescript
// agent/observability/Logger.ts

// Leverages existing winston logger from bridge-api
export class AgentLogger {
  private logger: winston.Logger;
  private mode: 'development' | 'production';

  logAgentInvocation(data: {
    task_id: string;
    agent_id: string;
    tier: string;
    provider_id: string;
    tokens_used: number;
    execution_time_ms: number;
    status: AgentStatus;
    trace_id: string;
    // In dev mode only:
    prompt?: string;
    response?: string;
  }): void;

  logPlanSummary(data: {
    task_id: string;
    total_agents_invoked: number;
    total_tokens_used: number;
    total_execution_time_ms: number;
    final_status: string;
    trace_id: string;
  }): void;
}
```

```typescript
// agent/observability/Metrics.ts

// Simple in-memory metrics (can be replaced with Prometheus/StatsD later)
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  incrementCounter(name: string, labels: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels: Record<string, string>): void;
  getSnapshot(): MetricsSnapshot;
}
```

## Data Models

### AgentTask (Input)

```typescript
export interface AgentTask {
  task_id: string;
  intent: string;                    // 1-2000 chars
  content?: string;                  // max 50000 chars
  tier_preference?: 'turbo' | 'pro';
  template_id?: string;
  user_id: string;
  trace_id: string;
  created_at: string;

  // Derived complexity indicators (computed by TierRouter)
  complexity?: ComplexityIndicators;
}
```

### API Request/Response Schemas

```typescript
// POST /ai/agent/execute request body
interface AgentExecuteRequest {
  intent: string;           // required, 1-2000 chars
  content?: string;         // optional, max 50000 chars
  tier_preference?: 'turbo' | 'pro';
  template_id?: string;
}

// POST /ai/agent/execute response
interface AgentExecuteResponse {
  task_id: string;
  status: 'success' | 'partial' | 'timeout_exceeded';
  output_content: string;
  agents_used: string[];
  total_tokens: number;
  execution_time_ms: number;
  tier_used: 'turbo' | 'pro';
}

// GET /ai/agent/status/:taskId response
interface AgentStatusResponse {
  task_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_percentage: number;
  result?: AgentExecuteResponse;
  error?: { code: string; message: string };
}

// SSE event types for /ai/agent/stream
type SSEEvent =
  | { event: 'task_accepted'; data: { task_id: string; tier: string } }
  | { event: 'agent_started'; data: { agent_id: string; role: string } }
  | { event: 'token_chunk'; data: { content: string } }
  | { event: 'agent_completed'; data: { agent_id: string; tokens_used: number } }
  | { event: 'task_completed'; data: AgentExecuteResponse };

// GET /ai/agent/health response
interface AgentHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  provider_status: Record<string, 'connected' | 'disconnected'>;
  configuration_valid: boolean;
  uptime_seconds: number;
}

// GET /ai/agent/templates response
interface AgentTemplatesResponse {
  templates: Array<{
    template_id: string;
    name: string;
    description: string;
    agents_involved: string[];
  }>;
}
```

## Sequence Diagrams

### Turbo Tier (Single Agent)

```
Client          Bridge API       TierRouter      Agent Engine     MockProvider
  │                │                │                │                │
  │ POST /execute  │                │                │                │
  │───────────────>│                │                │                │
  │                │ classify(task) │                │                │
  │                │───────────────>│                │                │
  │                │  tier=turbo    │                │                │
  │                │<───────────────│                │                │
  │                │                │                │                │
  │                │ execute(task, single-agent)     │                │
  │                │───────────────────────────────>│                │
  │                │                │               │ generateCompletion
  │                │                │               │───────────────>│
  │                │                │               │   result       │
  │                │                │               │<───────────────│
  │                │         AgentResult            │                │
  │                │<───────────────────────────────│                │
  │  response      │                │                │                │
  │<───────────────│                │                │                │
```

### Pro Tier (Multi-Agent Pipeline)

```
Client       Bridge API    TierRouter    Orchestrator    Research    Writer    Editor
  │              │             │              │             │          │         │
  │ POST /stream │             │              │             │          │         │
  │─────────────>│             │              │             │          │         │
  │              │ classify    │              │             │          │         │
  │              │────────────>│              │             │          │         │
  │              │ tier=pro    │              │             │          │         │
  │              │<────────────│              │             │          │         │
  │              │             │              │             │          │         │
  │ SSE: task_accepted         │              │             │          │         │
  │<─────────────│             │              │             │          │         │
  │              │ execute(plan)│              │             │          │         │
  │              │─────────────────────────>│             │          │         │
  │              │             │              │ step 1      │          │         │
  │ SSE: agent_started(research)│             │────────────>│          │         │
  │<─────────────│             │              │   result    │          │         │
  │ SSE: token_chunks          │              │<────────────│          │         │
  │<─────────────│             │              │             │          │         │
  │ SSE: agent_completed       │              │ step 2      │          │         │
  │<─────────────│             │              │─────────────────────>│         │
  │ SSE: agent_started(writer) │              │   result    │          │         │
  │<─────────────│             │              │<─────────────────────│         │
  │ SSE: token_chunks          │              │             │          │         │
  │<─────────────│             │              │ step 3      │          │         │
  │ SSE: agent_completed       │              │──────────────────────────────>│
  │<─────────────│             │              │   result    │          │         │
  │ SSE: agent_started(editor) │              │<──────────────────────────────│
  │<─────────────│             │              │             │          │         │
  │ SSE: agent_completed       │              │             │          │         │
  │<─────────────│             │              │             │          │         │
  │ SSE: task_completed        │              │             │          │         │
  │<─────────────│             │              │             │          │         │
```

## Implementation Phases

### Phase 1: Core Framework (Do Now — in bridge-api)

This phase can be implemented immediately with no external dependencies:

1. Type definitions (`agent/types.ts`)
2. LLM Provider interface + MockProvider + Registry
3. Configuration loader with env var support
4. Base Agent class + 4 specialized agents (with mock responses)
5. Tool interface + Registry + stub tools
6. Context Manager (in-memory)
7. Context Window (token estimation + truncation)
8. Circuit Breaker
9. Structured error types
10. Tier Router (classification logic)
11. Execution Plan (DAG validation)
12. Orchestrator (sequential + parallel execution)
13. Workflow Templates (3 pre-defined)
14. Agent API routes (execute, stream, status, templates, health)
15. Observability (structured logging via winston)

### Phase 2: LLM Integration (Separate Repo — Later)

When you have a self-hosted LLM API ready:

1. **OpenAI-compatible Provider** — implement `LLMProvider` interface calling OpenAI-format API (works with vLLM, Ollama, TGI which all expose OpenAI-compatible endpoints)
2. **Token counting** — replace simple estimation with tiktoken or model-specific tokenizer
3. **Context summarization** — implement actual LLM-based summarization (currently falls back to truncation)
4. **Real web_search tool** — integrate with search API (SearXNG, Tavily, etc.)

### Phase 3: Integration & Polish (Connect Everything)

1. **WordAI Editor integration** — Tauri commands calling bridge-api agent endpoints
2. **UI for tier selection** — user can choose Turbo/Pro in editor
3. **Streaming UI** — display SSE token chunks in real-time
4. **Model routing configuration** — admin UI for provider settings
5. **Production hardening** — rate limiting on agent endpoints, request queuing

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Same as existing bridge-api, shared types |
| Runtime | Node.js (same process) | No extra deployment, shares auth/quota |
| LLM API format | OpenAI-compatible | Industry standard, works with vLLM/Ollama/TGI |
| DAG execution | Custom (no LangGraph) | Simpler, no Python dependency, full control |
| Token estimation | Char-based (Phase 1) | Good enough for mock; tiktoken in Phase 2 |
| Metrics | In-memory counters | Lightweight; swap to Prometheus later |
| Logging | Winston (existing) | Already in bridge-api dependencies |
| Streaming | Native SSE (Express) | No extra deps, works with Tauri fetch |
| Config | dotenv + JSON file | Consistent with existing bridge-api pattern |

## Error Handling

Error handling follows a layered approach:

1. **Provider errors** — classified by `LLMProviderErrorCode`, retried with exponential backoff for transient errors
2. **Agent errors** — role mismatch, iteration limits, tool access violations — returned immediately as non-recoverable
3. **Orchestration errors** — step-level failure policies (retry/skip/abort) with partial result preservation
4. **Circuit breaker** — provider-level health tracking, automatic fallback after 5 consecutive failures in 60s
5. **API errors** — HTTP status codes with structured error responses (code, message, trace_id)

All errors are logged with full structured metadata and emitted as metrics for alerting.

## Correctness Properties

### Property 1: DAG Acyclicity
Every generated Execution_Plan passes topological sort validation — no cycles exist in the step dependency graph.

**Validates: Requirements 3.5**

### Property 2: Tier Determinism
Same complexity indicators always produce the same tier assignment when no explicit user selection is provided.

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 3: Retry Bound
No operation is retried more than 3 times (4 total attempts maximum).

**Validates: Requirements 8.3**

### Property 4: Token Bound
Context passed to any LLM_Provider never exceeds its max_context_length.

**Validates: Requirements 5.3**

### Property 5: Data Flow Integrity
Sequential pipeline agents always receive complete upstream output_content in their input context.

**Validates: Requirements 3.2**

### Property 6: Parallel Barrier
All parallel agents complete before any dependent step begins execution.

**Validates: Requirements 3.6**

### Property 7: Timeout Enforcement
No execution plan runs longer than its tier-specific maximum (120s Turbo, 300s Pro).

**Validates: Requirements 3.12, 3.13**

### Property 8: Context Round-trip
For any AgentContext C: deserialize(serialize(C)) produces structurally equal output.

**Validates: Requirements 5.11**

### Property 9: Tool Isolation
Agents can only invoke tools listed in their allowed_tools array; all other invocations are blocked.

**Validates: Requirements 7.5, 7.6**

### Property 10: Circuit Breaker Activation
Exactly 5 consecutive failures to the same provider within 60 seconds triggers unhealthy state for 30 seconds.

**Validates: Requirements 8.10**

## Security Considerations

- All agent endpoints require authenticated session (existing auth middleware)
- Quota enforcement prevents abuse (existing quota system)
- Tool execution is sandboxed (no filesystem access, no network except allowed tools)
- System prompts are server-side only (never exposed to client)
- Request body size limited to 100KB
- Agent output is sanitized before returning to client (no prompt injection leakage)

## Testing Strategy

- **Unit tests**: Each component tested in isolation with MockProvider
- **Integration tests**: Full pipeline tests (request → route → engine → response)
- **Property-based tests**: Using fast-check (already in devDependencies) for:
  - DAG validity invariants
  - Tier routing determinism
  - Context serialization round-trips
  - Retry bound enforcement
  - Circuit breaker state transitions
