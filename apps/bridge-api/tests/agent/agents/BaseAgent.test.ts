/**
 * Unit tests for BaseAgent
 *
 * Tests config validation, task-role validation, iteration counting,
 * max_iterations enforcement, and the LLM call loop.
 */

import { describe, it, expect, vi } from 'vitest';
import { BaseAgent, AgentExecutionContext } from '../../../src/agent/agents/BaseAgent';
import { AgentError } from '../../../src/agent/errors/AgentError';
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
// Concrete test implementation of BaseAgent
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent {
  public completionEvalResult = true;
  public confidenceValue = 0.85;

  protected buildSystemPrompt(task: AgentTask): string {
    return `You are a test agent. Process: ${task.intent}`;
  }

  protected evaluateCompletion(result: CompletionResult): boolean {
    return this.completionEvalResult;
  }

  protected extractConfidence(result: CompletionResult): number {
    return this.confidenceValue;
  }
}

// ---------------------------------------------------------------------------
// Mock LLM Provider
// ---------------------------------------------------------------------------

function createMockProvider(overrides?: Partial<LLMProvider>): LLMProvider {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    agent_id: 'test-agent',
    role: 'research',
    system_prompt: 'You are a research agent.',
    allowed_tools: [],
    supported_tiers: ['turbo', 'pro'],
    max_iterations: 10,
    ...overrides,
  };
}

