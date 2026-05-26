/**
 * Unit tests for LLMProviderRegistry
 *
 * Validates: Requirements 1.5, 1.6, 1.13, 1.14
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LLMProviderRegistry } from '../../../src/agent/providers/LLMProviderRegistry';
import { AgentError } from '../../../src/agent/errors/AgentError';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';
import type { CompletionParams, CompletionResult, ModelCapabilities } from '../../../src/agent/types';

/** Creates a minimal mock LLMProvider with the given ID. */
function createMockProvider(providerId: string): LLMProvider {
  return {
    providerId,
    generateCompletion: async (_params: CompletionParams): Promise<CompletionResult> => ({
      content: 'mock response',
      tokens_used: 10,
      finish_reason: 'stop',
    }),
    generateStream: async function* (_params: CompletionParams): AsyncIterable<string> {
      yield 'mock';
    },
    getModelCapabilities: (): ModelCapabilities => ({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text'],
    }),
  };
}

describe('LLMProviderRegistry', () => {
  let registry: LLMProviderRegistry;

  beforeEach(() => {
    registry = new LLMProviderRegistry();
  });

  describe('register()', () => {
    it('should register a provider with a valid ID', () => {
      const provider = createMockProvider('mock-provider');
      registry.register(provider);
      expect(registry.has('mock-provider')).toBe(true);
    });

    it('should replace an existing provider on duplicate ID', () => {
      const provider1 = createMockProvider('mock');
      const provider2 = createMockProvider('mock');
      registry.register(provider1);
      registry.register(provider2);
      expect(registry.get('mock')).toBe(provider2);
    });

    it('should throw when MAX_PROVIDERS limit is reached', () => {
      for (let i = 0; i < LLMProviderRegistry.MAX_PROVIDERS; i++) {
        registry.register(createMockProvider(`provider-${i}`));
      }
      expect(() => registry.register(createMockProvider('one-too-many'))).toThrow(AgentError);
      expect(() => registry.register(createMockProvider('one-too-many'))).toThrow(
        /maximum of 10 providers reached/,
      );
    });

    it('should allow replacing when at capacity', () => {
      for (let i = 0; i < LLMProviderRegistry.MAX_PROVIDERS; i++) {
        registry.register(createMockProvider(`provider-${i}`));
      }
      // Replacing an existing one should not throw
      const replacement = createMockProvider('provider-0');
      expect(() => registry.register(replacement)).not.toThrow();
      expect(registry.get('provider-0')).toBe(replacement);
    });

    it('should throw for empty provider ID', () => {
      expect(() => registry.register(createMockProvider(''))).toThrow(AgentError);
    });

    it('should throw for provider ID longer than 64 characters', () => {
      const longId = 'a'.repeat(65);
      expect(() => registry.register(createMockProvider(longId))).toThrow(AgentError);
    });

    it('should throw for provider ID with invalid characters', () => {
      expect(() => registry.register(createMockProvider('invalid_id'))).toThrow(AgentError);
      expect(() => registry.register(createMockProvider('invalid id'))).toThrow(AgentError);
      expect(() => registry.register(createMockProvider('invalid.id'))).toThrow(AgentError);
    });

    it('should throw for provider ID starting with a hyphen', () => {
      expect(() => registry.register(createMockProvider('-invalid'))).toThrow(AgentError);
    });

    it('should throw for provider ID ending with a hyphen', () => {
      expect(() => registry.register(createMockProvider('invalid-'))).toThrow(AgentError);
    });

    it('should accept single character provider ID', () => {
      registry.register(createMockProvider('a'));
      expect(registry.has('a')).toBe(true);
    });

    it('should accept 64-character provider ID', () => {
      const id = 'a'.repeat(64);
      registry.register(createMockProvider(id));
      expect(registry.has(id)).toBe(true);
    });
  });

  describe('get()', () => {
    it('should return the registered provider', () => {
      const provider = createMockProvider('test-provider');
      registry.register(provider);
      expect(registry.get('test-provider')).toBe(provider);
    });

    it('should throw PROVIDER_NOT_FOUND for unknown ID', () => {
      try {
        registry.get('nonexistent');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentError);
        expect((err as AgentError).error_code).toBe('PROVIDER_NOT_FOUND');
      }
    });
  });

  describe('has()', () => {
    it('should return true for registered provider', () => {
      registry.register(createMockProvider('exists'));
      expect(registry.has('exists')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(registry.has('does-not-exist')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return empty array when no providers registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered provider IDs', () => {
      registry.register(createMockProvider('alpha'));
      registry.register(createMockProvider('beta'));
      registry.register(createMockProvider('gamma'));
      const ids = registry.list();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('alpha');
      expect(ids).toContain('beta');
      expect(ids).toContain('gamma');
    });
  });
});
