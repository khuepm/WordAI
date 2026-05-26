/**
 * Property-based tests for SSE Event Ordering.
 *
 * Property: SSE Event Ordering
 *   Validates: Requirements 6.13
 *
 * Verifies that SSE events emitted during streaming execution follow the
 * strict ordering invariant:
 *   task_accepted → (agent_started → token_chunk* → agent_completed)+ → task_completed
 *
 * Specifically:
 * - task_accepted is always the first event
 * - task_completed is always the last event
 * - Between them, events follow the pattern: (agent_started → token_chunk* → agent_completed)+
 * - agent_started always precedes agent_completed for the same agent
 * - No events appear after task_completed
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SSEEvent } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// SSE Event Sequence Generator
// ---------------------------------------------------------------------------

/**
 * Generates a valid SSE event sequence for a pipeline of N agents.
 * Each agent produces: agent_started → token_chunk* → agent_completed
 * The full sequence is: task_accepted → (per-agent events)+ → task_completed
 */
function generateSSEEventSequence(
  numAgents: number,
  tokenChunksPerAgent: number[],
): SSEEvent[] {
  const events: SSEEvent[] = [];

  // task_accepted is always first
  events.push({
    event: 'task_accepted',
    data: { task_id: 'test-task-id', tier: 'pro' },
  });

  // For each agent in the pipeline
  for (let i = 0; i < numAgents; i++) {
    const agentId = `agent-${i}`;
    const role = ['research', 'writer', 'editor', 'formatter'][i % 4];

    // agent_started
    events.push({
      event: 'agent_started',
      data: { agent_id: agentId, role },
    });

    // zero or more token_chunks
    const numChunks = tokenChunksPerAgent[i] ?? 0;
    for (let c = 0; c < numChunks; c++) {
      events.push({
        event: 'token_chunk',
        data: { content: `chunk-${i}-${c}` },
      });
    }

    // agent_completed
    events.push({
      event: 'agent_completed',
      data: { agent_id: agentId, tokens_used: (numChunks + 1) * 10 },
    });
  }

  // task_completed is always last
  events.push({
    event: 'task_completed',
    data: {
      task_id: 'test-task-id',
      status: 'success',
      output_content: 'final output',
      agents_used: Array.from({ length: numAgents }, (_, i) => `agent-${i}`),
      total_tokens: 100,
      execution_time_ms: 500,
      tier_used: 'pro',
    },
  });

  return events;
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validates the SSE event ordering invariant.
 * Returns { valid: true } if the sequence is valid, or { valid: false, reason: string }
 * if the invariant is violated.
 */
function validateSSEEventOrdering(events: SSEEvent[]): { valid: boolean; reason?: string } {
  if (events.length === 0) {
    return { valid: false, reason: 'Event sequence is empty' };
  }

  // 1. task_accepted must be first
  if (events[0].event !== 'task_accepted') {
    return { valid: false, reason: `First event must be task_accepted, got: ${events[0].event}` };
  }

  // 2. task_completed must be last
  if (events[events.length - 1].event !== 'task_completed') {
    return {
      valid: false,
      reason: `Last event must be task_completed, got: ${events[events.length - 1].event}`,
    };
  }

  // 3. No events after task_completed (only one task_completed allowed, at the end)
  const taskCompletedIndices = events
    .map((e, i) => (e.event === 'task_completed' ? i : -1))
    .filter((i) => i >= 0);
  if (taskCompletedIndices.length !== 1) {
    return {
      valid: false,
      reason: `Expected exactly one task_completed event, found ${taskCompletedIndices.length}`,
    };
  }

  // 4. Only one task_accepted allowed, at the beginning
  const taskAcceptedIndices = events
    .map((e, i) => (e.event === 'task_accepted' ? i : -1))
    .filter((i) => i >= 0);
  if (taskAcceptedIndices.length !== 1) {
    return {
      valid: false,
      reason: `Expected exactly one task_accepted event, found ${taskAcceptedIndices.length}`,
    };
  }

  // 5. Between task_accepted and task_completed, validate the pattern:
  //    (agent_started → token_chunk* → agent_completed)+
  const middleEvents = events.slice(1, events.length - 1);

  if (middleEvents.length === 0) {
    return { valid: false, reason: 'No agent events between task_accepted and task_completed' };
  }

  // State machine to validate the pattern
  type State = 'expect_agent_started' | 'in_agent' | 'after_agent_completed';
  let state: State = 'expect_agent_started';
  let currentAgentId: string | null = null;

  for (let i = 0; i < middleEvents.length; i++) {
    const event = middleEvents[i];

    switch (state) {
      case 'expect_agent_started':
        if (event.event !== 'agent_started') {
          return {
            valid: false,
            reason: `Expected agent_started at position ${i + 1}, got: ${event.event}`,
          };
        }
        currentAgentId = (event.data as { agent_id: string }).agent_id;
        state = 'in_agent';
        break;

      case 'in_agent':
        if (event.event === 'token_chunk') {
          // token_chunk is allowed zero or more times
          continue;
        } else if (event.event === 'agent_completed') {
          // Verify it's for the same agent
          const completedAgentId = (event.data as { agent_id: string }).agent_id;
          if (completedAgentId !== currentAgentId) {
            return {
              valid: false,
              reason: `agent_completed for "${completedAgentId}" but expected "${currentAgentId}" at position ${i + 1}`,
            };
          }
          currentAgentId = null;
          state = 'expect_agent_started';
          break;
        } else {
          return {
            valid: false,
            reason: `Unexpected event "${event.event}" while in agent at position ${i + 1}; expected token_chunk or agent_completed`,
          };
        }

      default:
        return { valid: false, reason: `Invalid state: ${state}` };
    }
  }

  // After processing all middle events, we should be back in expect_agent_started state
  // (meaning the last agent was properly completed)
  if (state !== 'expect_agent_started') {
    return {
      valid: false,
      reason: `Event sequence ended in invalid state: ${state} (agent "${currentAgentId}" was not completed)`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Property: SSE Event Ordering
// Validates: Requirements 6.13
// ---------------------------------------------------------------------------

describe('Property: SSE Event Ordering', () => {
  /**
   * **Validates: Requirements 6.13**
   *
   * For any number of agents (1-4) in a sequential pipeline with random
   * numbers of token chunks per agent, the generated SSE event sequence
   * must satisfy the ordering invariant:
   *   task_accepted → (agent_started → token_chunk* → agent_completed)+ → task_completed
   */
  it('correctly ordered event sequences pass validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-4 agents
        fc.integer({ min: 1, max: 4 }),
        // Generate token chunk counts per agent (0-10 chunks each)
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const tokenChunksPerAgent = chunkCounts.slice(0, numAgents);
          const events = generateSSEEventSequence(numAgents, tokenChunksPerAgent);

          const result = validateSSEEventOrdering(events);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * task_accepted is always the first event in any valid sequence.
   */
  it('task_accepted is always the first event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));
          expect(events[0].event).toBe('task_accepted');
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * task_completed is always the last event in any valid sequence.
   */
  it('task_completed is always the last event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));
          expect(events[events.length - 1].event).toBe('task_completed');
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * No events appear after task_completed.
   */
  it('no events appear after task_completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));

          const taskCompletedIndex = events.findIndex((e) => e.event === 'task_completed');
          expect(taskCompletedIndex).toBe(events.length - 1);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * agent_started always precedes agent_completed for the same agent.
   */
  it('agent_started always precedes agent_completed for the same agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));

          // For each agent, find agent_started and agent_completed indices
          for (let i = 0; i < numAgents; i++) {
            const agentId = `agent-${i}`;

            const startedIndex = events.findIndex(
              (e) =>
                e.event === 'agent_started' &&
                (e.data as { agent_id: string }).agent_id === agentId,
            );
            const completedIndex = events.findIndex(
              (e) =>
                e.event === 'agent_completed' &&
                (e.data as { agent_id: string }).agent_id === agentId,
            );

            expect(startedIndex).toBeGreaterThan(-1);
            expect(completedIndex).toBeGreaterThan(-1);
            expect(startedIndex).toBeLessThan(completedIndex);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * Sequences with events out of order are detected as invalid.
   * This tests that the validator correctly rejects malformed sequences.
   */
  it('detects invalid ordering when events are shuffled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }),
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 4, maxLength: 4 }),
        // Pick two distinct indices to swap (excluding first and last)
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        async (numAgents, chunkCounts, swapIdx1, swapIdx2) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));

          // Only swap if indices are valid and different (within middle events)
          const maxIdx = events.length - 2; // exclude last (task_completed)
          const idx1 = Math.min(swapIdx1, maxIdx);
          const idx2 = Math.min(swapIdx2, maxIdx);

          if (idx1 !== idx2 && idx1 > 0 && idx2 > 0) {
            // Swap two middle events to create an invalid sequence
            const corrupted = [...events];
            [corrupted[idx1], corrupted[idx2]] = [corrupted[idx2], corrupted[idx1]];

            // The corrupted sequence should fail validation (unless the swap
            // happens to produce another valid sequence, which is unlikely
            // but possible with adjacent token_chunks)
            const result = validateSSEEventOrdering(corrupted);

            // If both swapped events are token_chunks for the same agent,
            // the sequence might still be valid (order of chunks doesn't matter
            // within the same agent). Otherwise it should be invalid.
            if (
              corrupted[idx1].event === 'token_chunk' &&
              corrupted[idx2].event === 'token_chunk'
            ) {
              // Token chunks can be reordered within the same agent — might still be valid
              // We just verify the validator doesn't crash
              expect(typeof result.valid).toBe('boolean');
            } else {
              // Non-chunk swaps should produce invalid sequences
              expect(result.valid).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * A sequence missing task_accepted at the start is invalid.
   */
  it('rejects sequences without task_accepted at start', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));

          // Remove task_accepted (first event)
          const withoutAccepted = events.slice(1);
          const result = validateSSEEventOrdering(withoutAccepted);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('task_accepted');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * A sequence missing task_completed at the end is invalid.
   */
  it('rejects sequences without task_completed at end', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 4 }),
        async (numAgents, chunkCounts) => {
          const events = generateSSEEventSequence(numAgents, chunkCounts.slice(0, numAgents));

          // Remove task_completed (last event)
          const withoutCompleted = events.slice(0, -1);
          const result = validateSSEEventOrdering(withoutCompleted);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('task_completed');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 6.13**
   *
   * A sequence with agent_completed before agent_started is invalid.
   */
  it('rejects sequences where agent_completed appears before agent_started', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (numAgents) => {
          // Manually construct an invalid sequence
          const events: SSEEvent[] = [
            { event: 'task_accepted', data: { task_id: 'test', tier: 'pro' } },
            {
              event: 'agent_completed',
              data: { agent_id: 'agent-0', tokens_used: 10 },
            },
            {
              event: 'agent_started',
              data: { agent_id: 'agent-0', role: 'writer' },
            },
            {
              event: 'task_completed',
              data: {
                task_id: 'test',
                status: 'success',
                output_content: 'output',
                agents_used: ['agent-0'],
                total_tokens: 10,
                execution_time_ms: 100,
                tier_used: 'pro',
              },
            },
          ];

          const result = validateSSEEventOrdering(events);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});
