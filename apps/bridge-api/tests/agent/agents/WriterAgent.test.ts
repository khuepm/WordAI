/**
 * Unit tests for WriterAgent
 *
 * Tests the WriterAgent's configuration, system prompt building,
 * completion evaluation, and confidence extraction.
 *
 * Requirements: 2.3
 */

import { describe, it, expect, vi } from 'vitest';
import { WriterAgent } from '../../../src/agent/agents/WriterAgent';
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
      content: 'Generated writing content',
      tokens_used: 100,
      finish_reason: 'stop',
    } as CompletionResult),
    generateStream: vi.fn(),
    getModelCapabilities: vi.fn().mockReturnValue({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text', 'markdown'],
    } as ModelCapabilities),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides?: Partial<AgentTask>): AgentTask {
  return {
    task_id: 'task-writer-001',
    intent: 'Write a blog post about AI agents',
    user_id: 'user-123',
    trace_id: 'trace-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WriterAgent', () => {
  describe('configuration', () => {
    it('should instantiate with correct agent_id', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      expect(agent['config'].agent_id).toBe('writer-agent');
    });

    it('should have role set to writer', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      expect(agent['config'].role).toBe('writer');
    });

    it('should have allowed_tools containing document_retrieval', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      expect(agent['config'].allowed_tools).toEqual(['document_retrieval']);
    });

    it('should support turbo and pro tiers', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      expect(agent['config'].supported_tiers).toEqual(['turbo', 'pro']);
    });

    it('should have max_iterations set to 10', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      expect(agent['config'].max_iterations).toBe(10);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should return a writing-focused system prompt', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const prompt = agent['buildSystemPrompt'](makeTask());

      expect(prompt).toContain('content writer');
      expect(prompt).toContain('generate');
      expect(prompt).toContain('document_retrieval');
    });

    it('should include task content when provided', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const task = makeTask({ content: 'Outline: Introduction, Body, Conclusion' });
      const prompt = agent['buildSystemPrompt'](task);

      expect(prompt).toContain('Outline: Introduction, Body, Conclusion');
    });

    it('should not include reference section when no content provided', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const task = makeTask({ content: undefined });
      const prompt = agent['buildSystemPrompt'](task);

      expect(prompt).not.toContain('Reference content or outline');
    });
  });

  describe('evaluateCompletion', () => {
    it('should return true when finish_reason is stop', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result: CompletionResult = {
        content: 'Some content',
        tokens_used: 50,
        finish_reason: 'stop',
      };

      expect(agent['evaluateCompletion'](result)).toBe(true);
    });

    it('should return false when finish_reason is max_tokens', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result: CompletionResult = {
        content: 'Partial content',
        tokens_used: 4096,
        finish_reason: 'max_tokens',
      };

      expect(agent['evaluateCompletion'](result)).toBe(false);
    });

    it('should return false when finish_reason is tool_call', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result: CompletionResult = {
        content: '',
        tokens_used: 20,
        finish_reason: 'tool_call',
        tool_calls: [
          { id: 'call-1', type: 'function', function: { name: 'document_retrieval', arguments: '{}' } },
        ],
      };

      expect(agent['evaluateCompletion'](result)).toBe(false);
    });
  });

  describe('extractConfidence', () => {
    it('should return 0.85 as default confidence', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result: CompletionResult = {
        content: 'Generated content',
        tokens_used: 100,
        finish_reason: 'stop',
      };

      expect(agent['extractConfidence'](result)).toBe(0.85);
    });

    it('should return 0.85 regardless of result content', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result: CompletionResult = {
        content: '',
        tokens_used: 0,
        finish_reason: 'max_tokens',
      };

      expect(agent['extractConfidence'](result)).toBe(0.85);
    });
  });

  describe('execute() integration', () => {
    it('should execute a writing task and return success', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toBe('Generated writing content');
      expect(result.confidence_score).toBe(0.85);
      expect(result.tokens_used).toBe(100);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should pass system prompt with writing focus to the provider', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      await agent.execute(makeTask());

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('content writer');
    });

    it('should include task intent in user message', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new WriterAgent(provider, registry);

      await agent.execute(makeTask({ intent: 'Write about TypeScript generics' }));

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompletionParams;
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('Write about TypeScript generics');
    });
  });
});
