/**
 * AuraSphere Agent Framework — Formatter Agent
 *
 * Specialized agent for applying structural formatting, headings, lists,
 * and output transformations. Works on provided content without external tools.
 *
 * Requirements: 2.5
 */

import type { AgentTask, CompletionResult } from '../types';
import type { LLMProvider } from '../providers/LLMProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import { BaseAgent } from './BaseAgent';

// ---------------------------------------------------------------------------
// FormatterAgent
// ---------------------------------------------------------------------------

/**
 * Agent specialized in applying structural formatting and output transformations.
 *
 * - Role: formatter
 * - Allowed tools: none (works on provided content directly)
 * - Supported tiers: turbo, pro
 * - Max iterations: 5 (formatting is simpler, fewer iterations needed)
 */
export class FormatterAgent extends BaseAgent {
  constructor(provider: LLMProvider, toolRegistry: ToolRegistry) {
    super(
      {
        agent_id: 'formatter-agent',
        role: 'formatter',
        system_prompt: [
          'You are a formatting specialist. Your role is to apply structural formatting,',
          'headings, lists, tables, and output transformations to content.',
          '',
          'Your responsibilities:',
          '- Apply consistent heading hierarchy (H1, H2, H3, etc.)',
          '- Convert unstructured text into well-organized lists and bullet points',
          '- Format tables, code blocks, and other structured elements',
          '- Apply markdown or other output format transformations as requested',
          '- Ensure consistent spacing, indentation, and visual hierarchy',
          '- Preserve the original meaning and content while improving structure',
          '',
          'Guidelines:',
          '- Do not alter the substance or meaning of the content',
          '- Focus solely on structure, layout, and visual presentation',
          '- Use appropriate formatting for the target output format',
          '- Maintain readability and logical flow of information',
        ].join('\n'),
        allowed_tools: [],
        supported_tiers: ['turbo', 'pro'],
        max_iterations: 5,
      },
      provider,
      toolRegistry,
    );
  }

  // -------------------------------------------------------------------------
  // Abstract Method Implementations
  // -------------------------------------------------------------------------

  /**
   * Builds a formatting-focused system prompt for the LLM.
   *
   * @param task - The task being executed
   * @returns The system prompt string focused on formatting and structure
   */
  protected buildSystemPrompt(task: AgentTask): string {
    const basePrompt = [
      'You are a formatting specialist. Your role is to apply structural formatting,',
      'headings, lists, tables, and output transformations to content.',
      '',
      'Your responsibilities:',
      '- Apply consistent heading hierarchy (H1, H2, H3, etc.)',
      '- Convert unstructured text into well-organized lists and bullet points',
      '- Format tables, code blocks, and other structured elements',
      '- Apply markdown or other output format transformations as requested',
      '- Ensure consistent spacing, indentation, and visual hierarchy',
      '- Preserve the original meaning and content while improving structure',
      '',
      'Guidelines:',
      '- Do not alter the substance or meaning of the content',
      '- Focus solely on structure, layout, and visual presentation',
      '- Use appropriate formatting for the target output format',
      '- Maintain readability and logical flow of information',
    ].join('\n');

    if (task.content) {
      return `${basePrompt}\n\nFormat the following content according to the user's instructions.`;
    }

    return basePrompt;
  }

  /**
   * Evaluates whether the formatting task is complete.
   * Formatting is considered complete when the LLM finishes its response (finish_reason is 'stop').
   *
   * @param result - The LLM completion result
   * @returns true when finish_reason is 'stop'
   */
  protected evaluateCompletion(result: CompletionResult): boolean {
    return result.finish_reason === 'stop';
  }

  /**
   * Extracts confidence score for formatting results.
   * Formatting tasks produce high-confidence results by default since they are
   * deterministic structural transformations.
   *
   * @param _result - The LLM completion result (unused for formatter)
   * @returns 0.95 as default confidence for formatting results
   */
  protected extractConfidence(_result: CompletionResult): number {
    return 0.95;
  }
}
