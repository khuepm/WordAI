/**
 * AuraSphere Agent Framework — Orchestrator
 *
 * Executes multi-agent workflows defined by an ExecutionPlan DAG.
 * Supports sequential, parallel, and conditional step execution with
 * per-step failure policies, tier-specific timeouts, and event emission.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.11, 3.12, 3.13
 *
 * @module agent/orchestrator/Orchestrator
 */

import { EventEmitter } from 'events';
import type {
  AgentRole,
  AgentTask,
  AgentResult,
  ExecutionPlan,
  ExecutionStep,
  BranchCondition,
  OrchestratorEvent,
  OrchestrationResult,
} from '../types';
import { BaseAgent } from '../agents/BaseAgent';
import { ContextManager } from '../context/AgentContext';
import { topologicalSort } from './ExecutionPlan';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of retries for steps with 'retry' failure policy. */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff (1s, 2s, 4s). */
const RETRY_BASE_DELAY_MS = 1000;

/** Maximum concurrent agents for parallel execution. */
const MAX_CONCURRENT = 5;

// ---------------------------------------------------------------------------
// Orchestrator Class
// ---------------------------------------------------------------------------

/**
 * Orchestrates multi-agent execution plans with support for sequential,
 * parallel, and conditional workflows.
 *
 * Usage:
 * ```typescript
 * const orchestrator = new Orchestrator(agentMap, contextManager);
 * orchestrator.onEvent((event) => console.log(event));
 * const result = await orchestrator.execute(task, plan);
 * ```
 */
export class Orchestrator {
  private readonly agents: Map<AgentRole, BaseAgent>;
  private readonly eventEmitter: EventEmitter;
  private readonly contextManager: ContextManager;

  constructor(agents: Map<AgentRole, BaseAgent>, contextManager: ContextManager) {
    this.agents = agents;
    this.eventEmitter = new EventEmitter();
    this.contextManager = contextManager;
  }

  /**
   * Register an event listener for orchestration events.
   *
   * @param handler - Callback invoked for each OrchestratorEvent
   */
  onEvent(handler: (event: OrchestratorEvent) => void): void {
    this.eventEmitter.on('orchestrator_event', handler);
  }

  /**
   * Execute an orchestration plan for a given task.
   *
   * 1. Emit plan_started
   * 2. Topological sort the steps
   * 3. Execute steps respecting dependencies (sequential, parallel, conditional)
   * 4. Handle failures per step's failure_policy (retry, skip, abort)
   * 5. Enforce timeout (plan.max_execution_time_ms)
   * 6. Emit plan_completed
   * 7. Return OrchestrationResult with aggregated results
   *
   * @param task - The agent task being executed
   * @param plan - The execution plan DAG
   * @returns Aggregated orchestration result
   */
  async execute(task: AgentTask, plan: ExecutionPlan): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const stepResults = new Map<string, AgentResult>();
    const agentsUsed: string[] = [];
    let totalTokens = 0;
    let lastOutput = '';

    // Create context for this execution
    this.contextManager.create(task.task_id, { plan_id: plan.plan_id });

    // 1. Emit plan_started
    this.emitEvent({
      type: 'plan_started',
      task_id: task.task_id,
      timestamp: new Date().toISOString(),
      data: { plan_id: plan.plan_id, tier: plan.tier },
    });

    // 2. Topological sort
    const sortedSteps = topologicalSort(plan);

    // 3. Execute steps in topological order, grouping parallelizable steps
    const executionGroups = this.groupStepsByDependencies(sortedSteps, plan);

