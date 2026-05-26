/**
 * Property-based tests for Token Bound enforcement.
 *
 * Property: Token Bound
 *   Validates: Requirements 5.3
 *
 * Tests that:
 * - The context passed to the LLM (system prompt + returned messages) never
 *   exceeds (maxContextLength - maxTokens) in estimated tokens.
 * - Uses ContextWindow's own estimateTokens method for consistency.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ContextWindow } from '../../../src/agent/context/ContextWindow';
import type { AgentMessage } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estimate total tokens for system prompt + messages using the same logic
 * as ContextWindow (4 chars per token + 4 token overhead per message).
 */
function estimateTotalTokens(
  cw: ContextWindow,
  systemPrompt: string,
  messages: AgentMessage[],
): number {
  const systemTokens = cw.estimateTokens(systemPrompt);
  const messageTokens = messages.reduce((sum, msg) => {
    // 4 tokens role overhead + content tokens (matches ContextWindow internals)
    return sum + 4 + cw.estimateTokens(msg.content);
  }, 0);
  return systemTokens + messageTokens;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a random role for messages. */
const arbRole = fc.constantFrom<'user' | 'assistant'>('user', 'assistant');

/** Generate a single AgentMessage with content between 1 and 5000 chars. */
const arbMessage: fc.Arbitrary<AgentMessage> = fc.record({
  role: arbRole,
  content: fc.string({ minLength: 1, maxLength: 5000 }),
});

/** Generate an array of 1-20 messages. */
const arbMessages: fc.Arbitrary<AgentMessage[]> = fc.array(arbMessage, {
  minLength: 1,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Property: Token Bound
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe('Property: Token Bound', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * For any combination of maxContextLength, system prompt, messages, and
   * maxTokens reservation, the total estimated tokens of the context returned
   * by fitToWindow (system prompt + returned messages) SHALL never exceed
   * (maxContextLength - maxTokens).
   */
  it('context passed to LLM never exceeds max_context_length minus maxTokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 128000 }),       // maxContextLength
        fc.string({ minLength: 1, maxLength: 1000 }), // systemPrompt
        arbMessages,                                   // messages (1-20, each 1-5000 chars)
        fc.integer({ min: 1, max: 1000 }),            // maxTokens reservation
        async (maxContextLength, systemPrompt, messages, maxTokens) => {
          // Ensure maxTokens doesn't exceed maxContextLength
          // (otherwise there's no room for any context at all)
          fc.pre(maxTokens < maxContextLength);

          const cw = new ContextWindow(maxContextLength);
          const result = cw.fitToWindow(systemPrompt, messages, maxTokens);

          // Calculate total tokens for system prompt + returned messages
          const totalTokens = estimateTotalTokens(cw, systemPrompt, result);
          const availableBudget = maxContextLength - maxTokens;

          // The token bound property: total context tokens must not exceed
          // the available budget (maxContextLength - maxTokens)
          expect(totalTokens).toBeLessThanOrEqual(availableBudget);
        },
      ),
      { numRuns: 200 },
    );
  });
});
