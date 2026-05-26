/**
 * Property-based tests for Parallel Barrier.
 *
 * Property 6: Parallel Barrier
 *   Validates: Requirements 3.6
 *
 * Verifies that:
 * - All parallel agents complete before any dependent step begins execution
 * - All parallel step results are available in the dependent step's context
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Orchestrator } from '../../../src/agent/orchestrator/Orchestrator';
import { ContextManager } from '../../../src/agent/context/AgentContext';
import { BaseAgent, AgentExecutionContext } from '../../../src/agent/agents/BaseAgent';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import { MockProvider } from '../../../src/agent/providers/MockProvider';
import type {
  AgentConfig,
  AgentTask,
  AgentResult,
  AgentRole,
  ExecutionPlan,
  ExecutionStep,
  CompletionResult,
} from '../../../src/agent/types';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';

// ---------------------------------------------------------------------------
// Timing-tracking infrastructure
// ---------------------------------------------------------------------------

interface TimingRecord {
  role: AgentRole;
  callIndex: number;
  startTime: number;
  endTime: number;
}

/** Global timing log shared across all agents in a test run. */
let timingLog: TimingRecord[] = [];

/** Global call counter per role to distinguish multiple calls to the same agent. */
let callCounters: Map<AgentRole, number> = new Map();

function clearLogs(): void {
  timingLog = [];
  callCounters = new Map();
}

// ---------------------------------------------------------------------------
// Timing-tracking mock agent
// ---------------------------------------------------------------------------

/**
 * A mock agent that records start/completion timestamps for each call.
 * Introduces a configurable async delay to simulate real execution.
 */
class TimingAgent extends BaseAgent {
  private readonly delayMs: number;

  constructor(
    config: AgentConfig,
    provider: LLMProvider,
    toolRegistry: ToolRegistry,
    delayMs: number,
  ) {
    super(config, provider, toolRegistry);
    this.delayMs = delayMs;
  }

  /**
   * Override execute to record timing per call.
   */
  async execute(task: AgentTask, context?: AgentExecutionContext): Promise<AgentResult> {
    const role = this.config.role;
    const callIndex = (callCounters.get(role) ?? 0);
    callCounters.set(role, callIndex + 1);

    const startTime = Date.now();

    // Simulate work with a delay
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    const endTime = Date.now();

    timingLog.push({ role, callIndex, startTime, endTime });

    return {
      status: 'success',
      output_content: `output-from-${role}-${callIndex}`,
      confidence_score: 0.9,
      tokens_used: 10,
      processing_time_ms: endTime - startTime,
    };
  }

  protected buildSystemPrompt(): string {
    return 'test prompt';
  }

  protected evaluateCompletion(): boolean {
    return true;
  }

