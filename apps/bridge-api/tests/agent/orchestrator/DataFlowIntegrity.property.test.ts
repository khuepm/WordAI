/**
 * Property-based tests for Data Flow Integrity.
 *
 * Property 5: Data Flow Integrity
 *   Validates: Requirements 3.2
 *
 * Verifies that:
 * - In a sequential pipeline (A → B → C), agent B receives agent A's
 *   complete output_content in its context
 * - Agent C receives agent B's complete output_content in its context
 * - Data is never lost or truncated between sequential steps
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Orchestrator } from '../../../src/agent/orchestrator/Orchestrator';
import { ContextManager } from '../../../src/agent/context/AgentContext';
import { BaseAgent, AgentExecutionContext } from '../../../src/agent/agents/BaseAgent';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
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
// Mock LLM Provider
// ---------------------------------------------------------------------------

/**
 * A minimal mock LLM provider that returns a configurable output.
 * The output is set externally so we can control what each agent produces.
 */
class StubProvider implements LLMProvider {
  readonly providerId = 'stub';
  private outputContent: string;

  constructor(outputContent: string) {
    this.outputContent = outputContent;
  }

  setOutput(content: string): void {
    this.outputContent = content;
  }

  async generateCompletion(): Promise<CompletionResult> {
    return {
      content: this.outputContent,
      tokens_used: 10,
      finish_reason: 'stop',
    };
  }

  async *generateStream(): AsyncIterable<string> {
    yield this.outputContent;
  }

  getModelCapabilities() {
    return {
      max_context_length: 128000,
      supports_function_calling: false,
      supports_streaming: true,
      supported_output_formats: ['text'],
    };
  }
}

// ---------------------------------------------------------------------------
// Recording Agent — captures context received during execution
// ---------------------------------------------------------------------------

/**
 * A concrete BaseAgent subclass that records the context it receives
 * and returns a deterministic output_content.
 */
class RecordingAgent extends BaseAgent {
  public capturedContexts: AgentExecutionContext[] = [];
  private fixedOutput: string;

  constructor(role: AgentRole, fixedOutput: string) {
    const provider = new StubProvider(fixedOutput);
    const toolRegistry = new ToolRegistry();
    const config: AgentConfig = {
      agent_id: `recording-${role}`,
      role,
      system_prompt: `You are a ${role} agent.`,
      allowed_tools: [],
      supported_tiers: ['turbo', 'pro'],
      max_iterations: 1,
    };
    super(config, provider, toolRegistry);
    this.fixedOutput = fixedOutput;
  }

  /**
   * Override execute to capture the context and return a deterministic result.
   * This bypasses the LLM call loop entirely for predictable testing.
   */
  async execute(task: AgentTask, context?: AgentExecutionContext): Promise<AgentResult> {
    if (context) {
      this.capturedContexts.push(context);
    }
    return {
      status: 'success',
      output_content: this.fixedOutput,
      confidence_score: 0.9,
      tokens_used: 10,
      processing_time_ms: 5,
    };
  }

