/**
 * Unit tests for MockProvider
 *
 * Tests deterministic response generation, configurable latency,
 * streaming, capabilities reporting, and input validation.
 */

import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../../src/agent/providers/MockProvider';
import { AgentError } from '../../../src/agent/errors/AgentError';
import type { CompletionParams } from '../../../src/agent/types';

function makeParams(overrides?: Partial<CompletionParams>): CompletionParams {
  return {
    messages: [{ role: 'user', content: 'Hello world' }],
    model: 'mock-model',
    temperature: 0.7,
    max_tokens: 1000,
    ...overrides,
  };
}

describe('MockProvider', () => {
  describe('constructor', () => {
    it('should create with default latency of 0', () => {
      const provider = new MockProvider();
      expect(provider.providerId).toBe('mock');
    });

    it('should accept valid latency config', () => {
      const provider = new MockProvider({ latencyMs: 100 });
      expect(provider.providerId).toBe('mock');
    });

    it('should accept latency of 0', () => {
      expect(() => new MockProvider({ latencyMs: 0 })).not.toThrow();
    });

    it('should accept latency of 30000', () => {
      expect(() => new MockProvider({ latencyMs: 30000 })).not.toThrow();
    });

    it('should throw for negative latency', () => {
      expect(() => new MockProvider({ latencyMs: -1 })).toThrow(AgentError);
    });

    it('should throw for latency exceeding 30000', () => {
      expect(() => new MockProvider({ latencyMs: 30001 })).toThrow(AgentError);
    });
  });

  describe('generateCompletion', () => {
    it('should return a deterministic response for the same input', async () => {
      const provider = new MockProvider();
      const params = makeParams();

      const result1 = await provider.generateCompletion(params);
      const result2 = await provider.generateCompletion(params);

      expect(result1.content).toBe(result2.content);
      expect(result1.content.length).toBeGreaterThan(0);
    });

    it('should return different responses for different inputs', async () => {
      const provider = new MockProvider();

      const result1 = await provider.generateCompletion(
        makeParams({ messages: [{ role: 'user', content: 'Hello' }] }),
      );
      const result2 = await provider.generateCompletion(
        makeParams({ messages: [{ role: 'user', content: 'Goodbye' }] }),
      );

      expect(result1.content).not.toBe(result2.content);
    });

    it('should return finish_reason stop', async () => {
      const provider = new MockProvider();
      const result = await provider.generateCompletion(makeParams());
      expect(result.finish_reason).toBe('stop');
    });

    it('should return positive tokens_used', async () => {
      const provider = new MockProvider();
      const result = await provider.generateCompletion(makeParams());
      expect(result.tokens_used).toBeGreaterThan(0);
    });

    it('should hash based on first message only', async () => {
      const provider = new MockProvider();

      const result1 = await provider.generateCompletion(
        makeParams({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Different' },
          ],
        }),
      );
      const result2 = await provider.generateCompletion(
        makeParams({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Also different' },
          ],
        }),
      );

      expect(result1.content).toBe(result2.content);
    });
  });

  describe('generateStream', () => {
    it('should yield chunks that concatenate to the full response', async () => {
      const provider = new MockProvider();
      const params = makeParams();

      const chunks: string[] = [];
      for await (const chunk of provider.generateStream(params)) {
        chunks.push(chunk);
      }

      const streamedContent = chunks.join('');
      const completionResult = await provider.generateCompletion(params);

      expect(streamedContent).toBe(completionResult.content);
    });

    it('should yield multiple chunks', async () => {
      const provider = new MockProvider();
      const params = makeParams();

      const chunks: string[] = [];
      for await (const chunk of provider.generateStream(params)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should validate params before streaming', async () => {
      const provider = new MockProvider();
      const params = makeParams({ messages: [] });

      const chunks: string[] = [];
      await expect(async () => {
        for await (const chunk of provider.generateStream(params)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow(AgentError);
    });
  });

  describe('getModelCapabilities', () => {
    it('should return max_context_length of 128000', () => {
      const provider = new MockProvider();
      const caps = provider.getModelCapabilities();
      expect(caps.max_context_length).toBe(128000);
    });

    it('should support function calling', () => {
      const provider = new MockProvider();
      const caps = provider.getModelCapabilities();
      expect(caps.supports_function_calling).toBe(true);
    });

    it('should support streaming', () => {
      const provider = new MockProvider();
      const caps = provider.getModelCapabilities();
      expect(caps.supports_streaming).toBe(true);
    });

    it('should support text, json, and markdown output formats', () => {
      const provider = new MockProvider();
      const caps = provider.getModelCapabilities();
      expect(caps.supported_output_formats).toEqual(['text', 'json', 'markdown']);
    });
  });

  describe('input validation', () => {
    it('should throw INVALID_REQUEST for empty messages array', async () => {
      const provider = new MockProvider();
      const params = makeParams({ messages: [] });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should throw INVALID_REQUEST for temperature below 0', async () => {
      const provider = new MockProvider();
      const params = makeParams({ temperature: -0.1 });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should throw INVALID_REQUEST for temperature above 2.0', async () => {
      const provider = new MockProvider();
      const params = makeParams({ temperature: 2.1 });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should accept temperature at boundaries (0.0 and 2.0)', async () => {
      const provider = new MockProvider();

      await expect(
        provider.generateCompletion(makeParams({ temperature: 0.0 })),
      ).resolves.toBeDefined();

      await expect(
        provider.generateCompletion(makeParams({ temperature: 2.0 })),
      ).resolves.toBeDefined();
    });

    it('should throw INVALID_REQUEST for max_tokens below 1', async () => {
      const provider = new MockProvider();
      const params = makeParams({ max_tokens: 0 });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should throw INVALID_REQUEST for max_tokens above 128000', async () => {
      const provider = new MockProvider();
      const params = makeParams({ max_tokens: 128001 });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should throw INVALID_REQUEST for non-integer max_tokens', async () => {
      const provider = new MockProvider();
      const params = makeParams({ max_tokens: 100.5 });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should accept max_tokens at boundaries (1 and 128000)', async () => {
      const provider = new MockProvider();

      await expect(
        provider.generateCompletion(makeParams({ max_tokens: 1 })),
      ).resolves.toBeDefined();

      await expect(
        provider.generateCompletion(makeParams({ max_tokens: 128000 })),
      ).resolves.toBeDefined();
    });

    it('should throw INVALID_REQUEST for more than 4 stop_sequences', async () => {
      const provider = new MockProvider();
      const params = makeParams({
        stop_sequences: ['a', 'b', 'c', 'd', 'e'],
      });

      try {
        await provider.generateCompletion(params);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('INVALID_REQUEST');
      }
    });

    it('should accept up to 4 stop_sequences', async () => {
      const provider = new MockProvider();
      const params = makeParams({
        stop_sequences: ['a', 'b', 'c', 'd'],
      });

      await expect(provider.generateCompletion(params)).resolves.toBeDefined();
    });
  });
});
