/**
 * AuraSphere Agent Framework — Tier Router
 *
 * Classifies incoming AgentTasks into Turbo or Pro tier based on complexity
 * indicators and user preferences. Integrates with CircuitBreaker for
 * provider health checks and implements fallback routing when the primary
 * provider is unhealthy.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.12, 4.13, 4.14
 *
 * @module agent/orchestrator/TierRouter
 */

import type { AgentTask, ComplexityIndicators, TierDecision } from '../types';
import type { LLMProvider } from '../providers/LLMProvider';
import { LLMProviderRegistry } from '../providers/LLMProviderRegistry';
import { CircuitBreaker } from '../errors/CircuitBreaker';
import { AgentError } from '../errors/AgentError';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the TierRouter specifying which providers back each tier.
 */
export interface TierRouterConfig {
  /** Provider ID mapped to the Turbo (lightweight) tier. */
  turboProviderId: string;
  /** Provider ID mapped to the Pro (powerful) tier. */
  proProviderId: string;
}

// ---------------------------------------------------------------------------
// TierRouter Class
// ---------------------------------------------------------------------------

/**
 * Routes AgentTasks to the appropriate performance tier and provider.
 *
 * Classification rules (in priority order):
 * 1. If user_explicit_tier_selection is set → honor it
 * 2. If requires_research OR requires_multi_step OR estimated_output_length > 2000 → Pro
 * 3. Otherwise (including middle range 500-2000 with no research/multi-step) → Turbo
 *
 * After classification, the router checks provider health via CircuitBreaker.
 * If the primary provider is unhealthy, it falls back to the other tier's provider.
 * If both providers are unhealthy, it throws ALL_PROVIDERS_UNAVAILABLE.
 */
export class TierRouter {
  private readonly providerRegistry: LLMProviderRegistry;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: TierRouterConfig;

  constructor(
    providerRegistry: LLMProviderRegistry,
    circuitBreaker: CircuitBreaker,
    config: TierRouterConfig,
  ) {
    this.providerRegistry = providerRegistry;
    this.circuitBreaker = circuitBreaker;
    this.config = config;
  }

  /**
   * Classify an AgentTask into a tier and resolve the provider.
   *
   * @param task - The agent task to classify
   * @returns A TierDecision containing the assigned tier, reasoning, and provider_id
   * @throws AgentError with ALL_PROVIDERS_UNAVAILABLE if both providers are unhealthy
   */
  classify(task: AgentTask): TierDecision {
    const complexity = task.complexity ?? this.deriveComplexityIndicators(task);
    const { tier, reasoning } = this.determineTier(complexity);

    // Resolve provider with health check and fallback
    const providerId = this.resolveProvider(tier, task.task_id);

    const decision: TierDecision = {
      tier,
      reasoning,
      provider_id: providerId,
    };

    // Log the tier decision (Requirement 4.14)
    logger.info('Tier decision', {
      task_id: task.task_id,
      assigned_tier: decision.tier,
      reasoning: decision.reasoning,
      provider_id: decision.provider_id,
    });

    return decision;
  }