    for (const group of executionGroups) {
      // Check timeout before each group
      if (this.isTimedOut(startTime, plan.max_execution_time_ms)) {
        return this.buildResult(
          'timeout_exceeded',
          lastOutput,
          agentsUsed,
          stepResults,
          totalTokens,
          startTime,
        );
      }

      if (group.length === 1) {
        // Single step — execute sequentially
        const step = group[0];
        const result = await this.executeStep(
          step,
          task,
          plan,
          stepResults,
          startTime,
        );

        if (result.aborted) {
          return this.buildResult(
            'aborted',
            lastOutput,
            agentsUsed,
            stepResults,
            totalTokens,
            startTime,
          );
        }

        if (result.result) {
          stepResults.set(step.step_id, result.result);
          this.contextManager.addIntermediateResult(
            task.task_id,
            step.step_id,
            result.result,
          );
          agentsUsed.push(step.agent_role);
          totalTokens += result.result.tokens_used;
          lastOutput = result.result.output_content;
        }
      } else {
        // Multiple steps — execute in parallel (max 5 concurrent)
        const parallelResults = await this.executeParallelSteps(
          group,
          task,
          plan,
          stepResults,
          startTime,
        );

        if (parallelResults.aborted) {
          return this.buildResult(
            'aborted',
            lastOutput,
            agentsUsed,
            stepResults,
            totalTokens,
            startTime,
          );
        }

        for (const { step, result } of parallelResults.results) {
          if (result) {
            stepResults.set(step.step_id, result);
            this.contextManager.addIntermediateResult(
              task.task_id,
              step.step_id,
              result,
            );
            agentsUsed.push(step.agent_role);
            totalTokens += result.tokens_used;
            lastOutput = result.output_content;
          }
        }
      }
    }

    // 6. Emit plan_completed
    this.emitEvent({
      type: 'plan_completed',
      task_id: task.task_id,
      timestamp: new Date().toISOString(),
      data: {
        total_tokens: totalTokens,
        execution_time_ms: Date.now() - startTime,
        agents_used: agentsUsed,
      },
    });

