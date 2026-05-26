/**
 * Unit tests for AuraSphere ToolRegistry
 *
 * Tests cover:
 * - register() adds tools to the registry
 * - get() retrieves tools or throws TOOL_NOT_FOUND
 * - has() checks tool existence
 * - list() returns all tool definitions
 * - invoke() access control (TOOL_NOT_ALLOWED)
 * - invoke() input validation (TOOL_INVALID_INPUT)
 * - invoke() timeout enforcement (TOOL_TIMEOUT)
 * - invoke() TOOL_NOT_FOUND for unregistered tools
 * - invoke() successful execution
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import { Tool } from '../../../src/agent/tools/Tool';
import { AgentError } from '../../../src/agent/errors/AgentError';
import { ToolDefinition, ToolResult, ValidationError } from '../../../src/agent/types';

/**
 * Creates a mock tool for testing purposes.
 */
function createMockTool(
  toolId: string,
  options?: {
    executeDelay?: number;
    executeResult?: ToolResult;
    validationResult?: { valid: boolean; errors?: ValidationError[] };
  },
): Tool {
  const schema: ToolDefinition = {
    type: 'function',
    function: {
      name: toolId,
      description: `Mock tool: ${toolId}`,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  };

  const defaultResult: ToolResult = {
    success: true,
    output: { result: `output from ${toolId}` },
    execution_time_ms: 10,
  };

  return {
    toolId,
    getSchema: () => schema,
    validateInput: () =>
      options?.validationResult ?? { valid: true },
    execute: async () => {
      if (options?.executeDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.executeDelay));
      }
      return options?.executeResult ?? defaultResult;
    },
  };
}

describe('ToolRegistry', () => {
  describe('register()', () => {
    it('should add a tool to the registry', () => {
      const registry = new ToolRegistry();
      const tool = createMockTool('test-tool');

      registry.register(tool);

      expect(registry.has('test-tool')).toBe(true);
    });

    it('should replace an existing tool with the same toolId', () => {
      const registry = new ToolRegistry();
      const tool1 = createMockTool('test-tool');
      const tool2 = createMockTool('test-tool');

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.get('test-tool')).toBe(tool2);
    });
  });

  describe('get()', () => {
    it('should return the registered tool', () => {
      const registry = new ToolRegistry();
      const tool = createMockTool('my-tool');
      registry.register(tool);

      const result = registry.get('my-tool');

      expect(result).toBe(tool);
    });

    it('should throw AgentError with TOOL_NOT_FOUND for unregistered tool', () => {
      const registry = new ToolRegistry();

      expect(() => registry.get('nonexistent')).toThrow(AgentError);
      try {
        registry.get('nonexistent');
      } catch (e) {
        expect(e).toBeInstanceOf(AgentError);
        expect((e as AgentError).error_code).toBe('TOOL_NOT_FOUND');
      }
    });
  });

  describe('has()', () => {
    it('should return true for registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(createMockTool('exists'));

      expect(registry.has('exists')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      const registry = new ToolRegistry();

      expect(registry.has('does-not-exist')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return empty array when no tools registered', () => {
      const registry = new ToolRegistry();

      expect(registry.list()).toEqual([]);
    });

    it('should return ToolDefinitions for all registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(createMockTool('tool-a'));
      registry.register(createMockTool('tool-b'));

      const definitions = registry.list();

      expect(definitions).toHaveLength(2);
      expect(definitions[0].function.name).toBe('tool-a');
      expect(definitions[1].function.name).toBe('tool-b');
    });
  });

  describe('invoke()', () => {
    it('should throw TOOL_NOT_FOUND for unregistered tool', async () => {
      const registry = new ToolRegistry();

      await expect(
        registry.invoke('nonexistent', {}, ['nonexistent']),
      ).rejects.toMatchObject({
        error_code: 'TOOL_NOT_FOUND',
      });
    });

    it('should throw TOOL_NOT_ALLOWED when tool is not in allowedTools', async () => {
      const registry = new ToolRegistry();
      registry.register(createMockTool('restricted-tool'));

      await expect(
        registry.invoke('restricted-tool', {}, ['other-tool']),
      ).rejects.toMatchObject({
        error_code: 'TOOL_NOT_ALLOWED',
      });
    });

    it('should throw TOOL_INVALID_INPUT when validation fails', async () => {
      const registry = new ToolRegistry();
      registry.register(
        createMockTool('validated-tool', {
          validationResult: {
            valid: false,
            errors: [{ field_path: 'query', reason: 'required field missing' }],
          },
        }),
      );

      try {
        await registry.invoke('validated-tool', {}, ['validated-tool']);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AgentError);
        expect((e as AgentError).error_code).toBe('TOOL_INVALID_INPUT');
        expect(
          (e as AgentError & { validation_errors?: ValidationError[] }).validation_errors,
        ).toEqual([{ field_path: 'query', reason: 'required field missing' }]);
      }
    });

    it('should throw TOOL_TIMEOUT when execution exceeds 30s', async () => {
      vi.useFakeTimers();

      const registry = new ToolRegistry();
      // Tool that never resolves within timeout
      const slowTool: Tool = {
        toolId: 'slow-tool',
        getSchema: () => ({
          type: 'function',
          function: { name: 'slow-tool', description: 'Slow', parameters: {} },
        }),
        validateInput: () => ({ valid: true }),
        execute: () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          output: 'done',
          execution_time_ms: 35000,
        }), 35000)),
      };
      registry.register(slowTool);

      const invokePromise = registry.invoke('slow-tool', {}, ['slow-tool']);

      // Advance time past the 30s timeout
      vi.advanceTimersByTime(30_001);

      await expect(invokePromise).rejects.toMatchObject({
        error_code: 'TOOL_TIMEOUT',
      });

      vi.useRealTimers();
    });

    it('should return ToolResult on successful execution', async () => {
      const registry = new ToolRegistry();
      const expectedResult: ToolResult = {
        success: true,
        output: { data: 'hello' },
        execution_time_ms: 5,
      };
      registry.register(
        createMockTool('good-tool', { executeResult: expectedResult }),
      );

      const result = await registry.invoke('good-tool', { query: 'test' }, ['good-tool']);

      expect(result).toEqual(expectedResult);
    });

    it('should check access control before validation', async () => {
      const registry = new ToolRegistry();
      // Tool with failing validation — but access control should trigger first
      registry.register(
        createMockTool('blocked-tool', {
          validationResult: { valid: false, errors: [{ field_path: 'x', reason: 'bad' }] },
        }),
      );

      await expect(
        registry.invoke('blocked-tool', {}, ['other-tool']),
      ).rejects.toMatchObject({
        error_code: 'TOOL_NOT_ALLOWED',
      });
    });
  });
});
