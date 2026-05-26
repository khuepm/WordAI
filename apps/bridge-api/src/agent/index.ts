/**
 * AuraSphere Agent Framework — Engine Entry Point
 *
 * Initializes and wires together all framework components:
 * - LLMProviderRegistry with MockProvider
 * - ToolRegistry with built-in tools
 * - Specialized agents (Research, Writer, Editor, Formatter)
 * - ContextManager, CircuitBreaker, TierRouter, Orchestrator
 *
 * Exposes the AgentEngine class with execute(), executeStream(),
 * getStatus(), getTemplates(), and getHealth() methods.
 *
 * Requirements: 1.7, 9.1, 9.2
 *
 * @module agent
 */

import { randomUUID } from 'crypto';
import type {
  AgentExecuteRequest,
  AgentExecuteResponse,
  AgentHealthResponse,
  AgentRole,
  AgentStatusResponse,
  AgentTask,
  AgentTemplatesResponse,
  SSEEvent,
} from './types';
import { loadConfig, AuraSphereConfig } from './config';
import { LLMProviderRegistry } from './providers/LLMProviderRegistry';
import { MockProvider } from './providers/MockProvider';
import { ToolRegistry } from './tools/ToolRegistry';
import { DocumentRetrievalTool } from './tools/DocumentRetrievalTool';
import { WebSearchTool } from './tools/WebSearchTool';
import { ResearchAgent } from './agents/ResearchAgent';
import { WriterAgent } from './agents/WriterAgent';
import { EditorAgent } from './agents/EditorAgent';
import { FormatterAgent } from './agents/FormatterAgent';
import { BaseAgent } from './agents/BaseAgent';
import { ContextManager } from './context/AgentContext';
import { CircuitBreaker } from './errors/CircuitBreaker';
import { TierRouter } from './orchestrator/TierRouter';
import { Orchestrator } from './orchestrator/Orchestrator';
import { getAllTemplates, getTemplate } from './orchestrator/templates';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Task Status Tracking
// ---------------------------------------------------------------------------

interface TaskRecord {
  task_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_percentage: number;
  result?: AgentExecuteResponse;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// AgentEngine Class
// ---------------------------------------------------------------------------

/**
 * Main entry point for the AuraSphere Agent Framework.
 *
 * Initializes all components on construction and provides methods for
 * executing agent tasks synchronously, streaming, and querying status.
 */
export class AgentEngine {
  private readonly config: AuraSphereConfig;
  private readonly providerRegistry: LLMProviderRegistry;
  private readonly toolRegistry: ToolRegistry;
  private readonly contextManager: ContextManager;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly tierRouter: TierRouter;
  private readonly orchestrator: Orchestrator;
  private readonly agents: Map<AgentRole, BaseAgent>;
  private readonly tasks: Map<string, TaskRecord> = new Map();
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();

    // 1. Load and validate configuration (Requirements 9.1, 9.2)
    this.config = loadConfig();

    // 2. Initialize LLMProviderRegistry and register MockProvider (Requirement 1.7)
    this.providerRegistry = new LLMProviderRegistry();
    const mockProvider = new MockProvider();
    this.providerRegistry.register(mockProvider);

    // 3. Initialize ToolRegistry with built-in tools
    this.toolRegistry = new ToolRegistry();
    this.toolRegistry.register(new DocumentRetrievalTool());
    this.toolRegistry.register(new WebSearchTool());

    // 4. Initialize all 4 specialized agents with the mock provider
    const provider = this.providerRegistry.get(this.config.turboProvider);
    const researchAgent = new ResearchAgent(provider, this.toolRegistry);
    const writerAgent = new WriterAgent(provider, this.toolRegistry);
    const editorAgent = new EditorAgent(provider, this.toolRegistry);
    const formatterAgent = new FormatterAgent(provider, this.toolRegistry);

    this.agents = new Map<AgentRole, BaseAgent>([
      ['research', researchAgent],
      ['writer', writerAgent],
      ['editor', editorAgent],
      ['formatter', formatterAgent],
    ]);

    // 5. Initialize ContextManager with configured retention
    this.contextManager = new ContextManager(this.config.contextRetentionMinutes);

    // 6. Initialize CircuitBreaker
    this.circuitBreaker = new CircuitBreaker();

    // 7. Initialize TierRouter with registry and circuit breaker
    this.tierRouter = new TierRouter(this.providerRegistry, this.circuitBreaker, {
      turboProviderId: this.config.turboProvider,
      proProviderId: this.config.proProvider,
    });

    // 8. Initialize Orchestrator with agent map and context manager
    this.orchestrator = new Orchestrator(this.agents, this.contextManager);

