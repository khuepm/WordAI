/**
 * Property-based tests for Agent Role Validation.
 *
 * Property: Role Validation
 *   Validates: Requirements 2.7, 2.8
 *
 * Tests that:
 * - Tasks with requires_research=true are accepted by research agents
 * - Tasks with requires_research=true are rejected by non-research agents with TASK_ROLE_MISMATCH
 * - Tasks without explicit type indicators are accepted by any agent role
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { BaseAgent } from '../../../src/agent/agents/BaseAgent';
import { AgentError } from '../../../src/agent/errors/AgentError';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';
import type {
  AgentConfig,
  AgentRole,
  AgentTask,
  CompletionResult,
  ModelCapabilities,
} from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Concrete TestAgent subclass for testing
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent {
  protected buildSystemPrompt(task: AgentTask): string {
    return `You are a test agent. Process: ${task.intent}`;
  }

  protected evaluateCompletion(_result: CompletionResult): boolean {
    return true; // Always complete on first iteration
  }

  protected extractConfidence(_result: CompletionResult): number {
    return 0.9;
  }
}

// ---------------------------------------------------------------------------
// Mock LLM Provider
// ---------------------------------------------------------------------------

function createMockProvider(): LLMProvider {
  return {
    providerId: 'test-provider',
    generateCompletion: vi.fn().mockResolvedValue({
      content: 'Generated content',
      tokens_used: 50,
      finish_reason: 'stop',
    } as CompletionResult),
    generateStream: vi.fn(),
    getModelCapabilities: vi.fn().mockReturnValue({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text'],
    } as ModelCapabilities),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(role: AgentRole): AgentConfig {
  return {
    agent_id: `test-${role}-agent`,
    role,
    system_prompt: `You are a ${role} agent.`,
    allowed_tools: [],
    supported_tiers: ['turbo', 'pro'],
    max_iterations: 10,
  };
}

function makeTask(overrides?: Partial<AgentTask>): AgentTask {
  return {
    task_id: 'task-001',
    intent: 'Process this content',
    user_id: 'user-123',
    trace_id: 'trace-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** All valid agent roles. */
const allRoles: AgentRole[] = ['research', 'writer', 'editor', 'formatter'];

/** Generates a random agent role. */
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...allRoles);

/** Generates a non-research agent role. */
const nonResearchRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(
  'writer' as AgentRole,
  'editor' as AgentRole,
  'formatter' as AgentRole,
);

/** Generates a random estimated_output_length (positive integer). */
const outputLengthArb = fc.integer({ min: 1, max: 10000 });

/** Generates a random requires_multi_step boolean. */
const multiStepArb = fc.boolean();

// ---------------------------------------------------------------------------
// Property: Role Validation
// Validates: Requirements 2.7, 2.8
// ---------------------------------------------------------------------------

describe('Property: Role Validation', () => {
  /**
   * **Validates: Requirements 2.7**
   *
   * For any task with requires_research=true, a research agent SHALL accept
   * the task and return a successful result.
   */
  it('research agent accepts tasks with requires_research=true', async () => {
    await fc.assert(
      fc.asyncProperty(
        outputLengthArb,
        multiStepArb,
        async (outputLength, multiStep) => {
          const provider = createMockProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig('research'), provider, registry);

          const task = makeTask({
            complexity: {
              estimated_output_length: outputLength,
              requires_research: true,
              requires_multi_step: multiStep,
            },
          });

          const result = await agent.execute(task);
          expect(result.status).toBe('success');
          expect(result.output_content).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.8**
   *
   * For any non-research agent role, a task with requires_research=true
   * SHALL be rejected with error code TASK_ROLE_MISMATCH, and no LLM
   * provider calls SHALL be made.
   */
  it('non-research agents reject tasks with requires_research=true with TASK_ROLE_MISMATCH', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonResearchRoleArb,
        outputLengthArb,
        multiStepArb,
        async (role, outputLength, multiStep) => {
          const provider = createMockProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig(role), provider, registry);

          const task = makeTask({
            complexity: {
              estimated_output_length: outputLength,
              requires_research: true,
              requires_multi_step: multiStep,
            },
          });

          try {
            await agent.execute(task);
            expect.fail(
              `Expected TASK_ROLE_MISMATCH for role '${role}' with requires_research=true`,
            );
          } catch (err) {
            expect(err).toBeInstanceOf(AgentError);
            expect((err as AgentError).error_code).toBe('TASK_ROLE_MISMATCH');
          }

          // Verify no LLM calls were made
          expect(provider.generateCompletion).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.7**
   *
   * For any agent role, a task WITHOUT explicit type indicators (no complexity
   * field or requires_research=false) SHALL be accepted by any agent.
   */
  it('tasks without explicit type indicators are accepted by any agent role', async () => {
    await fc.assert(
      fc.asyncProperty(agentRoleArb, async (role) => {
        const provider = createMockProvider();
        const registry = new ToolRegistry();
        const agent = new TestAgent(makeConfig(role), provider, registry);

        // Task with no complexity field at all
        const taskNoComplexity = makeTask();
        const result1 = await agent.execute(taskNoComplexity);
        expect(result1.status).toBe('success');

        // Task with requires_research=false (no explicit type inferred)
        const taskNoResearch = makeTask({
          complexity: {
            estimated_output_length: 500,
            requires_research: false,
            requires_multi_step: false,
          },
        });
        const result2 = await agent.execute(taskNoResearch);
        expect(result2.status).toBe('success');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.7, 2.8**
   *
   * Combined property: role validation is fully determined by the task's
   * requires_research indicator and the agent's role. Research agents always
   * accept research tasks, non-research agents always reject them, and tasks
   * without type indicators are universally accepted.
   */
  it('role validation is deterministic based on task type and agent role', async () => {
    await fc.assert(
      fc.asyncProperty(
        agentRoleArb,
        fc.boolean(), // requires_research
        outputLengthArb,
        multiStepArb,
        async (role, requiresResearch, outputLength, multiStep) => {
          const provider = createMockProvider();
          const registry = new ToolRegistry();
          const agent = new TestAgent(makeConfig(role), provider, registry);

          const task = makeTask({
            complexity: {
              estimated_output_length: outputLength,
              requires_research: requiresResearch,
              requires_multi_step: multiStep,
            },
          });

          if (requiresResearch && role !== 'research') {
            // Non-research agent + research task → TASK_ROLE_MISMATCH
            try {
              await agent.execute(task);
              expect.fail(`Expected TASK_ROLE_MISMATCH for role '${role}'`);
            } catch (err) {
              expect(err).toBeInstanceOf(AgentError);
              expect((err as AgentError).error_code).toBe('TASK_ROLE_MISMATCH');
            }
          } else {
            // Either research agent with research task, or no explicit type → accepted
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
