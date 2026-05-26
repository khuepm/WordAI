/**
 * AuraSphere Agent Framework — Base Agent
 *
 * Abstract base class for all specialized agents. Provides:
 * - AgentConfig validation (agent_id, system_prompt, max_iterations bounds)
 * - Task-role validation before execution
 * - LLM call loop with iteration counting and max_iterations enforcement
 * - Tool call handling via ToolRegistry
 * - Abstract hooks for subclass customization
 *
 * Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11
 */

import type {
  AgentConfig,
  AgentTask,
  AgentResult,
  AgentStatus,
  AgentMessage,
  AgentRole,
  CompletionParams,
  CompletionResult,
} from '../types';
import type { LLMProvider } from '../providers/LLMProvider';
import { ToolRegistry } from '../tools/ToolRegistry';
import { AgentError } from '../errors/AgentError';

// ---------------------------------------------------------------------------
// Role-to-task-type mapping for validation
// ---------------------------------------------------------------------------

/**
 * Maps agent roles to the task types they accept.
 * Used for task-role validation in execute().
 */
const ROLE_TASK_TYPE_MAP: Record<AgentRole, string> = {
  research: 'research',
  writer: 'writing',
  editor: 'editing',
  formatter: 'formatting',
};

// ---------------------------------------------------------------------------
// Agent execution context (simplified for Phase 1)
// ---------------------------------------------------------------------------

/**
 * Context provided to an agent during execution.
 * Contains conversation history and intermediate results from upstream agents.
 */
export interface AgentExecutionContext {
  conversation_history: AgentMessage[];
  intermediate_results: Record<string, AgentResult>;
}

// ---------------------------------------------------------------------------
// BaseAgent Abstract Class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all AuraSphere agents.
 *
 * Subclasses must implement:
 * - buildSystemPrompt(task): Construct the system prompt for the LLM
 * - evaluateCompletion(result): Determine if the task is complete
 * - extractConfidence(result): Extract a confidence score from the LLM result
 */
export abstract class BaseAgent {
  protected readonly config: AgentConfig;
  protected readonly provider: LLMProvider;
  protected readonly toolRegistry: ToolRegistry;

  constructor(config: AgentConfig, provider: LLMProvider, toolRegistry: ToolRegistry) {
    this.validateConfig(config);
    this.config = config;
    this.provider = provider;
    this.toolRegistry = toolRegistry;
  }

  // -------------------------------------------------------------------------
  // Config Validation
  // -------------------------------------------------------------------------

