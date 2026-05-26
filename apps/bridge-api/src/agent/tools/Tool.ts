/**
 * AuraSphere Agent Framework — Tool Interface
 *
 * Defines the contract that all tools must implement to be usable by agents.
 * Tools provide external capabilities (web search, document retrieval, etc.)
 * that agents can invoke during task execution.
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import { ToolDefinition, ToolResult, ValidationError } from '../types';

/**
 * Interface that all agent tools must implement.
 *
 * A Tool represents an external capability that an agent can invoke
 * during task execution. Each tool has a unique identifier, a JSON Schema
 * describing its input parameters, input validation, and an execute method.
 */
export interface Tool {
  /** Unique identifier for this tool. */
  readonly toolId: string;

  /**
   * Returns the JSON Schema describing this tool's input parameters.
   * The schema follows the OpenAI function-calling format.
   */
  getSchema(): ToolDefinition;

  /**
   * Validates the given input against this tool's schema.
   * Returns whether the input is valid and any validation errors.
   *
   * @param input - The raw input to validate
   * @returns An object with `valid` boolean and optional `errors` array
   */
  validateInput(input: unknown): { valid: boolean; errors?: ValidationError[] };

  /**
   * Executes the tool with the given input.
   * Input should be validated before calling execute.
   *
   * @param input - The validated input parameters
   * @returns A promise resolving to a ToolResult
   */
  execute(input: unknown): Promise<ToolResult>;
}
