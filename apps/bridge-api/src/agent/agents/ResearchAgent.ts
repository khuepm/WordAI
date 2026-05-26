/**
 * AuraSphere Agent Framework — Research Agent
 *
 * Specialized agent for gathering, synthesizing, and fact-checking information.
 * Configured with access to document_retrieval and web_search tools.
 *
 * Requirements: 2.2
 */

import { BaseAgent, AgentExecutionContext } from './BaseAgent';
import type { LLMProvider } from '../providers/LLMProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { AgentConfig, AgentTask, CompletionResult } from '../types';

// ---------------------------------------------------------------------------
// Research Agent System Prompt
// ---------------------------------------------------------------------------

const RESEARCH_SYSTEM_PROMPT = `You are a Research Agent specialized in gathering, synthesizing, and fact-checking information.

Your responsibilities:
- Search and retrieve relevant documents and web sources to answer research queries
- Synthesize information from multiple sources into coherent, well-structured summaries
- Fact-check claims by cross-referencing multiple sources
- Cite sources and indicate confidence levels for findings
- Identify gaps in available information and suggest further research directions

Guidelines:
- Prioritize accuracy over speed — verify claims before including them
- Present findings in a clear, organized manner with proper attribution
- When sources conflict, note the discrepancy and provide context
- Use available tools (document_retrieval, web_search) to gather comprehensive information
- Provide a confidence assessment for each major finding`;

// ---------------------------------------------------------------------------
// ResearchAgent Class
// ---------------------------------------------------------------------------

/**
 * Research agent that gathers, synthesizes, and fact-checks information.
 *
 * Extends BaseAgent with:
 * - Role: "research"
 * - Allowed tools: document_retrieval, web_search
 * - Supported tiers: turbo, pro
 * - Max iterations: 10
 */
export class ResearchAgent extends BaseAgent {
  /**
   * Creates a new ResearchAgent instance.
   *
   * @param provider - The LLM provider to use for completions
   * @param toolRegistry - The tool registry for tool invocations
   */
  constructor(provider: LLMProvider, toolRegistry: ToolRegistry) {
    const config: AgentConfig = {
      agent_id: 'research-agent',
      role: 'research',
      system_prompt: RESEARCH_SYSTEM_PROMPT,
      allowed_tools: ['document_retrieval', 'web_search'],
      supported_tiers: ['turbo', 'pro'],
      max_iterations: 10,
    };

    super(config, provider, toolRegistry);
  }

  /**
   * Factory method to create a ResearchAgent instance.
   *
   * @param provider - The LLM provider to use for completions
   * @param toolRegistry - The tool registry for tool invocations
   * @returns A new ResearchAgent instance
   */
  static create(provider: LLMProvider, toolRegistry: ToolRegistry): ResearchAgent {
    return new ResearchAgent(provider, toolRegistry);
  }

  // -------------------------------------------------------------------------
  // Abstract Method Implementations
  // -------------------------------------------------------------------------

  /**
   * Builds a research-focused system prompt for the given task.
   *
   * Combines the base research prompt with task-specific context to guide
   * the LLM toward comprehensive information gathering and synthesis.
   *
   * @param task - The research task to execute
   * @returns The complete system prompt string
   */
  protected buildSystemPrompt(task: AgentTask): string {
    return `${RESEARCH_SYSTEM_PROMPT}

Current Task:
- Intent: ${task.intent}
${task.content ? `- Context: ${task.content}` : ''}

Focus on providing well-researched, accurate, and properly attributed information. Use available tools to gather comprehensive data before synthesizing your response.`;
  }

  /**
   * Evaluates whether the LLM completion indicates the research task is done.
   *
   * Research is considered complete when the LLM signals it has finished
   * generating output (finish_reason is 'stop').
   *
   * @param result - The LLM completion result
   * @returns true if finish_reason is 'stop'
   */
  protected evaluateCompletion(result: CompletionResult): boolean {
    return result.finish_reason === 'stop';
  }

  /**
   * Extracts a confidence score from the LLM result.
   *
   * Returns a default confidence of 0.8 for research results, reflecting
   * that research outputs are generally reliable but may require further
   * verification by downstream agents.
   *
   * @param _result - The LLM completion result (unused for default confidence)
   * @returns 0.8 as the default confidence score for research results
   */
  protected extractConfidence(_result: CompletionResult): number {
    return 0.8;
  }
}
