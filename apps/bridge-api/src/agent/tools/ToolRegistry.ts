/**
 * AuraSphere Agent Framework — Tool Registry
 *
 * Manages registration, discovery, and invocation of tools available to agents.
 * Enforces access control (allowed_tools), input validation (JSON Schema),
 * and per-tool execution timeouts.
 *
 * Requirements: 7.4, 7.5, 7.6, 7.7, 7.10, 7.11, 7.12, 7.13
 */

import { Tool } from './Tool';
import { ToolDefinition, ToolResult } from '../types';
import { AgentError } from '../errors/AgentError';

/** Default per-tool execution timeout in milliseconds (30 seconds). */
const TOOL_TIMEOUT_MS = 30_000;

/**
 * Registry that manages available tools and provides safe invocation
 * with access control, input validation, and timeout enforcement.
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Registers a tool in the registry.
   * If a tool with the same toolId already exists, it will be replaced.
   *
   * @param tool - The tool instance to register
   */
  register(tool: Tool): void {
    this.tools.set(tool.toolId, tool);
  }

  /**
   * Retrieves a tool by its unique identifier.
   *
   * @param toolId - The tool identifier to look up
   * @returns The registered Tool instance
   * @throws AgentError with code TOOL_NOT_FOUND if the tool is not registered
   */
  get(toolId: string): Tool {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new AgentError(
        'TOOL_NOT_FOUND',
        `Tool '${toolId}' is not registered in the Tool Registry`,
      );
    }
    return tool;
  }

  /**
   * Checks whether a tool with the given identifier is registered.
   *
   * @param toolId - The tool identifier to check
   * @returns true if the tool exists in the registry, false otherwise
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Returns the schema definitions of all registered tools.
   *
   * @returns Array of ToolDefinition from all registered tools
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getSchema());
  }

  /**
   * Invokes a tool with access control, input validation, and timeout enforcement.
   *
   * Steps:
   * 1. Check tool exists → TOOL_NOT_FOUND
   * 2. Check toolId is in allowedTools → TOOL_NOT_ALLOWED
   * 3. Validate input using tool.validateInput() → TOOL_INVALID_INPUT
   * 4. Execute with 30s timeout using Promise.race → TOOL_TIMEOUT
   * 5. Return ToolResult
   *
   * @param toolId - The identifier of the tool to invoke
   * @param input - The input parameters for the tool
   * @param allowedTools - Array of tool IDs the calling agent is permitted to use
   * @returns The tool execution result
   * @throws AgentError with appropriate error code on failure
   */
  async invoke(
    toolId: string,
    input: unknown,
    allowedTools: string[],
  ): Promise<ToolResult> {
    // 1. Check tool exists
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new AgentError(
        'TOOL_NOT_FOUND',
        `Tool '${toolId}' is not registered in the Tool Registry`,
      );
    }

    // 2. Check access control
    if (!allowedTools.includes(toolId)) {
      throw new AgentError(
        'TOOL_NOT_ALLOWED',
        `Tool '${toolId}' is not in the agent's allowed_tools list`,
      );
    }

    // 3. Validate input against schema
    const validation = tool.validateInput(input);
    if (!validation.valid) {
      const error = new AgentError(
        'TOOL_INVALID_INPUT',
        `Input validation failed for tool '${toolId}'`,
      );
      // Attach validation errors as a property for consumers
      (error as AgentError & { validation_errors?: typeof validation.errors }).validation_errors =
        validation.errors;
      throw error;
    }

    // 4. Execute with 30s timeout
    const result = await Promise.race([
      tool.execute(input),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new AgentError(
              'TOOL_TIMEOUT',
              `Tool '${toolId}' execution exceeded the ${TOOL_TIMEOUT_MS / 1000}s timeout`,
            ),
          );
        }, TOOL_TIMEOUT_MS);
      }),
    ]);

    // 5. Return ToolResult
    return result;
  }
}