function makeTask(overrides?: Partial<AgentTask>): AgentTask {
  return {
    task_id: 'task-001',
    intent: 'Research the topic of AI agents',
    user_id: 'user-123',
    trace_id: 'trace-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseAgent', () => {
  describe('config validation', () => {
    it('should accept valid config', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(() => new TestAgent(makeConfig(), provider, registry)).not.toThrow();
    });

    it('should reject empty agent_id', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(() => new TestAgent(makeConfig({ agent_id: '' }), provider, registry)).toThrow(
        AgentError,
      );
    });

    it('should reject agent_id longer than 64 characters', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const longId = 'a'.repeat(65);
      expect(() => new TestAgent(makeConfig({ agent_id: longId }), provider, registry)).toThrow(
        AgentError,
      );
    });

    it('should accept agent_id of exactly 64 characters', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const id64 = 'a'.repeat(64);
      expect(() => new TestAgent(makeConfig({ agent_id: id64 }), provider, registry)).not.toThrow();
    });

    it('should reject empty system_prompt', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ system_prompt: '' }), provider, registry),
      ).toThrow(AgentError);
    });

    it('should reject system_prompt longer than 8000 characters', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const longPrompt = 'x'.repeat(8001);
      expect(
        () => new TestAgent(makeConfig({ system_prompt: longPrompt }), provider, registry),
      ).toThrow(AgentError);
    });

    it('should accept system_prompt of exactly 8000 characters', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const prompt8000 = 'x'.repeat(8000);
      expect(
        () => new TestAgent(makeConfig({ system_prompt: prompt8000 }), provider, registry),
      ).not.toThrow();
    });

    it('should reject max_iterations of 0', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ max_iterations: 0 }), provider, registry),
      ).toThrow(AgentError);
    });

    it('should reject max_iterations of 101', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ max_iterations: 101 }), provider, registry),
      ).toThrow(AgentError);
    });

    it('should accept max_iterations of 1', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ max_iterations: 1 }), provider, registry),
      ).not.toThrow();
    });

    it('should accept max_iterations of 100', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ max_iterations: 100 }), provider, registry),
      ).not.toThrow();
    });

    it('should reject non-integer max_iterations', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(
        () => new TestAgent(makeConfig({ max_iterations: 5.5 }), provider, registry),
      ).toThrow(AgentError);
    });
  });

  describe('execute() - basic flow', () => {
    it('should return success result when evaluateCompletion returns true', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toBe('Generated content');
      expect(result.confidence_score).toBe(0.85);
      expect(result.tokens_used).toBe(50);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should include task content in user message when provided', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);

      await agent.execute(makeTask({ content: 'Some document content' }));

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompletionParams;
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('Some document content');
      expect(userMessage?.content).toContain('Research the topic of AI agents');
    });

    it('should pass conversation history from context', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);

      const context: AgentExecutionContext = {
        conversation_history: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
        ],
        intermediate_results: {},
      };

      await agent.execute(makeTask(), context);

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompletionParams;
      expect(callArgs.messages).toHaveLength(4); // system + 2 history + user
      expect(callArgs.messages[1].content).toBe('Previous message');
      expect(callArgs.messages[2].content).toBe('Previous response');
    });
  });

  describe('execute() - task role validation', () => {
    it('should accept tasks without explicit type for any role', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ role: 'writer' }), provider, registry);

      const result = await agent.execute(makeTask());
      expect(result.status).toBe('success');
    });

    it('should throw TASK_ROLE_MISMATCH when research task sent to writer agent', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ role: 'writer' }), provider, registry);

      const task = makeTask({
        complexity: {
          estimated_output_length: 500,
          requires_research: true,
          requires_multi_step: false,
        },
      });

      await expect(agent.execute(task)).rejects.toThrow(AgentError);
      try {
        await agent.execute(task);
      } catch (err) {
        expect((err as AgentError).error_code).toBe('TASK_ROLE_MISMATCH');
      }
    });

    it('should accept research task for research agent', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ role: 'research' }), provider, registry);

      const task = makeTask({
        complexity: {
          estimated_output_length: 500,
          requires_research: true,
          requires_multi_step: false,
        },
      });

      const result = await agent.execute(task);
      expect(result.status).toBe('success');
    });

    it('should not call LLM provider when task role mismatches', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ role: 'editor' }), provider, registry);

      const task = makeTask({
        complexity: {
          estimated_output_length: 500,
          requires_research: true,
          requires_multi_step: false,
        },
      });

      try {
        await agent.execute(task);
      } catch {
        // expected
      }

      expect(provider.generateCompletion).not.toHaveBeenCalled();
    });
  });

  describe('execute() - max_iterations enforcement', () => {
    it('should return max_iterations_reached when limit is hit', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: 'partial ',
          tokens_used: 10,
          finish_reason: 'stop',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ max_iterations: 3 }), provider, registry);
      agent.completionEvalResult = false; // never complete

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('max_iterations_reached');
      expect(result.confidence_score).toBe(0.0);
      expect(result.tokens_used).toBe(30); // 10 * 3 iterations
      expect(result.output_content).toBe('partial partial partial ');
    });

    it('should call LLM provider exactly max_iterations times when not completing', async () => {
      const generateFn = vi.fn().mockResolvedValue({
        content: 'chunk',
        tokens_used: 5,
        finish_reason: 'stop',
      } as CompletionResult);

      const provider = createMockProvider({ generateCompletion: generateFn });
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ max_iterations: 5 }), provider, registry);
      agent.completionEvalResult = false;

      await agent.execute(makeTask());

      expect(generateFn).toHaveBeenCalledTimes(5);
    });

    it('should return empty output_content when no content generated', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: '',
          tokens_used: 5,
          finish_reason: 'stop',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig({ max_iterations: 2 }), provider, registry);
      agent.completionEvalResult = false;

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('max_iterations_reached');
      expect(result.output_content).toBe('');
    });

    it('should track processing_time_ms accurately', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.processing_time_ms).toBeLessThan(1000); // should be fast in tests
    });
  });

  describe('execute() - tool call handling', () => {
    it('should handle tool calls and continue the loop', async () => {
      let callCount = 0;
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              content: '',
              tokens_used: 20,
              finish_reason: 'tool_call',
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: '{"query": "test"}',
                  },
                },
              ],
            } as CompletionResult);
          }
          return Promise.resolve({
            content: 'Final answer based on tool results',
            tokens_used: 30,
            finish_reason: 'stop',
          } as CompletionResult);
        }),
      });

      const registry = new ToolRegistry();
      // Register a mock tool
      registry.register({
        toolId: 'test_tool',
        getSchema: () => ({
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        }),
        validateInput: () => ({ valid: true }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: { result: 'tool output' },
          execution_time_ms: 10,
        }),
      });

      const agent = new TestAgent(
        makeConfig({ allowed_tools: ['test_tool'] }),
        provider,
        registry,
      );

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.tokens_used).toBe(50); // 20 + 30
      expect(result.output_content).toContain('Final answer based on tool results');
    });

    it('should handle tool errors gracefully', async () => {
      let callCount = 0;
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              content: '',
              tokens_used: 10,
              finish_reason: 'tool_call',
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'missing_tool',
                    arguments: '{}',
                  },
                },
              ],
            } as CompletionResult);
          }
          return Promise.resolve({
            content: 'Recovered from tool error',
            tokens_used: 15,
            finish_reason: 'stop',
          } as CompletionResult);
        }),
      });

      const registry = new ToolRegistry();
      const agent = new TestAgent(
        makeConfig({ allowed_tools: [] }),
        provider,
        registry,
      );

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toContain('Recovered from tool error');
    });
  });

  describe('execute() - confidence score clamping', () => {
    it('should clamp confidence to 0.0 minimum', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);
      agent.confidenceValue = -0.5;

      const result = await agent.execute(makeTask());

      expect(result.confidence_score).toBe(0.0);
    });

    it('should clamp confidence to 1.0 maximum', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new TestAgent(makeConfig(), provider, registry);
      agent.confidenceValue = 1.5;

      const result = await agent.execute(makeTask());

      expect(result.confidence_score).toBe(1.0);
    });
  });
});
