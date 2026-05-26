/**
 * AuraSphere Agent Framework — Document Retrieval Tool
 *
 * Built-in tool that retrieves document content by document_id.
 * Currently returns stub content; will be connected to the WordAI Editor
 * document store in a future integration phase.
 *
 * Requirements: 7.8
 */

import { Tool } from './Tool';
import { ToolDefinition, ToolResult, ValidationError } from '../types';

/**
 * Tool that retrieves the full content of a user's document in WordAI Editor.
 * Accepts a document_id parameter and returns the document content as a string.
 */
export class DocumentRetrievalTool implements Tool {
  readonly toolId = 'document_retrieval';

  /**
   * Returns the JSON Schema definition for this tool following the
   * OpenAI function-calling format.
   */
  getSchema(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'document_retrieval',
        description:
          'Retrieves the full content of a document from the WordAI Editor by its unique document identifier.',
        parameters: {
          type: 'object',
          properties: {
            document_id: {
              type: 'string',
              description: 'The unique identifier of the document to retrieve.',
            },
          },
          required: ['document_id'],
          additionalProperties: false,
        },
      },
    };
  }

  /**
   * Validates that the input contains a non-empty string document_id.
   *
   * @param input - The raw input to validate
   * @returns Validation result with any errors
   */
  validateInput(input: unknown): { valid: boolean; errors?: ValidationError[] } {
    const errors: ValidationError[] = [];

    if (input === null || typeof input !== 'object') {
      errors.push({
        field_path: '',
        reason: 'Input must be a non-null object',
      });
      return { valid: false, errors };
    }

    const record = input as Record<string, unknown>;

    if (!('document_id' in record)) {
      errors.push({
        field_path: 'document_id',
        reason: 'Required property "document_id" is missing',
      });
      return { valid: false, errors };
    }

    if (typeof record.document_id !== 'string') {
      errors.push({
        field_path: 'document_id',
        reason: 'Property "document_id" must be a string',
      });
      return { valid: false, errors };
    }

    if (record.document_id.trim().length === 0) {
      errors.push({
        field_path: 'document_id',
        reason: 'Property "document_id" must be a non-empty string',
      });
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Executes the document retrieval. Currently returns stub content.
   * Will be replaced with actual document store integration in a future phase.
   *
   * @param input - Validated input containing document_id
   * @returns A ToolResult with the document content
   */
  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const { document_id } = input as { document_id: string };

    // Stub implementation — returns placeholder content
    const output = `Document content for ${document_id}`;

    return {
      success: true,
      output,
      execution_time_ms: Date.now() - startTime,
    };
  }
}