  /**
   * Get the LLM provider for a given tier, with fallback logic.
   *
   * @param tier - The tier to get the provider for
   * @returns The LLM provider instance
   * @throws AgentError with ALL_PROVIDERS_UNAVAILABLE if both providers are unhealthy
   */
  getProvider(tier: 'turbo' | 'pro'): LLMProvider {
    const providerId = this.resolveProvider(tier);
    return this.providerRegistry.get(providerId);
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Determine the tier based on complexity indicators.
   * Returns the tier and a human-readable reasoning string.
   */
  private determineTier(complexity: ComplexityIndicators): {
    tier: 'turbo' | 'pro';
    reasoning: string;
  } {
    // Rule 1: Honor explicit user selection (Requirement 4.6)
    if (complexity.user_explicit_tier_selection) {
      return {
        tier: complexity.user_explicit_tier_selection,
        reasoning: `User explicitly selected ${complexity.user_explicit_tier_selection} tier`,
      };
    }

    // Rule 2: Pro tier conditions (Requirement 4.4)
    if (complexity.requires_research) {
      return {
        tier: 'pro',
        reasoning: 'Task requires research capabilities',
      };
    }

    if (complexity.requires_multi_step) {
      return {
        tier: 'pro',
        reasoning: 'Task requires multi-step processing',
      };
    }

    if (complexity.estimated_output_length > 2000) {
      return {
        tier: 'pro',
        reasoning: `Estimated output length (${complexity.estimated_output_length} tokens) exceeds 2000 token threshold`,
      };
    }

    // Rule 3: Turbo for everything else (Requirements 4.3, 4.5)
    // This includes: output < 500 tokens AND middle range 500-2000 tokens
    // (when no research and no multi-step)
    return {
      tier: 'turbo',
      reasoning:
        complexity.estimated_output_length < 500
          ? 'Simple task: short output, no research, no multi-step'
          : `Medium complexity (${complexity.estimated_output_length} tokens) but no research or multi-step required`,
    };
  }

  /**
   * Resolve the provider ID for a tier, checking health and applying fallback.
   *
   * @param tier - The primary tier to resolve
   * @param taskId - Optional task ID for logging
   * @returns The resolved provider ID (primary or fallback)
   * @throws AgentError with ALL_PROVIDERS_UNAVAILABLE if both providers are unhealthy
   */
  private resolveProvider(tier: 'turbo' | 'pro', taskId?: string): string {
    const primaryProviderId = this.getProviderIdForTier(tier);
    const fallbackTier: 'turbo' | 'pro' = tier === 'turbo' ? 'pro' : 'turbo';
    const fallbackProviderId = this.getProviderIdForTier(fallbackTier);

    // Check primary provider health (Requirement 4.12)
    if (this.circuitBreaker.isHealthy(primaryProviderId)) {
      return primaryProviderId;
    }

    // Primary unhealthy — log warning and try fallback
    logger.warn('Primary provider unhealthy, attempting fallback', {
      task_id: taskId,
      primary_provider_id: primaryProviderId,
      fallback_provider_id: fallbackProviderId,
    });

    // Check fallback provider health (Requirement 4.13)
    if (this.circuitBreaker.isHealthy(fallbackProviderId)) {
      return fallbackProviderId;
    }

    // Both providers unavailable
    throw new AgentError(
      'ALL_PROVIDERS_UNAVAILABLE',
      'Both primary and fallback LLM providers are unavailable',
      undefined,
      taskId,
      false,
    );
  }

  /**
   * Map a tier to its configured provider ID.
   */
  private getProviderIdForTier(tier: 'turbo' | 'pro'): string {
    return tier === 'turbo' ? this.config.turboProviderId : this.config.proProviderId;
  }

  /**
   * Derive complexity indicators from the task when not explicitly provided.
   * Uses heuristics based on intent length and keywords.
   */
  private deriveComplexityIndicators(task: AgentTask): ComplexityIndicators {
    const intent = task.intent.toLowerCase();

    const requires_research =
      intent.includes('research') ||
      intent.includes('find information') ||
      intent.includes('look up') ||
      intent.includes('search for');

    const requires_multi_step =
      intent.includes('then') ||
      intent.includes('and also') ||
      intent.includes('followed by') ||
      intent.includes('step by step');

    // Estimate output length based on intent and content length
    const contentLength = task.content?.length ?? 0;
    const intentLength = task.intent.length;
    // Rough heuristic: longer intents and content suggest longer outputs
    const estimated_output_length = Math.max(
      100,
      Math.min(5000, Math.floor((intentLength + contentLength) / 4)),
    );

    return {
      estimated_output_length,
      requires_research,
      requires_multi_step,
      user_explicit_tier_selection: task.tier_preference,
    };
  }
}