  /**
   * Validates the agent configuration at construction time.
   *
   * @throws AgentError with code INVALID_REQUEST if validation fails
   */
  private validateConfig(config: AgentConfig): void {
    if (!config.agent_id || config.agent_id.length > 64) {
      throw new AgentError(
        'INVALID_REQUEST',
        `agent_id must be a non-empty string of at most 64 characters, got length ${config.agent_id?.length ?? 0}`,
      );
    }

    if (!config.system_prompt || config.system_prompt.length > 8000) {
      throw new AgentError(
        'INVALID_REQUEST',
        `system_prompt must be a non-empty string of at most 8000 characters, got length ${config.system_prompt?.length ?? 0}`,
      );
    }

    if (
      config.max_iterations == null ||
      !Number.isInteger(config.max_iterations) ||
      config.max_iterations < 1 ||
      config.max_iterations > 100
    ) {
      throw new AgentError(
        'INVALID_REQUEST',
        `max_iterations must be an integer between 1 and 100, got ${config.max_iterations}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Main Execution Loop
  // -------------------------------------------------------------------------

  /**
   * Executes a task using the agent's LLM provider and tools.
   *
   * Steps:
   * 1. Validate task type matches agent role (if task has explicit type)
   * 2. Build messages from system prompt + context
   * 3. Loop: call LLM, check completion, handle tool calls, count iterations
   * 4. If max_iterations reached, return partial result
   * 5. Return AgentResult with output, confidence, tokens, timing
   *
   * @param task - The task to execute
   * @param context - Execution context with conversation history and intermediate results
   * @returns The agent result
   * @throws AgentError with code TASK_ROLE_MISMATCH if task type doesn't match role
   */
  async execute(task: AgentTask, context?: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    // 1. Validate task type matches agent role
    this.validateTaskRole(task);

    // 2. Build messages
    const systemPrompt = this.buildSystemPrompt(task);
    const messages: AgentMessage[] = [{ role: 'system', content: systemPrompt }];

    // Add conversation history from context
    if (context?.conversation_history) {
      messages.push(...context.conversation_history);
    }

    // Add the task intent as a user message
    const userContent = task.content
      ? `${task.intent}\n\n${task.content}`
      : task.intent;
    messages.push({ role: 'user', content: userContent });

    // 3. LLM call loop
    let iterationCount = 0;
    let totalTokensUsed = 0;
    let accumulatedContent = '';

    while (iterationCount < this.config.max_iterations) {
      iterationCount++;

      const params: CompletionParams = {
        messages: [...messages],
        model: 'default',
        temperature: 0.7,
        max_tokens: 4096,
        tools: this.toolRegistry.list().length > 0 ? this.toolRegistry.list() : undefined,
      };

      const result = await this.provider.generateCompletion(params);
      totalTokensUsed += result.tokens_used;

      // Accumulate content from the response
      if (result.content) {
        accumulatedContent += result.content;
        messages.push({ role: 'assistant', content: result.content });
      }

      // Handle tool calls
      if (result.finish_reason === 'tool_call' && result.tool_calls?.length) {
        for (const toolCall of result.tool_calls) {
          try {
            const toolInput = JSON.parse(toolCall.function.arguments);
            const toolResult = await this.toolRegistry.invoke(
              toolCall.function.name,
              toolInput,
              this.config.allowed_tools,
            );

            // Add tool result to messages
            messages.push({
              role: 'tool',
              content: JSON.stringify(toolResult.output),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          } catch (error) {
            // Add tool error to messages so the LLM can handle it
            const errorMessage =
              error instanceof AgentError
                ? `Error: ${error.error_code} - ${error.message}`
                : `Error: ${String(error)}`;

            messages.push({
              role: 'tool',
              content: errorMessage,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }
        // Continue the loop to let the LLM process tool results
        continue;
      }

      // Check if the task is complete
      if (this.evaluateCompletion(result)) {
        const confidence = this.extractConfidence(result);
        return {
          status: 'success' as AgentStatus,
          output_content: accumulatedContent,
          confidence_score: Math.max(0, Math.min(1, confidence)),
          tokens_used: totalTokensUsed,
          processing_time_ms: Date.now() - startTime,
        };
      }

      // If finish_reason is 'stop' but evaluateCompletion says not done,
      // we still continue the loop (agent may need more iterations)
    }

    // 4. Max iterations reached — return partial result
    return {
      status: 'max_iterations_reached' as AgentStatus,
      output_content: accumulatedContent || '',
      confidence_score: 0.0,
      tokens_used: totalTokensUsed,
      processing_time_ms: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Task-Role Validation
  // -------------------------------------------------------------------------

  /**
   * Validates that the task type matches the agent's role.
   *
   * For Phase 1: If the task has an explicit `type` field in its metadata,
   * validate it against the role mapping. Otherwise, accept all tasks.
   *
   * @throws AgentError with code TASK_ROLE_MISMATCH if types don't match
   */
  private validateTaskRole(task: AgentTask): void {
    // Check if the task has an explicit type via the complexity indicators
    // or a type field. For Phase 1, we use a convention:
    // If task.intent starts with a known type prefix, validate it.
    // Otherwise, accept all tasks for any role.
    const taskType = this.inferTaskType(task);

    if (taskType && taskType !== ROLE_TASK_TYPE_MAP[this.config.role]) {
      throw new AgentError(
        'TASK_ROLE_MISMATCH',
        `Agent '${this.config.agent_id}' with role '${this.config.role}' cannot process task type '${taskType}'. Expected type: '${ROLE_TASK_TYPE_MAP[this.config.role]}'`,
        this.config.agent_id,
        task.task_id,
      );
    }
  }

  /**
   * Infers the task type from the task metadata.
   * Returns null if no explicit type can be determined (accept all).
   */
  private inferTaskType(task: AgentTask): string | null {
    // Check if complexity indicators suggest a specific type
    if (task.complexity?.requires_research) {
      return 'research';
    }

    // For Phase 1, we don't enforce strict type matching unless
    // the task explicitly declares a type. This allows any agent
    // to process any task by default.
    return null;
  }

  // -------------------------------------------------------------------------
  // Abstract Methods (must be implemented by subclasses)
  // -------------------------------------------------------------------------

  /**
   * Builds the system prompt for the LLM based on the task.
   * Subclasses customize this to provide role-specific instructions.
   *
   * @param task - The task being executed
   * @returns The system prompt string
   */
  protected abstract buildSystemPrompt(task: AgentTask): string;

  /**
   * Evaluates whether the LLM completion indicates the task is done.
   * Subclasses define their own completion criteria.
   *
   * @param result - The LLM completion result
   * @returns true if the task is considered complete
   */
  protected abstract evaluateCompletion(result: CompletionResult): boolean;

  /**
   * Extracts a confidence score (0.0-1.0) from the LLM result.
   * Subclasses define how confidence is determined.
   *
   * @param result - The LLM completion result
   * @returns A number between 0.0 and 1.0
   */
  protected abstract extractConfidence(result: CompletionResult): number;
}