  protected buildSystemPrompt(): string {
    return 'test';
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

/**
 * Creates a sequential 3-step execution plan: A → B → C.
 */
function makeSequentialPlan(taskId: string): ExecutionPlan {
  const steps: ExecutionStep[] = [
    {
      step_id: 'step-a',
      agent_role: 'research',
      step_type: 'sequential',
      depends_on: [],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-b',
      agent_role: 'writer',
      step_type: 'sequential',
      depends_on: ['step-a'],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-c',
      agent_role: 'editor',
      step_type: 'sequential',
      depends_on: ['step-b'],
      failure_policy: 'abort',
    },
  ];

  return {
    plan_id: 'test-plan',
    task_id: taskId,
    tier: 'pro',
    steps,
    max_execution_time_ms: 300000,
    created_at: new Date().toISOString(),
  };
}

/**
 * Creates a minimal AgentTask for testing.
 */
function makeTask(taskId: string): AgentTask {
  return {
    task_id: taskId,
    intent: 'Test data flow integrity',
    user_id: 'test-user',
    trace_id: 'test-trace',
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Property 5: Data Flow Integrity
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 5: Data Flow Integrity', () => {
  let contextManager: ContextManager;

  afterEach(() => {
    if (contextManager) {
      contextManager.destroy();
    }
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * For any sequential pipeline A → B → C with random output content,
   * agent B's context SHALL contain agent A's complete output_content,
   * and agent C's context SHALL contain agent B's complete output_content.
   */
  it('sequential agents receive complete upstream output_content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (outputA, outputB, outputC) => {
          // Create recording agents with deterministic outputs
          const agentA = new RecordingAgent('research', outputA);
          const agentB = new RecordingAgent('writer', outputB);
          const agentC = new RecordingAgent('editor', outputC);

          // Build agent map
          const agents = new Map<AgentRole, BaseAgent>([
            ['research', agentA],
            ['writer', agentB],
            ['editor', agentC],
          ]);

          // Create orchestrator
          contextManager = new ContextManager(1);
          const orchestrator = new Orchestrator(agents, contextManager);

          // Execute the sequential plan
          const task = makeTask('task-dataflow');
          const plan = makeSequentialPlan(task.task_id);
          const result = await orchestrator.execute(task, plan);

          // Verify execution succeeded
          expect(result.status).toBe('success');

          // Agent B should have received agent A's output_content
          expect(agentB.capturedContexts.length).toBe(1);
          const contextB = agentB.capturedContexts[0];
          // The conversation_history should contain A's output as an assistant message
          const assistantMessagesB = contextB.conversation_history.filter(
            (m) => m.role === 'assistant',
          );
          expect(assistantMessagesB.length).toBeGreaterThanOrEqual(1);
          expect(assistantMessagesB[0].content).toBe(outputA);

          // Also verify via intermediate_results
          expect(contextB.intermediate_results['step-a']).toBeDefined();
          expect(contextB.intermediate_results['step-a'].output_content).toBe(outputA);

          // Agent C should have received agent B's output_content
          expect(agentC.capturedContexts.length).toBe(1);
          const contextC = agentC.capturedContexts[0];
          // The conversation_history should contain B's output as an assistant message
          const assistantMessagesC = contextC.conversation_history.filter(
            (m) => m.role === 'assistant',
          );
          expect(assistantMessagesC.length).toBeGreaterThanOrEqual(1);
          expect(assistantMessagesC[0].content).toBe(outputB);

          // Also verify via intermediate_results
          expect(contextC.intermediate_results['step-b']).toBeDefined();
          expect(contextC.intermediate_results['step-b'].output_content).toBe(outputB);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * For any sequential pipeline with arbitrary unicode content (including
   * special characters, newlines, and empty-looking strings), the data
   * flow SHALL preserve the exact content without modification.
   */
  it('data flow preserves arbitrary unicode content exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.unicodeString({ minLength: 1, maxLength: 200 }),
        fc.unicodeString({ minLength: 1, maxLength: 200 }),
        async (outputA, outputB) => {
          const agentA = new RecordingAgent('research', outputA);
          const agentB = new RecordingAgent('writer', outputB);
          const agentC = new RecordingAgent('editor', 'final');

          const agents = new Map<AgentRole, BaseAgent>([
            ['research', agentA],
            ['writer', agentB],
            ['editor', agentC],
          ]);

          contextManager = new ContextManager(1);
          const orchestrator = new Orchestrator(agents, contextManager);

          const task = makeTask('task-unicode');
          const plan = makeSequentialPlan(task.task_id);
          await orchestrator.execute(task, plan);

          // Verify B received A's exact unicode output
          const contextB = agentB.capturedContexts[0];
          expect(contextB.intermediate_results['step-a'].output_content).toBe(outputA);

          // Verify C received B's exact unicode output
          const contextC = agentC.capturedContexts[0];
          expect(contextC.intermediate_results['step-b'].output_content).toBe(outputB);
        },
      ),
      { numRuns: 100 },
    );
  });
});
