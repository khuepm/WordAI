/**
 * Context Window Manager
 *
 * Manages token tracking and context truncation for LLM provider calls.
 * Ensures that the total context (system prompt + messages) never exceeds
 * the provider's max_context_length.
 *
 * Phase 1: Summarization is a placeholder that falls back to truncation.
 * Phase 2: Will integrate with LLM provider for actual summarization.
 *
 * Requirements: 5.3, 5.4, 5.9, 5.10, 5.12
 */

import type { AgentMessage } from '../types';

/**
 * ContextWindow tracks token usage and enforces the LLM provider's
 * max_context_length for all context passed to agents.
 *
 * Token estimation uses a simple heuristic of ~4 characters per token
 * (suitable for English text). This can be replaced with tiktoken in Phase 2.
 */
export class ContextWindow {
  /** Maximum context length in tokens (from provider capabilities). */
  private readonly maxContextLength: number;

  /** Current token count after the last fitToWindow call. */
  private currentTokens: number = 0;

  /** Characters per token estimation ratio. */
  private static readonly CHARS_PER_TOKEN = 4;

  /** Number of most recent messages to always preserve during truncation. */
  private static readonly PRESERVED_RECENT_MESSAGES = 3;

  /** Maximum fraction of maxContextLength that a summary may occupy. */
  private static readonly SUMMARY_BUDGET_RATIO = 0.2;

  /**
   * @param maxContextLength - Maximum context length in tokens from the provider's capabilities.
   */
  constructor(maxContextLength: number) {
    if (maxContextLength <= 0) {
      throw new Error('maxContextLength must be a positive number');
    }
    this.maxContextLength = maxContextLength;
  }

  /**
   * Estimate the number of tokens in a text string.
   * Uses a simple heuristic: ~4 characters per token (for English text).
   *
   * @param text - The text to estimate tokens for.
   * @returns Estimated token count (always at least 1 for non-empty text).
   */
  estimateTokens(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / ContextWindow.CHARS_PER_TOKEN);
  }

  /**
   * Fit messages into the context window, truncating older messages if necessary.
   *
   * Strategy:
   * 1. Calculate total tokens for system_prompt + all messages.
   * 2. If within limit, return messages as-is.
   * 3. If over limit: preserve system_prompt + last 3 messages,
   *    attempt summarization (Phase 1: falls back to truncation),
   *    remove oldest messages first until it fits.
   *
   * @param systemPrompt - The system prompt (always preserved).
   * @param messages - Array of conversation messages.
   * @param maxTokens - Maximum tokens allowed for the response (reserved from context budget).
   * @returns Messages that fit within the context window.
   */
  fitToWindow(
    systemPrompt: string,
    messages: AgentMessage[],
    maxTokens: number,
  ): AgentMessage[] {
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    const availableTokens = this.maxContextLength - maxTokens;

    // Calculate total tokens for all messages
    const messageTokens = messages.map((msg) => this.estimateMessageTokens(msg));
    const totalTokens = systemPromptTokens + messageTokens.reduce((sum, t) => sum + t, 0);

    // If within limit, return messages as-is
    if (totalTokens <= availableTokens) {
      this.currentTokens = totalTokens;
      return [...messages];
    }

    // Over limit: need to truncate
    // Preserve the most recent N messages
    const preserveCount = Math.min(
      ContextWindow.PRESERVED_RECENT_MESSAGES,
      messages.length,
    );
    const preservedMessages = messages.slice(-preserveCount);
    const olderMessages = messages.slice(0, messages.length - preserveCount);

    // Calculate tokens for preserved portion
    const preservedTokens =
      systemPromptTokens +
      preservedMessages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0);

    // If preserved messages alone exceed the budget, return only what we can
    if (preservedTokens >= availableTokens) {
      this.currentTokens = preservedTokens;
      return [...preservedMessages];
    }

    // Try summarization (Phase 1: placeholder that falls back to truncation)
    const summarizedMessages = this.trySummarize(
      olderMessages,
      availableTokens - preservedTokens,
    );

    if (summarizedMessages !== null) {
      const result = [...summarizedMessages, ...preservedMessages];
      this.currentTokens =
        systemPromptTokens +
        result.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0);
      return result;
    }

    // Fallback: truncate by removing oldest messages first until it fits
    const truncatedOlder = this.truncateOldestFirst(
      olderMessages,
      availableTokens - preservedTokens,
    );

    const result = [...truncatedOlder, ...preservedMessages];
    this.currentTokens =
      systemPromptTokens +
      result.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0);
    return result;
  }

  /**
   * Get the current token count (after the last fitToWindow call).
   */
  getCurrentTokens(): number {
    return this.currentTokens;
  }

  /**
   * Get the maximum token limit for this context window.
   */
  getMaxTokens(): number {
    return this.maxContextLength;
  }

  /**
   * Get the summary budget in tokens (max 20% of maxContextLength).
   */
  getSummaryBudget(): number {
    return Math.floor(this.maxContextLength * ContextWindow.SUMMARY_BUDGET_RATIO);
  }

  /**
   * Estimate tokens for a single message (role overhead + content).
   */
  private estimateMessageTokens(message: AgentMessage): number {
    // Account for role token overhead (~4 tokens for role/formatting)
    const roleOverhead = 4;
    return roleOverhead + this.estimateTokens(message.content);
  }

  /**
   * Attempt to summarize older messages to fit within the budget.
   *
   * Phase 1: This is a placeholder. Real summarization would call the LLM
   * provider to generate a summary. In Phase 1, we fall back to truncation
   * (return null to signal summarization is not available).
   *
   * The summary budget is max 20% of maxContextLength.
   *
   * @param messages - Older messages to summarize.
   * @param availableTokens - Token budget available for the summary.
   * @returns Summarized messages or null if summarization is not available.
   */
  private trySummarize(
    messages: AgentMessage[],
    availableTokens: number,
  ): AgentMessage[] | null {
    // Phase 1: Summarization not implemented, fall back to truncation.
    // In Phase 2, this would:
    // 1. Check if summary budget (20% of maxContextLength) is sufficient
    // 2. Call LLM provider to generate a summary of the older messages
    // 3. Return a single "system" or "assistant" message with the summary
    // 4. If LLM call fails, return null to trigger truncation fallback
    void messages;
    void availableTokens;
    return null;
  }

  /**
   * Truncate older messages by removing from the front (oldest first)
   * until the remaining messages fit within the available token budget.
   *
   * @param messages - Older messages to truncate.
   * @param availableTokens - Token budget for these messages.
   * @returns Messages that fit within the budget (preserving most recent of the older set).
   */
  private truncateOldestFirst(
    messages: AgentMessage[],
    availableTokens: number,
  ): AgentMessage[] {
    if (availableTokens <= 0) {
      return [];
    }

    // Work backwards from the most recent of the older messages
    const result: AgentMessage[] = [];
    let usedTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateMessageTokens(messages[i]);
      if (usedTokens + msgTokens <= availableTokens) {
        result.unshift(messages[i]);
        usedTokens += msgTokens;
      } else {
        // No more room, stop adding older messages
        break;
      }
    }

    return result;
  }
}
