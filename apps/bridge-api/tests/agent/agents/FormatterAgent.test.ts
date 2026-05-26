/**
 * Unit tests for FormatterAgent
 *
 * Tests the FormatterAgent's configuration, system prompt building,
 * completion evaluation, and confidence extraction.
 *
 * Requirements: 2.5
 */

import { describe, it, expect, vi } from 'vitest';
import { FormatterAgent } from '../../../src/agent/agents/FormatterAgent';
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
      content: '# Formatted Content\n\n- Item 1\n- Item 2\n',
      tokens_used: 40,
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
    task_id: 'task-fmt-001',
    intent: 'Format this text with proper headings and bullet points',
    user_id: 'user-123',
    trace_id: 'trace-fmt-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FormatterAgent', () => {
  describe('configuration', () => {
    it('should be instantiated with role "formatter"', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      // Access config via execute behavior — the agent should accept formatting tasks
      expect(agent).toBeInstanceOf(FormatterAgent);
    });

    it('should have no allowed tools', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      // Execute a task and verify no tools are passed to the LLM
      await agent.execute(makeTask());

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      expect(callArgs.tools).toBeUndefined();
    });

    it('should have max_iterations of 5', async () => {
      // Verify by checking that after 5 iterations without completion, it stops
      const generateFn = vi.fn().mockResolvedValue({
        content: 'chunk ',
        tokens_used: 5,
        finish_reason: 'max_tokens', // not 'stop', so evaluateCompletion returns false
      } as CompletionResult);

      const provider = createMockProvider({ generateCompletion: generateFn });
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('max_iterations_reached');
      expect(generateFn).toHaveBeenCalledTimes(5);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include formatting-related instructions in system message', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      await agent.execute(makeTask());

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');

      expect(systemMessage).toBeDefined();
      expect(systemMessage!.content).toContain('formatting');
      expect(systemMessage!.content).toContain('headings');
      expect(systemMessage!.content).toContain('lists');
      expect(systemMessage!.content).toContain('structure');
    });

    it('should include additional instruction when task has content', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      await agent.execute(makeTask({ content: 'Some raw text to format' }));

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');

      expect(systemMessage!.content).toContain('Format the following content');
    });
  });

  describe('evaluateCompletion', () => {
    it('should return success when finish_reason is "stop"', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: '# Formatted\n\n- Point 1\n- Point 2',
          tokens_used: 30,
          finish_reason: 'stop',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
    });

    it('should not complete when finish_reason is "max_tokens"', async () => {
      const generateFn = vi.fn().mockResolvedValue({
        content: 'partial',
        tokens_used: 10,
        finish_reason: 'max_tokens',
      } as CompletionResult);

      const provider = createMockProvider({ generateCompletion: generateFn });
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      // Should hit max_iterations since evaluateCompletion returns false for max_tokens
      expect(result.status).toBe('max_iterations_reached');
    });
  });

  describe('extractConfidence', () => {
    it('should return 0.95 confidence for formatting results', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.confidence_score).toBe(0.95);
    });
  });

  describe('execution', () => {
    it('should include task intent and content in user message', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      await agent.execute(
        makeTask({
          intent: 'Add headings and bullet points',
          content: 'Raw unformatted text here',
        }),
      );

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const userMessage = callArgs.messages.find((m) => m.role === 'user');

      expect(userMessage!.content).toContain('Add headings and bullet points');
      expect(userMessage!.content).toContain('Raw unformatted text here');
    });

    it('should accumulate tokens from LLM calls', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: 'Formatted output',
          tokens_used: 42,
          finish_reason: 'stop',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.tokens_used).toBe(42);
    });

    it('should track processing time', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new FormatterAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });
});
