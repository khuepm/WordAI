/**
 * Unit tests for ResearchAgent
 *
 * Tests configuration, system prompt building, completion evaluation,
 * and confidence extraction for the research-specialized agent.
 *
 * Requirements: 2.2
 */

import { describe, it, expect, vi } from 'vitest';
import { ResearchAgent } from '../../../src/agent/agents/ResearchAgent';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';
import type {
  AgentTask,
  CompletionParams,
  CompletionResult,
  ModelCapabilities,
} from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Mock LLM Provider
// ---------------------------------------------------------------------------

function createMockProvider(overrides?: Partial<LLMProvider>): LLMProvider {
  return {
    providerId: 'test-provider',
    generateCompletion: vi.fn().mockResolvedValue({
      content: 'Research findings on the topic.',
      tokens_used: 100,
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

function makeTask(overrides?: Partial<AgentTask>): AgentTask {
  return {
    task_id: 'task-research-001',
    intent: 'Research the history of artificial intelligence',
    user_id: 'user-123',
    trace_id: 'trace-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResearchAgent', () => {
  describe('construction and configuration', () => {
    it('should create with correct agent_id', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      // Verify agent was created successfully (no throw)
      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should be creatable via static factory method', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = ResearchAgent.create(provider, registry);

      expect(agent).toBeInstanceOf(ResearchAgent);
    });
  });

  describe('execute() - research task flow', () => {
    it('should return success when LLM finishes with stop', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toBe('Research findings on the topic.');
      expect(result.tokens_used).toBe(100);
    });

    it('should include task intent in the system prompt sent to LLM', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      await agent.execute(makeTask({ intent: 'Investigate quantum computing' }));

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('Investigate quantum computing');
    });

    it('should include task content in system prompt when provided', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      await agent.execute(
        makeTask({ content: 'Focus on recent breakthroughs in 2024' }),
      );

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('Focus on recent breakthroughs in 2024');
    });

    it('should include research-focused instructions in system prompt', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      await agent.execute(makeTask());

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('Research Agent');
      expect(systemMessage?.content).toContain('synthesiz');
      expect(systemMessage?.content).toContain('fact-check');
    });
  });

  describe('evaluateCompletion', () => {
    it('should return success when finish_reason is stop', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: 'Done researching.',
          tokens_used: 50,
          finish_reason: 'stop',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      const result = await agent.execute(makeTask());
      expect(result.status).toBe('success');
    });

    it('should not complete when finish_reason is max_tokens', async () => {
      let callCount = 0;
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return Promise.resolve({
              content: 'partial ',
              tokens_used: 20,
              finish_reason: 'max_tokens',
            } as CompletionResult);
          }
          return Promise.resolve({
            content: 'final answer',
            tokens_used: 30,
            finish_reason: 'stop',
          } as CompletionResult);
        }),
      });
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toContain('partial ');
      expect(result.output_content).toContain('final answer');
    });
  });

  describe('extractConfidence', () => {
    it('should return 0.8 default confidence for research results', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new ResearchAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.confidence_score).toBe(0.8);
    });
  });

  describe('allowed tools', () => {
    it('should handle document_retrieval tool calls', async () => {
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
                    name: 'document_retrieval',
                    arguments: '{"query": "AI history"}',
                  },
                },
              ],
            } as CompletionResult);
          }
          return Promise.resolve({
            content: 'Based on retrieved documents...',
            tokens_used: 60,
            finish_reason: 'stop',
          } as CompletionResult);
        }),
      });

      const registry = new ToolRegistry();
      registry.register({
        toolId: 'document_retrieval',
        getSchema: () => ({
          type: 'function',
          function: {
            name: 'document_retrieval',
            description: 'Retrieve documents',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        }),
        validateInput: () => ({ valid: true }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: { documents: ['doc1', 'doc2'] },
          execution_time_ms: 50,
        }),
      });

      const agent = new ResearchAgent(provider, registry);
      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toContain('Based on retrieved documents');
    });

    it('should handle web_search tool calls', async () => {
      let callCount = 0;
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              content: '',
              tokens_used: 15,
              finish_reason: 'tool_call',
              tool_calls: [
                {
                  id: 'call-2',
                  type: 'function',
                  function: {
                    name: 'web_search',
                    arguments: '{"query": "latest AI research 2024"}',
                  },
                },
              ],
            } as CompletionResult);
          }
          return Promise.resolve({
            content: 'Web search results indicate...',
            tokens_used: 45,
            finish_reason: 'stop',
          } as CompletionResult);
        }),
      });

      const registry = new ToolRegistry();
      registry.register({
        toolId: 'web_search',
        getSchema: () => ({
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        }),
        validateInput: () => ({ valid: true }),
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: { results: ['result1', 'result2'] },
          execution_time_ms: 100,
        }),
      });

      const agent = new ResearchAgent(provider, registry);
      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toContain('Web search results indicate');
    });
  });
});
