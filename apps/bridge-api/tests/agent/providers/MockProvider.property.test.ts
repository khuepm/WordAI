/**
 * Property-based tests for MockProvider determinism.
 *
 * Property 2: Tier Determinism (adapted for Mock)
 *   Identical inputs always produce identical outputs.
 *   **Validates: Requirements 1.8**
 *
 * The MockProvider generates responses by hashing the first message content,
 * so for any valid CompletionParams, calling generateCompletion twice with
 * the same params must yield the same content, and the content must be non-empty.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MockProvider } from '../../../src/agent/providers/MockProvider';
import type { AgentMessage, CompletionParams } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid AgentMessage with random role and non-empty content.
 */
const agentMessageArb: fc.Arbitrary<AgentMessage> = fc.record({
  role: fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<
    'system' | 'user' | 'assistant' | 'tool'
  >,
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * Generates valid CompletionParams with random messages, temperature, and max_tokens.
 * Constraints match the MockProvider validation rules:
 * - messages: at least 1 message with non-empty content
 * - temperature: 0.0 to 2.0
 * - max_tokens: integer 1 to 128000
 */
const completionParamsArb: fc.Arbitrary<CompletionParams> = fc
  .record({
    messages: fc.array(agentMessageArb, { minLength: 1, maxLength: 5 }),
    model: fc.string({ minLength: 1, maxLength: 64 }),
    temperature: fc.double({ min: 0.0, max: 2.0, noNaN: true }),
    max_tokens: fc.integer({ min: 1, max: 128000 }),
  })
  .map((r) => ({
    messages: r.messages,
    model: r.model,
    temperature: r.temperature,
    max_tokens: r.max_tokens,
  }));

// ---------------------------------------------------------------------------
// Property 2: Tier Determinism (adapted for Mock)
// Validates: Requirements 1.8
// ---------------------------------------------------------------------------

describe('Property 2: MockProvider Determinism', () => {
  const provider = new MockProvider();

  /**
   * **Validates: Requirements 1.8**
   *
   * For any valid CompletionParams, calling generateCompletion twice with
   * identical inputs SHALL always produce identical content.
   */
  it('identical inputs always produce identical outputs', async () => {
    await fc.assert(
      fc.asyncProperty(completionParamsArb, async (params) => {
        const result1 = await provider.generateCompletion(params);
        const result2 = await provider.generateCompletion(params);

        expect(result1.content).toBe(result2.content);
        expect(result1.tokens_used).toBe(result2.tokens_used);
        expect(result1.finish_reason).toBe(result2.finish_reason);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.8**
   *
   * For any valid CompletionParams, the response content SHALL always be non-empty.
   */
  it('response content is always non-empty', async () => {
    await fc.assert(
      fc.asyncProperty(completionParamsArb, async (params) => {
        const result = await provider.generateCompletion(params);

        expect(result.content.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
