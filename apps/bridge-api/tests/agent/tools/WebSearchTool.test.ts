/**
 * Unit tests for AuraSphere WebSearchTool
 *
 * Tests cover:
 * - toolId is 'web_search'
 * - getSchema() returns correct ToolDefinition
 * - validateInput() accepts valid input
 * - validateInput() rejects invalid inputs (missing query, non-string, empty string, non-object)
 * - execute() returns stub result with empty results array
 *
 * Requirements: 7.9
 */

import { describe, it, expect } from 'vitest';
import { WebSearchTool } from '../../../src/agent/tools/WebSearchTool';

describe('WebSearchTool', () => {
  const tool = new WebSearchTool();

  describe('toolId', () => {
    it('should be "web_search"', () => {
      expect(tool.toolId).toBe('web_search');
    });
  });

  describe('getSchema()', () => {
    it('should return a ToolDefinition with type "function"', () => {
      const schema = tool.getSchema();
      expect(schema.type).toBe('function');
    });

    it('should have function name "web_search"', () => {
      const schema = tool.getSchema();
      expect(schema.function.name).toBe('web_search');
    });

    it('should have a description about searching the web', () => {
      const schema = tool.getSchema();
      expect(schema.function.description).toContain('Search the web');
    });

    it('should define parameters with required "query" string property', () => {
      const schema = tool.getSchema();
      const params = schema.function.parameters as Record<string, unknown>;

      expect(params.type).toBe('object');
      expect(params.required).toEqual(['query']);
      expect((params.properties as Record<string, unknown>)).toHaveProperty('query');

      const queryProp = (params.properties as Record<string, { type: string }>).query;
      expect(queryProp.type).toBe('string');
    });
  });

  describe('validateInput()', () => {
    it('should accept valid input with a non-empty query string', () => {
      const result = tool.validateInput({ query: 'test search' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject null input', () => {
      const result = tool.validateInput(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject undefined input', () => {
      const result = tool.validateInput(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject non-object input', () => {
      const result = tool.validateInput('just a string');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject input missing the query property', () => {
      const result = tool.validateInput({ other: 'value' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field_path).toBe('query');
    });

    it('should reject input with non-string query', () => {
      const result = tool.validateInput({ query: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field_path).toBe('query');
    });

    it('should reject input with empty string query', () => {
      const result = tool.validateInput({ query: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field_path).toBe('query');
    });

    it('should reject input with whitespace-only query', () => {
      const result = tool.validateInput({ query: '   ' });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field_path).toBe('query');
    });
  });

  describe('execute()', () => {
    it('should return success true with empty results array', async () => {
      const result = await tool.execute({ query: 'hello world' });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ results: [] });
    });

    it('should include execution_time_ms as a non-negative number', async () => {
      const result = await tool.execute({ query: 'test' });

      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should not include error_message on success', async () => {
      const result = await tool.execute({ query: 'test' });

      expect(result.error_message).toBeUndefined();
    });
  });
});
