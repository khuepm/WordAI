/**
 * AuraSphere Agent Framework — Editor Agent
 *
 * Specialized agent for reviewing and improving content quality.
 * Focuses on clarity, grammar, tone, and factual consistency.
 * Does not use any external tools — works directly on provided content.
 *
 * Requirements: 2.4
 */

import type { AgentTask, CompletionResult } from '../types';
import type { LLMProvider } from '../providers/LLMProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import { BaseAgent } from './BaseAgent';

// ---------------------------------------------------------------------------
// EditorAgent
// ---------------------------------------------------------------------------

/**
 * Editor agent configured to review content for clarity, grammar, tone,
 * and factual consistency. Operates without external tools — all editing
 * is performed on the content provided in the task.
 */
export class EditorAgent extends BaseAgent {
  constructor(provider: LLMProvider, toolRegistry: ToolRegistry) {
    super(
      {
        agent_id: 'editor-agent',
        role: 'editor',
        system_prompt: [
          'You are an expert editor specializing in content review and improvement.',
          'Your responsibilities include:',
          '- Reviewing content for clarity and readability',
          '- Correcting grammar, spelling, and punctuation errors',
          '- Ensuring consistent tone and voice throughout the text',
          '- Checking factual consistency and logical coherence',
          '- Suggesting structural improvements for better flow',
          '- Preserving the original intent and meaning of the content',
          '',
          'When editing, provide the improved version of the content along with',
          'a brief summary of the changes made. Be precise and constructive in',
          'your feedback. Do not add new information — focus on refining what exists.',
        ].join('\n'),
        allowed_tools: [],
        supported_tiers: ['turbo', 'pro'],
        max_iterations: 10,
      },
      provider,
      toolRegistry,
    );
  }

  // -------------------------------------------------------------------------
  // Abstract Method Implementations
  // -------------------------------------------------------------------------

  /**
   * Builds a system prompt focused on content review and improvement.
   * Incorporates task-specific context when available.
   */
  protected buildSystemPrompt(task: AgentTask): string {
    const basePrompt = this.config.system_prompt;

    if (task.content) {
      return [
        basePrompt,
        '',
        'You have been provided with content to review and edit.',
        'Apply your editing expertise to improve the text while maintaining',
        'the author\'s original voice and intent.',
      ].join('\n');
    }

    return basePrompt;
  }

  /**
   * Evaluates whether the editing task is complete.
   * Returns true when the LLM finishes naturally (finish_reason is 'stop'),
   * indicating the editor has completed its review.
   */
  protected evaluateCompletion(result: CompletionResult): boolean {
    return result.finish_reason === 'stop';
  }

  /**
   * Extracts confidence score for editing results.
   * Returns 0.9 as the default confidence for editing output,
   * reflecting high reliability of grammar/clarity improvements.
   */
  protected extractConfidence(_result: CompletionResult): number {
    return 0.9;
  }
}
