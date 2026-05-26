/**
 * Property-based tests for LLMProviderRegistry.
 *
 * Property: Registry Round-trip
 *   Validates: Requirements 1.5, 1.6, 1.13, 1.14
 *
 * Tests that:
 * - Registering a provider with ID X and retrieving by ID X returns the same instance
 * - Retrieving an unregistered ID throws PROVIDER_NOT_FOUND
 * - Replacing a provider with the same ID returns the new instance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { LLMProviderRegistry } from '../../../src/agent/providers/LLMProviderRegistry';
import { AgentError } from '../../../src/agent/errors/AgentError';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';
import type { CompletionParams, CompletionResult, ModelCapabilities } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid provider IDs: 1-64 characters, alphanumeric and hyphens only,
 * not starting or ending with a hyphen.
 */
const validProviderIdArb = fc
  .tuple(
    // First character: alphanumeric
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 1,
      maxLength: 1,
    }),
    // Middle characters: alphanumeric and hyphens (0-62 chars)
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), {
      minLength: 0,
      maxLength: 62,
    }),
    // Last character: alphanumeric (only if middle is non-empty, to avoid length 1 IDs ending with hyphen)
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
      minLength: 0,
      maxLength: 1,
    }),
  )
  .map(([first, middle, last]) => {
    const id = first + middle + last;
    // Ensure total length is 1-64
    return id.slice(0, 64);
  })
  .filter((id) => {
    // Must not start or end with hyphen, must be 1-64 chars
    if (id.length === 0 || id.length > 64) return false;
    if (id.startsWith('-') || id.endsWith('-')) return false;
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(id);
  });

/**
 * Generates provider IDs that are guaranteed NOT to be in a given set.
 * Used for testing PROVIDER_NOT_FOUND behavior.
 */
function unregisteredIdArb(registeredIds: string[]): fc.Arbitrary<string> {
  return validProviderIdArb.filter((id) => !registeredIds.includes(id));
}

// ---------------------------------------------------------------------------
// Property: Registry Round-trip
// Validates: Requirements 1.5, 1.6, 1.13, 1.14
// ---------------------------------------------------------------------------

describe('Property: Registry Round-trip', () => {
  let registry: LLMProviderRegistry;

  beforeEach(() => {
    registry = new LLMProviderRegistry();
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   *
   * For any valid provider ID X, registering a provider with ID X and then
   * retrieving by ID X SHALL return the exact same provider instance (===).
   */
  it('register then get returns the same instance for any valid provider ID', () => {
    fc.assert(
      fc.property(validProviderIdArb, (providerId) => {
        const freshRegistry = new LLMProviderRegistry();
        const provider = createMockProvider(providerId);

        freshRegistry.register(provider);
        const retrieved = freshRegistry.get(providerId);

        expect(retrieved).toBe(provider);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 1.13**
   *
   * For any valid provider ID X that is NOT registered in the registry,
   * calling get(X) SHALL throw an AgentError with code PROVIDER_NOT_FOUND.
   */
  it('get throws PROVIDER_NOT_FOUND for any unregistered provider ID', () => {
    fc.assert(
      fc.property(
        // Generate a registered ID and an unregistered ID
        validProviderIdArb,
        validProviderIdArb,
        (registeredId, queryId) => {
          // Only test when the IDs are different
          fc.pre(registeredId !== queryId);

          const freshRegistry = new LLMProviderRegistry();
          freshRegistry.register(createMockProvider(registeredId));

          try {
            freshRegistry.get(queryId);
            // Should not reach here
            expect.fail('Expected PROVIDER_NOT_FOUND error');
          } catch (err) {
            expect(err).toBeInstanceOf(AgentError);
            expect((err as AgentError).error_code).toBe('PROVIDER_NOT_FOUND');
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 1.14**
   *
   * For any valid provider ID X, registering a provider with ID X, then
   * registering a NEW provider with the same ID X, then retrieving by ID X
   * SHALL return the new (replacement) provider instance.
   */
  it('replacing a provider with the same ID returns the new instance', () => {
    fc.assert(
      fc.property(validProviderIdArb, (providerId) => {
        const freshRegistry = new LLMProviderRegistry();
        const original = createMockProvider(providerId);
        const replacement = createMockProvider(providerId);

        freshRegistry.register(original);
        freshRegistry.register(replacement);

        const retrieved = freshRegistry.get(providerId);

        // Must be the replacement, not the original
        expect(retrieved).toBe(replacement);
        expect(retrieved).not.toBe(original);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   *
   * For any set of distinct valid provider IDs, registering all of them and
   * then retrieving each one SHALL return the correct instance for each ID.
   */
  it('multiple providers can be registered and each retrieved by its own ID', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validProviderIdArb, { minLength: 1, maxLength: 10 }),
        (providerIds) => {
          const freshRegistry = new LLMProviderRegistry();
          const providers = providerIds.map((id) => createMockProvider(id));

          // Register all
          providers.forEach((p) => freshRegistry.register(p));

          // Retrieve each and verify identity
          providers.forEach((p, idx) => {
            const retrieved = freshRegistry.get(providerIds[idx]);
            expect(retrieved).toBe(p);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
