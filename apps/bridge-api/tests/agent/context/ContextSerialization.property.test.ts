/**
 * Property-based tests for Context serialization round-trip.
 *
 * Property 8: Context Round-trip
 *   deserialize(serialize(C)) produces structurally equal output.
 *   **Validates: Requirements 5.11**
 *
 * The ContextManager serializes AgentContextState to JSON (converting Maps to
 * plain objects) and deserializes back (converting plain objects to Maps).
 * For any valid context state, the round-trip must preserve all fields.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ContextManager } from '../../../src/agent/context/AgentContext';
import type { AgentMessage, AgentResult, AgentStatus } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid AgentMessage with random role and content.
 */
const agentMessageArb: fc.Arbitrary<AgentMessage> = fc.record({
  role: fc.constantFrom('system', 'user', 'assistant', 'tool') as fc.Arbitrary<
    'system' | 'user' | 'assistant' | 'tool'
  >,
  content: fc.string({ minLength: 0, maxLength: 200 }),
});

/**
 * Generates a valid AgentResult with random fields within valid bounds.
 */
const agentResultArb: fc.Arbitrary<AgentResult> = fc.record({
  status: fc.constantFrom('success', 'error', 'partial', 'max_iterations_reached') as fc.Arbitrary<AgentStatus>,
  output_content: fc.string({ minLength: 0, maxLength: 300 }),
  confidence_score: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
  tokens_used: fc.nat({ max: 100000 }),
  processing_time_ms: fc.nat({ max: 300000 }),
});

/**
 * Generates a random task_id string (alphanumeric with hyphens).
 */
const taskIdArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/);

/**
 * Generates a random step_id for intermediate results.
 */
const stepIdArb: fc.Arbitrary<string> = fc.stringMatching(/^step-[a-z0-9]{1,10}$/);

/**
 * Generates random task_metadata as a Record<string, unknown> with JSON-safe values.
 */
const taskMetadataArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  fc.oneof(
    fc.string({ maxLength: 50 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
  ),
  { minKeys: 0, maxKeys: 5 },
);

/**
 * Generates random shared_knowledge as a Record<string, string>.
 */
const sharedKnowledgeArb: fc.Arbitrary<Record<string, string>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  fc.string({ minLength: 0, maxLength: 100 }),
  { minKeys: 0, maxKeys: 5 },
);

/**
 * Generates a random set of intermediate results as [stepId, AgentResult] pairs.
 */
const intermediateResultsArb: fc.Arbitrary<Array<[string, AgentResult]>> = fc.array(
  fc.tuple(stepIdArb, agentResultArb),
  { minLength: 0, maxLength: 5 },
);

/**
 * Composite arbitrary for all the random data needed to populate a context.
 */
const contextDataArb = fc.record({
  taskId: taskIdArb,
  conversationHistory: fc.array(agentMessageArb, { minLength: 0, maxLength: 10 }),
  intermediateResults: intermediateResultsArb,
  taskMetadata: taskMetadataArb,
  sharedKnowledge: sharedKnowledgeArb,
});

// ---------------------------------------------------------------------------
// Property 8: Context Round-trip
// Validates: Requirements 5.11
// ---------------------------------------------------------------------------

describe('Property 8: Context Serialization Round-trip', () => {
  let manager: ContextManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    manager = new ContextManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  /**
   * **Validates: Requirements 5.11**
   *
   * For any AgentContextState C, deserialize(serialize(C)) SHALL produce
   * a structurally equal AgentContextState where all fields match.
   */
  it('deserialize(serialize(C)) produces structurally equal output', () => {
    fc.assert(
      fc.property(contextDataArb, (data) => {
        // Create context and populate with random data
        const ctx = manager.create(data.taskId, data.taskMetadata);

        // Add conversation history
        for (const msg of data.conversationHistory) {
          ctx.conversation_history.push(msg);
        }

        // Add intermediate results
        for (const [stepId, result] of data.intermediateResults) {
          manager.addIntermediateResult(data.taskId, stepId, result);
        }

        // Add shared knowledge
        for (const [key, value] of Object.entries(data.sharedKnowledge)) {
          manager.addSharedKnowledge(data.taskId, key, value);
        }

        // Serialize
        const json = manager.serialize(data.taskId);
        expect(json).not.toBeNull();

        // Deserialize
        const restored = manager.deserialize(json!);

        // Assert structural equality of all fields
        expect(restored.task_id).toBe(ctx.task_id);
        expect(restored.conversation_history).toEqual(ctx.conversation_history);
        expect(restored.task_metadata).toEqual(ctx.task_metadata);
        expect(restored.shared_knowledge).toEqual(ctx.shared_knowledge);
        expect(restored.created_at).toBe(ctx.created_at);
        expect(restored.expires_at).toBe(ctx.expires_at);

        // Compare intermediate_results Map contents
        expect(restored.intermediate_results).toBeInstanceOf(Map);
        expect(restored.intermediate_results.size).toBe(ctx.intermediate_results.size);
        for (const [key, value] of ctx.intermediate_results) {
          expect(restored.intermediate_results.has(key)).toBe(true);
          expect(restored.intermediate_results.get(key)).toEqual(value);
        }

        // Clean up for next iteration
        manager.dispose(data.taskId);
      }),
      { numRuns: 100 },
    );
  });
});
