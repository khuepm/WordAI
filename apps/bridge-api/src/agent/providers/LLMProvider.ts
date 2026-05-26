/**
 * LLM Provider Interface
 *
 * Defines the abstract contract for all LLM backend implementations.
 * Any provider (Mock, OpenAI, self-hosted) must implement this interface
 * to be used by the Agent Engine.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import type { CompletionParams, CompletionResult, ModelCapabilities } from '../types';

/**
 * Abstract interface for Language Model providers.
 *
 * All LLM interactions in the AuraSphere Agent Framework go through this
 * pluggable interface, enabling backend swaps without modifying agent logic.
 */
export interface LLMProvider {
  /** Unique identifier for this provider instance. */
  readonly providerId: string;

  /**
   * Generate a completion from the LLM.
   *
   * Accepts structured messages, model configuration, and optional tool
   * definitions. Returns a structured result or throws an LLMProviderError.
   *
   * @param params - Completion request parameters including messages, model, temperature, max_tokens
   * @returns A promise resolving to the completion result
   */
  generateCompletion(params: CompletionParams): Promise<CompletionResult>;

  /**
   * Generate a streaming completion from the LLM.
   *
   * Accepts the same parameters as generateCompletion but returns an async
   * iterable of string token chunks, where each chunk contains one or more tokens.
   *
   * @param params - Completion request parameters
   * @returns An async iterable yielding string token chunks
   */
  generateStream(params: CompletionParams): AsyncIterable<string>;

  /**
   * Report the capabilities of the underlying model.
   *
   * Returns supported features including context length, function calling
   * support, streaming support, and output formats.
   *
   * @returns The model's capability descriptor
   */
  getModelCapabilities(): ModelCapabilities;
}
