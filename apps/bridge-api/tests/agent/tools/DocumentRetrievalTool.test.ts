/**
 * Unit tests for AuraSphere DocumentRetrievalTool
 *
 * Tests cover:
 * - toolId is 'document_retrieval'
 * - getSchema() returns correct ToolDefinition
 * - validateInput() accepts valid input
 * - validateInput() rejects null/non-object input
 * - validateInput() rejects missing document_id
 * - validateInput() rejects non-string document_id
 * - validateInput() rejects empty string document_id
 * - execute() returns stub content with success=true
 */

import { describe, it, expect } from 'vitest';
import { DocumentRetrievalTool } from '../../../src/agent/tools/DocumentRetrievalTool';

describe('DocumentRetrievalTool', () => {
  const tool = new DocumentRetrievalTool();

  describe('toolId', () => {
    it('should be "document_retrieval"', () => {
      expect(tool.toolId).toBe('document_retrieval');
    });
  });

  describe('getSchema()', () => {
    it('should return a valid ToolDefinition with function type', () => {
      const schema = tool.getSchema();

      expect(schema.type).toBe('function');
      expect(schema.function.name).toBe('document_retrieval');
      expect(schema.function.description).toBeTruthy();
    });

    it('should define document_id as a required string parameter', () => {
      const schema = tool.getSchema();
      const params = schema.function.parameters as Record<string, unknown>;

      expect(params.type).toBe('object');
      expect(params.required).toEqual(['document_id']);

      const properties = params.properties as Record<string, { type: string }>;
      expect(properties.document_id.type).toBe('string');
    });
  });

  describe('validateInput()', () => {
    it('should accept valid input with a non-empty document_id string', () => {
      const result = tool.validateInput({ document_id: 'doc-123' });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject null input', () => {
      const result = tool.validateInput(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].reason).toContain('non-null object');
    });

    it('should reject non-object input', () => {
      const result = tool.validateInput('not-an-object');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should reject input missing document_id', () => {
      const result = tool.validateInput({ other_field: 'value' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field_path).toBe('document_id');
      expect(result.errors![0].reason).toContain('missing');
    });

    it('should reject non-string document_id', () => {
      const result = tool.validateInput({ document_id: 123 });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field_path).toBe('document_id');
      expect(result.errors![0].reason).toContain('string');
    });

    it('should reject empty string document_id', () => {
      const result = tool.validateInput({ document_id: '' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field_path).toBe('document_id');
      expect(result.errors![0].reason).toContain('non-empty');
    });

    it('should reject whitespace-only document_id', () => {
      const result = tool.validateInput({ document_id: '   ' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field_path).toBe('document_id');
    });
  });

  describe('execute()', () => {
    it('should return success=true with stub document content', async () => {
      const result = await tool.execute({ document_id: 'doc-abc-123' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Document content for doc-abc-123');
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.error_message).toBeUndefined();
    });

    it('should include the document_id in the output', async () => {
      const result = await tool.execute({ document_id: 'my-special-doc' });

      expect(result.output).toContain('my-special-doc');
    });
  });
});
