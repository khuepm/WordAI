/**
 * AuraSphere Agent Framework — Writer Agent
 *
 * Specialized agent for content generation and expansion. Focuses on
 * producing written content based on user intents, outlines, and research
 * context provided by upstream agents.
 *
 * Requirements: 2.3
 */

import type { AgentTask, CompletionResult } from '../types';
import type { LLMProvider } from '../providers/LLMProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import { BaseAgent } from './BaseAgent';

// ---------------------------------------------------------------------------
// Default system prompt for the Writer Agent
// ---------------------------------------------------------------------------

const WRITER_SYSTEM_PROMPT = `You are a professional content writer within the AuraSphere framework. Your role is to generate, expand, and compose high-quality written content based on the user's intent, outlines, and any research context provided.

Guidelines:
- Produce clear, engaging, and well-structured content that fulfills the user's intent.
- When an outline is provided, expand each section with relevant detail and smooth transitions.
- When research context is available, incorporate key findings naturally into the writing.
- Maintain a consistent tone and voice throughout the content.
- Use appropriate formatting (headings, paragraphs, lists) to enhance readability.
- Ensure factual accuracy based on the provided context — do not fabricate information.
- If the intent is ambiguous, produce the most reasonable interpretation and note any assumptions.

You have access to the document_retrieval tool to fetch the user's current document for reference when needed.`;

// ---------------------------------------------------------------------------
// WriterAgent Class
// ---------------------------------------------------------------------------

/**
 * Writer agent specialized in content generation and expansion.
 *
 * - Role: writer
 * - Allowed tools: document_retrieval
 * - Supported tiers: turbo, pro
 * - Max iterations: 10
 */
export class WriterAgent extends BaseAgent {
  constructor(provider: LLMProvider, toolRegistry: ToolRegistry) {
    super(
      {
        agent_id: 'writer-agent',
        role: 'writer',
        system_prompt: WRITER_SYSTEM_PROMPT,
        allowed_tools: ['document_retrieval'],
        supported_tiers: ['turbo', 'pro'],
        max_iterations: 10,
      },
      provider,
      toolRegistry,
    );
  }

  /**
   * Builds the system prompt for a writing task.
   *
   * Augments the base system prompt with task-specific context such as
   * content length expectations or style guidance derived from the task intent.
   */
  protected buildSystemPrompt(task: AgentTask): string {
    let prompt = this.config.system_prompt;

    if (task.content) {
      prompt += `\n\nReference content or outline provided by the user:\n${task.content}`;
    }

    return prompt;
  }

  /**
   * Evaluates whether the writing task is complete.
   *
   * The writer considers the task complete when the LLM signals it has
   * finished generating content (finish_reason is 'stop').
   */
  protected evaluateCompletion(result: CompletionResult): boolean {
    return result.finish_reason === 'stop';
  }

  /**
   * Extracts a confidence score for the writing result.
   *
   * Returns a default confidence of 0.85 for writing outputs, reflecting
   * that generated content typically meets quality expectations but may
   * benefit from editorial review.
   */
  protected extractConfidence(_result: CompletionResult): number {
    return 0.85;
  }
}