    logger.info('AuraSphere Agent Engine initialized', {
      mode: this.config.mode,
      turboProvider: this.config.turboProvider,
      proProvider: this.config.proProvider,
      defaultTier: this.config.defaultTier,
    });
  }

  /**
   * Execute an agent task synchronously and return the final result.
   *
   * @param request - The agent execution request
   * @param userId - Authenticated user ID
   * @param traceId - Distributed tracing identifier
   * @returns The execution response
   */
  async execute(
    request: AgentExecuteRequest,
    userId: string,
    traceId: string,
  ): Promise<AgentExecuteResponse> {
    const taskId = randomUUID();
    const task = this.buildTask(request, taskId, userId, traceId);

    // Track task status
    this.setTaskStatus(taskId, 'running', 0);

    try {
      // Classify tier
      const tierDecision = this.tierRouter.classify(task);

      // Build execution plan from template or default single-agent
      const plan = this.buildExecutionPlan(task, tierDecision.tier, request.template_id);

      // Execute via orchestrator
      const result = await this.orchestrator.execute(task, plan);

      const response: AgentExecuteResponse = {
        task_id: taskId,
        status: result.status === 'success' ? 'success' : result.status === 'timeout_exceeded' ? 'timeout_exceeded' : 'partial',
        output_content: result.output_content,
        agents_used: result.agents_used,
        total_tokens: result.total_tokens,
        execution_time_ms: result.execution_time_ms,
        tier_used: tierDecision.tier,
      };

      this.setTaskStatus(taskId, 'completed', 100, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.setTaskStatus(taskId, 'failed', 0, undefined, {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Execute an agent task with streaming response via SSE events.
   *
   * @param request - The agent execution request
   * @param userId - Authenticated user ID
   * @param traceId - Distributed tracing identifier
   * @returns An async iterable of SSE events
   */
  async *executeStream(
    request: AgentExecuteRequest,
    userId: string,
    traceId: string,
  ): AsyncIterable<SSEEvent> {
    const taskId = randomUUID();
    const task = this.buildTask(request, taskId, userId, traceId);

    // Classify tier
    const tierDecision = this.tierRouter.classify(task);

    // Emit task_accepted
    yield {
      event: 'task_accepted',
      data: { task_id: taskId, tier: tierDecision.tier },
    };

    this.setTaskStatus(taskId, 'running', 10);

    // Build execution plan
    const plan = this.buildExecutionPlan(task, tierDecision.tier, request.template_id);

    // Listen for orchestrator events and forward as SSE
    const eventQueue: SSEEvent[] = [];
    let resolveWaiting: (() => void) | null = null;

    this.orchestrator.onEvent((event) => {
      let sseEvent: SSEEvent | null = null;

      switch (event.type) {
        case 'agent_started':
          sseEvent = {
            event: 'agent_started',
            data: {
              agent_id: event.agent_id ?? 'unknown',
              role: event.agent_id ?? 'unknown',
            },
          };
          break;
        case 'agent_completed':
          sseEvent = {
            event: 'agent_completed',
            data: {
              agent_id: event.agent_id ?? 'unknown',
              tokens_used: (event.data?.tokens_used as number) ?? 0,
            },
          };
          break;
      }

      if (sseEvent) {
        eventQueue.push(sseEvent);
        if (resolveWaiting) {
          resolveWaiting();
          resolveWaiting = null;
        }
      }
    });

    // Execute the plan
    const result = await this.orchestrator.execute(task, plan);

    // Yield any queued events
    for (const event of eventQueue) {
      yield event;
    }

    // Emit task_completed
    const response: AgentExecuteResponse = {
      task_id: taskId,
      status: result.status === 'success' ? 'success' : result.status === 'timeout_exceeded' ? 'timeout_exceeded' : 'partial',
      output_content: result.output_content,
      agents_used: result.agents_used,
      total_tokens: result.total_tokens,
      execution_time_ms: result.execution_time_ms,
      tier_used: tierDecision.tier,
    };

    this.setTaskStatus(taskId, 'completed', 100, response);

    yield {
      event: 'task_completed',
      data: response,
    };
  }

  /**
   * Get the current status of a task by its ID.
   *
   * @param taskId - The task identifier
   * @returns The task status response
   */
  getStatus(taskId: string): AgentStatusResponse {
    const record = this.tasks.get(taskId);

    if (!record) {
      return {
        task_id: taskId,
        status: 'failed',
        progress_percentage: 0,
        error: { code: 'TASK_NOT_FOUND', message: `Task '${taskId}' not found` },
      };
    }

    return {
      task_id: record.task_id,
      status: record.status,
      progress_percentage: record.progress_percentage,
      result: record.result,
      error: record.error,
    };
  }

  /**
   * Get all available workflow templates.
   *
   * @returns The templates response
   */
  getTemplates(): AgentTemplatesResponse {
    const templates = getAllTemplates();

    return {
      templates: templates.map((t) => ({
        template_id: t.template_id,
        name: t.name,
        description: t.description,
        agents_involved: t.steps.map((s) => s.agent_role),
      })),
    };
  }

  /**
   * Get the health status of the agent engine.
   *
   * @returns The health response
   */
  getHealth(): AgentHealthResponse {
    const providerIds = this.providerRegistry.list();
    const providerStatus: Record<string, 'connected' | 'disconnected'> = {};

    for (const id of providerIds) {
      providerStatus[id] = this.circuitBreaker.isHealthy(id)
        ? 'connected'
        : 'disconnected';
    }

    const allHealthy = Object.values(providerStatus).every((s) => s === 'connected');
    const allUnhealthy = Object.values(providerStatus).every((s) => s === 'disconnected');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allUnhealthy) {
      status = 'unhealthy';
    } else if (allHealthy) {
      status = 'healthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      provider_status: providerStatus,
      configuration_valid: true,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Destroy the engine and release resources.
   */
  destroy(): void {
    this.contextManager.destroy();
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Build an AgentTask from the request parameters.
   */
  private buildTask(
    request: AgentExecuteRequest,
    taskId: string,
    userId: string,
    traceId: string,
  ): AgentTask {
    return {
      task_id: taskId,
      intent: request.intent,
      content: request.content,
      tier_preference: request.tier_preference,
      template_id: request.template_id,
      user_id: userId,
      trace_id: traceId,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Build an execution plan based on the tier and optional template.
   */
  private buildExecutionPlan(
    task: AgentTask,
    tier: 'turbo' | 'pro',
    templateId?: string,
  ) {
    const maxExecutionTimeMs = tier === 'turbo' ? 120_000 : 300_000;

    // If a template is specified, use it
    if (templateId) {
      const template = getTemplate(templateId);
      if (template) {
        return {
          plan_id: randomUUID(),
          task_id: task.task_id,
          tier,
          steps: template.steps,
          max_execution_time_ms: maxExecutionTimeMs,
          created_at: new Date().toISOString(),
        };
      }
    }

    // Default: single writer agent for turbo, research-write-edit for pro
    if (tier === 'turbo') {
      return {
        plan_id: randomUUID(),
        task_id: task.task_id,
        tier,
        steps: [
          {
            step_id: 'step-1',
            agent_role: 'writer' as AgentRole,
            step_type: 'sequential' as const,
            depends_on: [],
            failure_policy: 'abort' as const,
          },
        ],
        max_execution_time_ms: maxExecutionTimeMs,
        created_at: new Date().toISOString(),
      };
    }

    // Pro tier: use research-write-edit-format template by default
    const proTemplate = getTemplate('research-write-edit-format');
    if (proTemplate) {
      return {
        plan_id: randomUUID(),
        task_id: task.task_id,
        tier,
        steps: proTemplate.steps,
        max_execution_time_ms: maxExecutionTimeMs,
        created_at: new Date().toISOString(),
      };
    }

    // Fallback: sequential research → writer → editor
    return {
      plan_id: randomUUID(),
      task_id: task.task_id,
      tier,
      steps: [
        {
          step_id: 'step-1',
          agent_role: 'research' as AgentRole,
          step_type: 'sequential' as const,
          depends_on: [],
          failure_policy: 'retry' as const,
        },
        {
          step_id: 'step-2',
          agent_role: 'writer' as AgentRole,
          step_type: 'sequential' as const,
          depends_on: ['step-1'],
          failure_policy: 'abort' as const,
        },
        {
          step_id: 'step-3',
          agent_role: 'editor' as AgentRole,
          step_type: 'sequential' as const,
          depends_on: ['step-2'],
          failure_policy: 'skip' as const,
          fallback_value: '',
        },
      ],
      max_execution_time_ms: maxExecutionTimeMs,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Update the internal task status record.
   */
  private setTaskStatus(
    taskId: string,
    status: TaskRecord['status'],
    progressPercentage: number,
    result?: AgentExecuteResponse,
    error?: { code: string; message: string },
  ): void {
    this.tasks.set(taskId, {
      task_id: taskId,
      status,
      progress_percentage: progressPercentage,
      result,
      error,
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default AgentEngine;
