import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TierRouter } from '../../../src/agent/orchestrator/TierRouter';
import { LLMProviderRegistry } from '../../../src/agent/providers/LLMProviderRegistry';
import { CircuitBreaker } from '../../../src/agent/errors/CircuitBreaker';
import { AgentError } from '../../../src/agent/errors/AgentError';
import type { AgentTask, ComplexityIndicators } from '../../../src/agent/types';
import type { LLMProvider } from '../../../src/agent/providers/LLMProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(providerId: string): LLMProvider {
  return {
    providerId,
    generateCompletion: vi.fn(),
    generateStream: vi.fn(),
    getModelCapabilities: vi.fn().mockReturnValue({
      max_context_length: 128000,
      supports_function_calling: true,
      supports_streaming: true,
      supported_output_formats: ['text', 'json', 'markdown'],
    }),
  };
}

function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    task_id: 'task-001',
    intent: 'Write a short greeting',
    user_id: 'user-1',
    trace_id: 'trace-1',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function createComplexity(overrides: Partial<ComplexityIndicators> = {}): ComplexityIndicators {
  return {
    estimated_output_length: 200,
    requires_research: false,
    requires_multi_step: false,
    ...overrides,
  };
}

function createRouter(circuitBreaker?: CircuitBreaker) {
  const registry = new LLMProviderRegistry();
  const turboProvider = createMockProvider('turbo-provider');
  const proProvider = createMockProvider('pro-provider');
  registry.register(turboProvider);
  registry.register(proProvider);

  const cb = circuitBreaker ?? new CircuitBreaker();

  const router = new TierRouter(registry, cb, {
    turboProviderId: 'turbo-provider',
    proProviderId: 'pro-provider',
  });

  return { router, registry, circuitBreaker: cb, turboProvider, proProvider };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TierRouter', () => {
  describe('classify() — tier determination', () => {
    it('assigns Turbo when output < 500, no research, no multi-step', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 300 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('turbo');
      expect(decision.provider_id).toBe('turbo-provider');
    });

    it('assigns Pro when requires_research is true', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ requires_research: true }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.provider_id).toBe('pro-provider');
    });

    it('assigns Pro when requires_multi_step is true', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ requires_multi_step: true }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.provider_id).toBe('pro-provider');
    });

    it('assigns Pro when estimated_output_length > 2000', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 2500 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.provider_id).toBe('pro-provider');
    });

    it('assigns Turbo for middle range (500-2000) with no research/multi-step', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 1500 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('turbo');
      expect(decision.provider_id).toBe('turbo-provider');
    });

    it('assigns Turbo for exactly 2000 tokens with no research/multi-step', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 2000 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('turbo');
      expect(decision.provider_id).toBe('turbo-provider');
    });

    it('assigns Pro for exactly 2001 tokens', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 2001 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.provider_id).toBe('pro-provider');
    });
  });

  describe('classify() — user explicit tier selection', () => {
    it('honors user selection of turbo regardless of complexity', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({
          estimated_output_length: 5000,
          requires_research: true,
          requires_multi_step: true,
          user_explicit_tier_selection: 'turbo',
        }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('turbo');
      expect(decision.reasoning).toContain('explicitly selected');
    });

    it('honors user selection of pro regardless of simplicity', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({
          estimated_output_length: 50,
          requires_research: false,
          requires_multi_step: false,
          user_explicit_tier_selection: 'pro',
        }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.reasoning).toContain('explicitly selected');
    });
  });

  describe('classify() — provider health and fallback', () => {
    it('falls back to pro provider when turbo provider is unhealthy', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, cooldownMs: 30_000 });
      const { router } = createRouter(cb);

      // Trip the circuit breaker for turbo provider
      cb.recordFailure('turbo-provider');
      cb.recordFailure('turbo-provider');

      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 100 }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('turbo');
      expect(decision.provider_id).toBe('pro-provider');
    });

    it('falls back to turbo provider when pro provider is unhealthy', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, cooldownMs: 30_000 });
      const { router } = createRouter(cb);

      // Trip the circuit breaker for pro provider
      cb.recordFailure('pro-provider');
      cb.recordFailure('pro-provider');

      const task = createTask({
        complexity: createComplexity({ requires_research: true }),
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
      expect(decision.provider_id).toBe('turbo-provider');
    });

    it('throws ALL_PROVIDERS_UNAVAILABLE when both providers are unhealthy', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, cooldownMs: 30_000 });
      const { router } = createRouter(cb);

      // Trip both circuit breakers
      cb.recordFailure('turbo-provider');
      cb.recordFailure('turbo-provider');
      cb.recordFailure('pro-provider');
      cb.recordFailure('pro-provider');

      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 100 }),
      });

      expect(() => router.classify(task)).toThrow(AgentError);
      expect(() => router.classify(task)).toThrow('Both primary and fallback LLM providers are unavailable');
    });
  });

  describe('classify() — reasoning field', () => {
    it('includes reasoning for research-based Pro classification', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ requires_research: true }),
      });

      const decision = router.classify(task);

      expect(decision.reasoning).toContain('research');
    });

    it('includes reasoning for multi-step Pro classification', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ requires_multi_step: true }),
      });

      const decision = router.classify(task);

      expect(decision.reasoning).toContain('multi-step');
    });

    it('includes token count in reasoning for output-length Pro classification', () => {
      const { router } = createRouter();
      const task = createTask({
        complexity: createComplexity({ estimated_output_length: 3000 }),
      });

      const decision = router.classify(task);

      expect(decision.reasoning).toContain('3000');
    });
  });

  describe('classify() — derived complexity indicators', () => {
    it('derives complexity from task when not explicitly provided', () => {
      const { router } = createRouter();
      const task = createTask({
        intent: 'Write a short greeting',
        complexity: undefined,
      });

      const decision = router.classify(task);

      // Short intent, no research keywords → Turbo
      expect(decision.tier).toBe('turbo');
    });

    it('detects research keywords in intent', () => {
      const { router } = createRouter();
      const task = createTask({
        intent: 'Research the latest trends in AI development',
        complexity: undefined,
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
    });

    it('detects multi-step keywords in intent', () => {
      const { router } = createRouter();
      const task = createTask({
        intent: 'First write an outline then expand each section step by step',
        complexity: undefined,
      });

      const decision = router.classify(task);

      expect(decision.tier).toBe('pro');
    });
  });

  describe('getProvider()', () => {
    it('returns turbo provider for turbo tier', () => {
      const { router, turboProvider } = createRouter();

      const provider = router.getProvider('turbo');

      expect(provider).toBe(turboProvider);
    });

    it('returns pro provider for pro tier', () => {
      const { router, proProvider } = createRouter();

      const provider = router.getProvider('pro');

      expect(provider).toBe(proProvider);
    });

    it('returns fallback provider when primary is unhealthy', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, cooldownMs: 30_000 });
      const { router, proProvider } = createRouter(cb);

      cb.recordFailure('turbo-provider');
      cb.recordFailure('turbo-provider');

      const provider = router.getProvider('turbo');

      expect(provider).toBe(proProvider);
    });

    it('throws ALL_PROVIDERS_UNAVAILABLE when both are unhealthy', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, windowMs: 60_000, cooldownMs: 30_000 });
      const { router } = createRouter(cb);

      cb.recordFailure('turbo-provider');
      cb.recordFailure('turbo-provider');
      cb.recordFailure('pro-provider');
      cb.recordFailure('pro-provider');

      expect(() => router.getProvider('turbo')).toThrow(AgentError);
    });
  });
});
