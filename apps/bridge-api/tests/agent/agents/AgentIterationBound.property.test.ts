/**
 * Property-based tests for Agent Iteration Bound.
 *
 * Property: Iteration Bound
 *   Validates: Requirements 2.10, 2.11
 *
 * Tests that:
 * - The number of LLM_Provider generateCompletion calls never exceeds max_iterations
 * - When max_iterations is reached without completion, the result status is 'max_iterations_reached'
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { BaseAgent } from '../../../src/agent/agents/BaseAgent';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';
import type {
  AgentConfig,
  AgentTask,
  CompletionParams,
  CompletionResult,
  ModelCapabilities,
} from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Concrete TestAgent subclass for property testing
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent {
  private shouldComplete: boolean;

  constructor(
    config: AgentConfig,
    provider: LLMProvider,
    toolRegistry: ToolRegistry,
    shouldComplete: boolean = false,
  ) {
    super(config, provider, toolRegistry);
    this.shouldComplete = shouldComplete;
  }

  protected buildSystemPrompt(task: AgentTask): string {
    return `Test agent processing: ${task.intent}`;
  }

  protected evaluateCompletion(_result: CompletionResult): boolean {
    return this.shouldComplete;
  }

  protected extractConfidence(_result: CompletionResult): number {
    return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createNeverCompletingProvider(): { provider: LLMProvider; getCallCount: () => number } {
  let callCount = 0;

  const provider: LLMProvider = {
    providerId: 'test-iteration-provider',
    generateCompletion: vi.fn().mockImplementation(async (_params: CompletionParams) => {
      callCount++;
      return {
        content: 'partial output ',
        tokens_used: 10,
        finish_reason: 'stop',
      } as CompletionResult;
    }),
    generateStream: vi.fn(),
    getModelCapabilities: vi.fn().mockReturnValue({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text'],
    } as ModelCapabilities),
  };

  return { provider, getCallCount: () => callCount };
}

function makeConfig(maxIterations: number): AgentConfig {
  return {
    agent_id: 'iteration-test-agent',
    role: 'research',
    system_prompt: 'You are a test agent for iteration bound testing.',
    allowed_tools: [],
    supported_tiers: ['turbo', 'pro'],
    max_iterations: maxIterations,
  };
}

function makeTask(): AgentTask {
  return {
    task_id: 'task-iter-test',
    intent: 'Test iteration bounds',
    user_id: 'user-test',
    trace_id: 'trace-iter',
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Property: Iteration Bound
// Validates: Requirements 2.10, 2.11
// ---------------------------------------------------------------------------

describe('Property: Iteration Bound', () => {
  /**
   * **Validates: Requirements 2.10**
   *
   * For any max_iterations value in [1, 100], when evaluateCompletion always
   * returns false (task never completes), the number of generateCompletion
   * calls SHALL equal exactly max_iterations (never exceeds it).
   */
  it('LLM_Provider calls never exceed max_iterations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (maxIterations) => {
          const { provider, getCallCount } = createNeverCompletingProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig(maxIterations), provider, registry, false);

          await agent.execute(makeTask());

          const callCount = getCallCount();
          expect(callCount).toBe(maxIterations);
          expect(callCount).toBeLessThanOrEqual(maxIterations);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.11**
   *
   * For any max_iterations value in [1, 100], when the agent reaches
   * max_iterations without completing, the result status SHALL be
   * 'max_iterations_reached'.
   */
  it('result status is max_iterations_reached when limit is hit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (maxIterations) => {
          const { provider } = createNeverCompletingProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig(maxIterations), provider, registry, false);

          const result = await agent.execute(makeTask());

          expect(result.status).toBe('max_iterations_reached');
          expect(result.confidence_score).toBe(0.0);
          expect(result.tokens_used).toBe(maxIterations * 10);
          expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.10, 2.11**
   *
   * Combined property: for any max_iterations, the iteration count is bounded
   * AND the result correctly reflects the max_iterations_reached status with
   * accumulated partial output.
   */
  it('iteration bound holds and partial output is accumulated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (maxIterations) => {
          const { provider, getCallCount } = createNeverCompletingProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig(maxIterations), provider, registry, false);

          const result = await agent.execute(makeTask());

          // Iteration bound is respected
          expect(getCallCount()).toBe(maxIterations);

          // Status reflects max_iterations_reached
          expect(result.status).toBe('max_iterations_reached');

          // Output content contains accumulated partial outputs
          // Each call produces 'partial output ', so total length should match
          const expectedOutput = 'partial output '.repeat(maxIterations);
          expect(result.output_content).toBe(expectedOutput);
        },
      ),
      { numRuns: 100 },
    );
  });
});