    // 7. Return aggregated results
    return this.buildResult(
      'success',
      lastOutput,
      agentsUsed,
      stepResults,
      totalTokens,
      startTime,
    );
  }

  // -------------------------------------------------------------------------
  // Step Execution
  // -------------------------------------------------------------------------

  /**
   * Execute a single step with failure policy handling.
   */
  private async executeStep(
    step: ExecutionStep,
    task: AgentTask,
    plan: ExecutionPlan,
    stepResults: Map<string, AgentResult>,
    startTime: number,
  ): Promise<{ result: AgentResult | null; aborted: boolean }> {
    // Evaluate conditional branching
    if (step.step_type === 'conditional' && step.condition) {
      const shouldExecute = this.evaluateCondition(step.condition, stepResults);
      if (!shouldExecute) {
        // Skip this step — condition not met
        return { result: null, aborted: false };
      }
    }

    // Check timeout
    if (this.isTimedOut(startTime, plan.max_execution_time_ms)) {
      return { result: null, aborted: false };
    }

    const agent = this.agents.get(step.agent_role);
    if (!agent) {
      // No agent for this role — handle per failure policy
      return this.handleStepFailure(
        step,
        new Error(`No agent registered for role: ${step.agent_role}`),
        task,
        plan,
        stepResults,
        startTime,
      );
    }

    // Build context from upstream dependencies
    const context = this.buildStepContext(step, stepResults);

    // Emit agent_started
    this.emitEvent({
      type: 'agent_started',
      task_id: task.task_id,
      timestamp: new Date().toISOString(),
      agent_id: step.agent_role,
      data: { step_id: step.step_id },
    });

    // Execute with failure policy
    try {
      const result = await this.executeWithTimeout(
        () => agent.execute(task, context),
        plan.max_execution_time_ms - (Date.now() - startTime),
      );

      // Emit agent_completed
      this.emitEvent({
        type: 'agent_completed',
        task_id: task.task_id,
        timestamp: new Date().toISOString(),
        agent_id: step.agent_role,
        data: {
          step_id: step.step_id,
          tokens_used: result.tokens_used,
          status: result.status,
        },
      });

      return { result, aborted: false };
    } catch (error) {
      return this.handleStepFailure(step, error, task, plan, stepResults, startTime);
    }
  }

  /**
   * Handle a step failure according to its failure_policy.
   */
  private async handleStepFailure(
    step: ExecutionStep,
    error: unknown,
    task: AgentTask,
    plan: ExecutionPlan,
    stepResults: Map<string, AgentResult>,
    startTime: number,
  ): Promise<{ result: AgentResult | null; aborted: boolean }> {
    // Emit agent_failed
    this.emitEvent({
      type: 'agent_failed',
      task_id: task.task_id,
      timestamp: new Date().toISOString(),
      agent_id: step.agent_role,
      data: {
        step_id: step.step_id,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    switch (step.failure_policy) {
      case 'retry':
        return this.retryStep(step, task, plan, stepResults, startTime);

      case 'skip': {
        // Use fallback value and continue
        const fallbackResult: AgentResult = {
          status: 'partial',
          output_content: step.fallback_value ?? '',
          confidence_score: 0,
          tokens_used: 0,
          processing_time_ms: 0,
        };
        return { result: fallbackResult, aborted: false };
      }

      case 'abort':
      default:
        return { result: null, aborted: true };
    }
  }

  /**
   * Retry a step up to MAX_RETRIES times with exponential backoff.
   */
  private async retryStep(
    step: ExecutionStep,
    task: AgentTask,
    plan: ExecutionPlan,
    stepResults: Map<string, AgentResult>,
    startTime: number,
  ): Promise<{ result: AgentResult | null; aborted: boolean }> {
    const agent = this.agents.get(step.agent_role);
    if (!agent) {
      return { result: null, aborted: true };
    }

    const context = this.buildStepContext(step, stepResults);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await this.sleep(delay);

      // Check timeout before retry
      if (this.isTimedOut(startTime, plan.max_execution_time_ms)) {
        return { result: null, aborted: false };
      }

      try {
        const result = await this.executeWithTimeout(
          () => agent.execute(task, context),
          plan.max_execution_time_ms - (Date.now() - startTime),
        );

        // Emit agent_completed on successful retry
        this.emitEvent({
          type: 'agent_completed',
          task_id: task.task_id,
          timestamp: new Date().toISOString(),
          agent_id: step.agent_role,
          data: {
            step_id: step.step_id,
            tokens_used: result.tokens_used,
            status: result.status,
            retry_attempt: attempt + 1,
          },
        });

        return { result, aborted: false };
      } catch {
        // Continue retrying
      }
    }

    // All retries exhausted — abort
    return { result: null, aborted: true };
  }

  // -------------------------------------------------------------------------
  // Parallel Execution
  // -------------------------------------------------------------------------

  /**
   * Execute multiple steps in parallel with max concurrency of 5.
   */
  private async executeParallelSteps(
    steps: ExecutionStep[],
    task: AgentTask,
    plan: ExecutionPlan,
    stepResults: Map<string, AgentResult>,
    startTime: number,
  ): Promise<{
    results: Array<{ step: ExecutionStep; result: AgentResult | null }>;
    aborted: boolean;
  }> {
    const results: Array<{ step: ExecutionStep; result: AgentResult | null }> = [];
    let aborted = false;

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < steps.length; i += MAX_CONCURRENT) {
      if (aborted || this.isTimedOut(startTime, plan.max_execution_time_ms)) {
        break;
      }

      const batch = steps.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map((step) =>
        this.executeStep(step, task, plan, stepResults, startTime).then(
          (outcome) => ({ step, outcome }),
        ),
      );

      const batchResults = await Promise.all(batchPromises);

      for (const { step, outcome } of batchResults) {
        if (outcome.aborted) {
          aborted = true;
        }
        results.push({ step, result: outcome.result });
      }
    }

    return { results, aborted };
  }

  // -------------------------------------------------------------------------
  // Conditional Branching
  // -------------------------------------------------------------------------

  /**
   * Evaluate a BranchCondition against the results of a previous step.
   *
   * @param condition - The branch condition to evaluate
   * @param stepResults - Results from previously completed steps
   * @returns true if the condition is met and the step should execute
   */
  private evaluateCondition(
    condition: BranchCondition,
    stepResults: Map<string, AgentResult>,
  ): boolean {
    const sourceResult = stepResults.get(condition.source_step_id);
    if (!sourceResult) {
      // Source step hasn't completed or was skipped — don't execute
      return false;
    }

    switch (condition.type) {
      case 'confidence_threshold':
        return (
          condition.threshold !== undefined &&
          sourceResult.confidence_score >= condition.threshold
        );

      case 'pattern_match':
        if (!condition.pattern) {
          return false;
        }
        try {
          const regex = new RegExp(condition.pattern);
          return regex.test(sourceResult.output_content);
        } catch {
          // Invalid regex — don't execute
          return false;
        }

      default:
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Context Building
  // -------------------------------------------------------------------------

  /**
   * Build execution context for a step from its upstream dependencies.
   * Sequential steps receive the output of their dependencies as context.
   */
  private buildStepContext(
    step: ExecutionStep,
    stepResults: Map<string, AgentResult>,
  ): { conversation_history: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>; intermediate_results: Record<string, AgentResult> } {
    const intermediateResults: Record<string, AgentResult> = {};
    const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [];

    for (const depId of step.depends_on) {
      const depResult = stepResults.get(depId);
      if (depResult) {
        intermediateResults[depId] = depResult;
        // Feed upstream output as assistant context for sequential flow
        conversationHistory.push({
          role: 'assistant',
          content: depResult.output_content,
        });
      }
    }

    return {
      conversation_history: conversationHistory,
      intermediate_results: intermediateResults,
    };
  }

  // -------------------------------------------------------------------------
  // Step Grouping
  // -------------------------------------------------------------------------

  /**
   * Group topologically sorted steps into execution groups.
   * Steps that share the same set of dependencies (and are all resolved)
   * can be executed in parallel.
   */
  private groupStepsByDependencies(
    sortedSteps: ExecutionStep[],
    _plan: ExecutionPlan,
  ): ExecutionStep[][] {
    const groups: ExecutionStep[][] = [];
    const completed = new Set<string>();

    let remaining = [...sortedSteps];

    while (remaining.length > 0) {
      // Find all steps whose dependencies are all in 'completed'
      const ready: ExecutionStep[] = [];
      const notReady: ExecutionStep[] = [];

      for (const step of remaining) {
        const allDepsCompleted = step.depends_on.every((dep) => completed.has(dep));
        if (allDepsCompleted) {
          ready.push(step);
        } else {
          notReady.push(step);
        }
      }

      if (ready.length === 0) {
        // Should not happen with a valid DAG, but break to avoid infinite loop
        break;
      }

      groups.push(ready);
      for (const step of ready) {
        completed.add(step.step_id);
      }
      remaining = notReady;
    }

    return groups;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Execute a function with a timeout.
   * @throws Error if the timeout is exceeded
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    remainingMs: number,
  ): Promise<T> {
    if (remainingMs <= 0) {
      throw new Error('Execution timeout exceeded');
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Execution timeout exceeded'));
      }, remainingMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Check if the execution has exceeded the allowed time.
   */
  private isTimedOut(startTime: number, maxExecutionTimeMs: number): boolean {
    return Date.now() - startTime >= maxExecutionTimeMs;
  }

  /**
   * Build the final OrchestrationResult.
   */
  private buildResult(
    status: OrchestrationResult['status'],
    outputContent: string,
    agentsUsed: string[],
    stepResults: Map<string, AgentResult>,
    totalTokens: number,
    startTime: number,
  ): OrchestrationResult {
    return {
      status,
      output_content: outputContent,
      agents_used: agentsUsed,
      step_results: new Map(stepResults),
      total_tokens: totalTokens,
      execution_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Emit an orchestration event.
   */
  private emitEvent(event: OrchestratorEvent): void {
    this.eventEmitter.emit('orchestrator_event', event);
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
