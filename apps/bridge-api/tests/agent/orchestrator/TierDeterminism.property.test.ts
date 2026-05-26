/**
 * Property-based tests for TierRouter determinism.
 *
 * Property 2: Tier Determinism
 *   Same complexity indicators always produce the same tier.
 *   **Validates: Requirements 4.3, 4.4, 4.5**
 *
 * The TierRouter classifies tasks based on complexity indicators:
 * - output > 2000 OR requires_research OR requires_multi_step → Pro
 * - Otherwise → Turbo
 *
 * For any given set of complexity indicators (without user_explicit_tier_selection),
 * calling classify() multiple times must always yield the same tier.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TierRouter } from '../../../src/agent/orchestrator/TierRouter';
import { LLMProviderRegistry } from '../../../src/agent/providers/LLMProviderRegistry';
import { CircuitBreaker } from '../../../src/agent/errors/CircuitBreaker';
import type { AgentTask, ComplexityIndicators } from '../../../src/agent/types';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(providerId: string): LLMProvider {
  return {
    providerId,
    generateCompletion: async () => ({
      content: 'mock',
      tokens_used: 10,
      finish_reason: 'stop' as const,
    }),
    generateStream: async function* () {
      yield 'mock';
    },
    getModelCapabilities: () => ({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text', 'json', 'markdown'],
    }),
  };
}

function createRouterWithHealthyProviders(): TierRouter {
  const registry = new LLMProviderRegistry();
  registry.register(createMockProvider('turbo-provider'));
  registry.register(createMockProvider('pro-provider'));

  const circuitBreaker = new CircuitBreaker();

  return new TierRouter(registry, circuitBreaker, {
    turboProviderId: 'turbo-provider',
    proProviderId: 'pro-provider',
  });
}

function createTask(complexity: ComplexityIndicators): AgentTask {
  return {
    task_id: 'task-prop-test',
    intent: 'Property test task',
    user_id: 'user-1',
    trace_id: 'trace-1',
    created_at: new Date().toISOString(),
    complexity,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates random ComplexityIndicators with:
 * - estimated_output_length: 1 to 10000
 * - requires_research: random boolean
 * - requires_multi_step: random boolean
 * - user_explicit_tier_selection: optional 'turbo' | 'pro' | undefined
 */
const complexityIndicatorsArb: fc.Arbitrary<ComplexityIndicators> = fc.record({
  estimated_output_length: fc.integer({ min: 1, max: 10000 }),
  requires_research: fc.boolean(),
  requires_multi_step: fc.boolean(),
  user_explicit_tier_selection: fc.option(
    fc.constantFrom('turbo' as const, 'pro' as const),
    { nil: undefined },
  ),
});

// ---------------------------------------------------------------------------
// Property 2: Tier Determinism
// Validates: Requirements 4.3, 4.4, 4.5
// ---------------------------------------------------------------------------

describe('Property 2: Tier Determinism', () => {
  /**
   * **Validates: Requirements 4.3, 4.4, 4.5**
   *
   * For any set of complexity indicators, calling classify() twice with
   * the same task/complexity indicators SHALL always produce the same tier.
   */
  it('same complexity indicators always produce same tier', () => {
    const router = createRouterWithHealthyProviders();

    fc.assert(
      fc.property(complexityIndicatorsArb, (complexity) => {
        const task = createTask(complexity);

        const decision1 = router.classify(task);
        const decision2 = router.classify(task);

        expect(decision1.tier).toBe(decision2.tier);
        expect(decision1.provider_id).toBe(decision2.provider_id);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * For any complexity indicators where estimated_output_length > 2000
   * OR requires_research is true OR requires_multi_step is true,
   * the tier SHALL be Pro (unless user explicitly selects otherwise).
   */
  it('output > 2000 OR research OR multi-step → Pro tier', () => {
    const router = createRouterWithHealthyProviders();

    const proComplexityArb = complexityIndicatorsArb.filter(
      (c) =>
        c.user_explicit_tier_selection === undefined &&
        (c.estimated_output_length > 2000 || c.requires_research || c.requires_multi_step),
    );

    fc.assert(
      fc.property(proComplexityArb, (complexity) => {
        const task = createTask(complexity);
        const decision = router.classify(task);

        expect(decision.tier).toBe('pro');
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.3, 4.5**
   *
   * For any complexity indicators where estimated_output_length <= 2000
   * AND requires_research is false AND requires_multi_step is false,
   * the tier SHALL be Turbo (unless user explicitly selects otherwise).
   */
  it('output <= 2000 AND no research AND no multi-step → Turbo tier', () => {
    const router = createRouterWithHealthyProviders();

    const turboComplexityArb = complexityIndicatorsArb.filter(
      (c) =>
        c.user_explicit_tier_selection === undefined &&
        c.estimated_output_length <= 2000 &&
        !c.requires_research &&
        !c.requires_multi_step,
    );

    fc.assert(
      fc.property(turboComplexityArb, (complexity) => {
        const task = createTask(complexity);
        const decision = router.classify(task);

        expect(decision.tier).toBe('turbo');
      }),
      { numRuns: 200 },
    );
  });
});
