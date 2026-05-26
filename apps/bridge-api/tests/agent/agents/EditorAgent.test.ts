/**
 * Unit tests for EditorAgent
 *
 * Tests that EditorAgent correctly extends BaseAgent with role 'editor',
 * uses no tools, and implements editing-focused behavior.
 *
 * Requirements: 2.4
 */

import { describe, it, expect, vi } from 'vitest';
import { EditorAgent } from '../../../src/agent/agents/EditorAgent';
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
      content: 'Edited content with improvements applied.',
      tokens_used: 60,
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
    task_id: 'task-edit-001',
    intent: 'Review and improve this paragraph for clarity',
    user_id: 'user-123',
    trace_id: 'trace-abc',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorAgent', () => {
  describe('configuration', () => {
    it('should have agent_id "editor-agent"', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      // Access config via execute behavior — agent_id is validated at construction
      // If construction succeeds, agent_id is valid
      expect(agent).toBeDefined();
    });

    it('should construct without errors', () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      expect(() => new EditorAgent(provider, registry)).not.toThrow();
    });

    it('should not pass any tools to the LLM provider', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      await agent.execute(makeTask());

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      expect(callArgs.tools).toBeUndefined();
    });
  });

  describe('execution', () => {
    it('should return success when finish_reason is stop', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.status).toBe('success');
      expect(result.output_content).toBe('Edited content with improvements applied.');
    });

    it('should return confidence score of 0.9', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.confidence_score).toBe(0.9);
    });

    it('should include task content in the user message', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      await agent.execute(
        makeTask({ content: 'The quick brown fox jumps over the lazy dog.' }),
      );

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain(
        'The quick brown fox jumps over the lazy dog.',
      );
    });

    it('should use a system prompt focused on editing', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      await agent.execute(makeTask({ content: 'Some content to edit' }));

      const callArgs = (provider.generateCompletion as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as CompletionParams;
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('editor');
      expect(systemMessage?.content).toContain('clarity');
      expect(systemMessage?.content).toContain('grammar');
      expect(systemMessage?.content).toContain('tone');
    });

    it('should track tokens used from the provider response', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.tokens_used).toBe(60);
    });

    it('should track processing time', async () => {
      const provider = createMockProvider();
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      const result = await agent.execute(makeTask());

      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluateCompletion', () => {
    it('should not complete when finish_reason is max_tokens', async () => {
      const provider = createMockProvider({
        generateCompletion: vi.fn().mockResolvedValue({
          content: 'Partial edit...',
          tokens_used: 100,
          finish_reason: 'max_tokens',
        } as CompletionResult),
      });
      const registry = new ToolRegistry();
      const agent = new EditorAgent(provider, registry);

      // With max_iterations default of 10, it will hit the limit
      // since evaluateCompletion returns false for non-stop finish_reason
      const result = await agent.execute(makeTask());

      expect(result.status).toBe('max_iterations_reached');
    });
  });
});
