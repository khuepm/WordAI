/**
 * LLM Provider Registry
 *
 * Manages the registration and retrieval of LLM Provider implementations.
 * Enforces a maximum provider limit, validates provider ID format, and
 * supports replacing existing providers on duplicate registration.
 *
 * Requirements: 1.5, 1.6, 1.13, 1.14
 */

import type { LLMProvider } from './LLMProvider';
import { AgentError } from '../errors/AgentError';

/**
 * Valid provider ID pattern: 1-64 characters, alphanumeric and hyphens only.
 * Must not start or end with a hyphen.
 */
const PROVIDER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

/**
 * Registry that manages available LLM Provider implementations.
 *
 * Supports registering up to MAX_PROVIDERS providers, retrieving them by ID,
 * checking existence, and listing all registered provider IDs.
 */
export class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  /** Maximum number of providers that can be registered simultaneously. */
  static readonly MAX_PROVIDERS = 10;

  /**
   * Register an LLM Provider in the registry.
   *
   * If a provider with the same ID already exists, it is replaced.
   * Throws if the registry is at capacity and the provider ID is new.
   * Throws if the provider ID format is invalid.
   *
   * @param provider - The LLM Provider instance to register
   * @throws AgentError with INVALID_REQUEST if provider ID format is invalid
   * @throws AgentError with INVALID_REQUEST if registry is at capacity
   */
  register(provider: LLMProvider): void {
    const providerId = provider.providerId;

    if (!this.isValidProviderId(providerId)) {
      throw new AgentError(
        'INVALID_REQUEST',
        `Invalid provider ID "${providerId}": must be 1-64 characters, alphanumeric and hyphens only`,
      );
    }

    // Allow replacement of existing provider (Requirement 1.14)
    if (this.providers.has(providerId)) {
      this.providers.set(providerId, provider);
      return;
    }

    // Enforce MAX_PROVIDERS limit (Requirement 1.5)
    if (this.providers.size >= LLMProviderRegistry.MAX_PROVIDERS) {
      throw new AgentError(
        'INVALID_REQUEST',
        `Cannot register provider "${providerId}": maximum of ${LLMProviderRegistry.MAX_PROVIDERS} providers reached`,
      );
    }

    this.providers.set(providerId, provider);
  }

  /**
   * Retrieve a provider by its unique identifier.
   *
   * @param providerId - The provider identifier to look up
   * @returns The registered LLM Provider instance
   * @throws AgentError with PROVIDER_NOT_FOUND if the ID is not registered
   */
  get(providerId: string): LLMProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new AgentError(
        'PROVIDER_NOT_FOUND',
        `Provider "${providerId}" is not registered`,
      );
    }

    return provider;
  }

  /**
   * Check whether a provider with the given ID is registered.
   *
   * @param providerId - The provider identifier to check
   * @returns true if the provider exists in the registry, false otherwise
   */
  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * List all registered provider IDs.
   *
   * @returns An array of registered provider identifier strings
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Validate that a provider ID conforms to the required format.
   * Must be 1-64 characters, alphanumeric and hyphens only.
   */
  private isValidProviderId(id: string): boolean {
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      return false;
    }
    return PROVIDER_ID_PATTERN.test(id);
  }
}