  protected extractConfidence(): number {
    return 0.9;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_ROLES: AgentRole[] = ['research', 'writer', 'editor', 'formatter'];

function makeTask(): AgentTask {
  return {
    task_id: `task-${Date.now()}-${Math.random()}`,
    intent: 'test parallel barrier',
    user_id: 'test-user',
    trace_id: 'trace-test',
    created_at: new Date().toISOString(),
  };
}

function createTimingAgent(role: AgentRole, delayMs: number): TimingAgent {
  const provider = new MockProvider({ latencyMs: 0 });
  const toolRegistry = new ToolRegistry();
  const config: AgentConfig = {
    agent_id: `agent-${role}`,
    role,
    system_prompt: 'You are a test agent.',
    allowed_tools: [],
    supported_tiers: ['turbo', 'pro'],
    max_iterations: 10,
  };
  return new TimingAgent(config, provider, toolRegistry, delayMs);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a number of parallel steps (2-4).
 * Limited to 4 because we have 4 distinct roles and need one for the dependent step.
 * Actually we need at most 3 parallel + 1 dependent = 4 roles.
 * So parallel count is 2-3 to guarantee a free role for the dependent step.
 */
const parallelCountArb = fc.integer({ min: 2, max: 3 });

/**
 * Generates a delay in ms for parallel agents (10-30ms).
 */
const parallelDelayArb = fc.integer({ min: 10, max: 30 });

// ---------------------------------------------------------------------------
// Property 6: Parallel Barrier
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------

describe('Property 6: Parallel Barrier', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any number of parallel steps (2-3) with distinct roles that feed into
   * a single dependent step, the dependent step's start time SHALL be AFTER
   * all parallel steps' completion times.
   */
  it('dependent step starts only after all parallel steps complete', async () => {
    await fc.assert(
      fc.asyncProperty(
        parallelCountArb,
        parallelDelayArb,
        async (numParallel, delay) => {
          clearLogs();

          // Assign distinct roles to parallel steps
          const parallelRoles = ALL_ROLES.slice(0, numParallel);
          // The dependent step uses a role not used by parallel steps
          const dependentRole = ALL_ROLES[numParallel];

          // Build parallel steps (no dependencies — they run concurrently)
          const parallelSteps: ExecutionStep[] = parallelRoles.map((role, i) => ({
            step_id: `parallel-${i}`,
            agent_role: role,
            step_type: 'parallel' as const,
            depends_on: [],
            failure_policy: 'abort' as const,
          }));

          // Build dependent step that depends on ALL parallel steps
          const dependentStep: ExecutionStep = {
            step_id: 'dependent-step',
            agent_role: dependentRole,
            step_type: 'sequential',
            depends_on: parallelSteps.map((s) => s.step_id),
            failure_policy: 'abort',
          };

          // Create agent map with one agent per role
          const agentMap = new Map<AgentRole, BaseAgent>();
          for (const role of parallelRoles) {
            agentMap.set(role, createTimingAgent(role, delay));
          }
          // Dependent agent has minimal delay
          agentMap.set(dependentRole, createTimingAgent(dependentRole, 1));

          // Build execution plan
          const plan: ExecutionPlan = {
            plan_id: 'test-plan',
            task_id: 'test-task',
            tier: 'pro',
            steps: [...parallelSteps, dependentStep],
            max_execution_time_ms: 300000,
            created_at: new Date().toISOString(),
          };

          // Execute
          const contextManager = new ContextManager(30);
          const orchestrator = new Orchestrator(agentMap, contextManager);
          const task = makeTask();

          const result = await orchestrator.execute(task, plan);

          // Verify execution succeeded
          expect(result.status).toBe('success');

          // Find timing records
          const parallelTimings = timingLog.filter((t) =>
            parallelRoles.includes(t.role),
          );
          const dependentTiming = timingLog.find((t) => t.role === dependentRole);

          // All parallel steps must have recorded timing
          expect(parallelTimings.length).toBe(numParallel);
          expect(dependentTiming).toBeDefined();

          // The dependent step must have started AFTER all parallel steps completed
          const latestParallelEnd = Math.max(
            ...parallelTimings.map((t) => t.endTime),
          );
          expect(dependentTiming!.startTime).toBeGreaterThanOrEqual(latestParallelEnd);

          // Clean up
          contextManager.destroy();
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 3.6**
   *
   * For any parallel execution, all parallel step results SHALL be available
   * in the dependent step's context (verified via step_results in the
   * OrchestrationResult).
   */
  it('all parallel step results are available in dependent step context', async () => {
    await fc.assert(
      fc.asyncProperty(
        parallelCountArb,
        async (numParallel) => {
          clearLogs();

          // Assign distinct roles
          const parallelRoles = ALL_ROLES.slice(0, numParallel);
          const dependentRole = ALL_ROLES[numParallel];

          // Build parallel steps
          const parallelSteps: ExecutionStep[] = parallelRoles.map((role, i) => ({
            step_id: `par-${i}`,
            agent_role: role,
            step_type: 'parallel' as const,
            depends_on: [],
            failure_policy: 'abort' as const,
          }));

          // Build dependent step
          const dependentStep: ExecutionStep = {
            step_id: 'dep-step',
            agent_role: dependentRole,
            step_type: 'sequential',
            depends_on: parallelSteps.map((s) => s.step_id),
            failure_policy: 'abort',
          };

          // Create agents
          const agentMap = new Map<AgentRole, BaseAgent>();
          for (const role of parallelRoles) {
            agentMap.set(role, createTimingAgent(role, 10));
          }
          agentMap.set(dependentRole, createTimingAgent(dependentRole, 1));

          // Build plan
          const plan: ExecutionPlan = {
            plan_id: 'test-plan-ctx',
            task_id: 'test-task-ctx',
            tier: 'pro',
            steps: [...parallelSteps, dependentStep],
            max_execution_time_ms: 300000,
            created_at: new Date().toISOString(),
          };

          // Execute
          const contextManager = new ContextManager(30);
          const orchestrator = new Orchestrator(agentMap, contextManager);
          const task = makeTask();

          const result = await orchestrator.execute(task, plan);
          expect(result.status).toBe('success');

          // Verify ALL parallel step results exist in step_results
          for (const pStep of parallelSteps) {
            const stepResult = result.step_results.get(pStep.step_id);
            expect(stepResult).toBeDefined();
            expect(stepResult!.status).toBe('success');
            expect(stepResult!.output_content).toBeTruthy();
          }

          // Verify the dependent step also completed successfully
          const depResult = result.step_results.get('dep-step');
          expect(depResult).toBeDefined();
          expect(depResult!.status).toBe('success');

          // Verify the total number of step results matches all steps
          expect(result.step_results.size).toBe(numParallel + 1);

          // Clean up
          contextManager.destroy();
        },
      ),
      { numRuns: 50 },
    );
  });
});
