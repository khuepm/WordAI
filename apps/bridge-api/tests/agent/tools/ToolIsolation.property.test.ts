/**
 * Property-based tests for Tool Isolation.
 *
 * Property 9: Tool Isolation
 *   Validates: Requirements 7.5, 7.6
 *
 * Tests that:
 * - Agents can only invoke tools that are in their allowed_tools list
 * - Invoking a tool NOT in allowed_tools throws TOOL_NOT_ALLOWED
 * - Invoking a tool that is not registered at all throws TOOL_NOT_FOUND
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ToolRegistry } from '../../../src/agent/tools/ToolRegistry';
import { Tool } from '../../../src/agent/tools/Tool';
import { AgentError } from '../../../src/agent/errors/AgentError';
import { ToolDefinition, ToolResult, ValidationError } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal mock tool with the given toolId. */
function createMockTool(toolId: string): Tool {
  const schema: ToolDefinition = {
    type: 'function',
    function: {
      name: toolId,
      description: `Mock tool: ${toolId}`,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    },
  };

  const result: ToolResult = {
    success: true,
    output: { data: `result from ${toolId}` },
    execution_time_ms: 1,
  };

  return {
    toolId,
    getSchema: () => schema,
    validateInput: () => ({ valid: true }),
    execute: async () => result,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates valid tool IDs: 1-64 characters, alphanumeric, hyphens, and underscores.
 */
const toolIdArb = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split(''),
    ),
    { minLength: 1, maxLength: 32 },
  )
  .filter((id) => /^[a-z][a-z0-9_-]*$/.test(id));

/**
 * Generates a non-empty set of unique tool IDs representing registered tools,
 * and a non-empty subset representing allowed_tools.
 */
const toolSetsArb = fc
  .uniqueArray(toolIdArb, { minLength: 2, maxLength: 10 })
  .chain((allToolIds) => {
    // Split into allowed (at least 1) and disallowed (at least 1)
    const minAllowed = 1;
    const maxAllowed = allToolIds.length - 1;
    return fc
      .integer({ min: minAllowed, max: maxAllowed })
      .map((allowedCount) => {
        const allowedTools = allToolIds.slice(0, allowedCount);
        const disallowedTools = allToolIds.slice(allowedCount);
        return { allToolIds, allowedTools, disallowedTools };
      });
  });

/**
 * Generates a tool ID that is guaranteed NOT to be in a given set.
 * Used for testing TOOL_NOT_FOUND behavior.
 */
function unregisteredToolIdArb(registeredIds: string[]): fc.Arbitrary<string> {
  return toolIdArb.filter((id) => !registeredIds.includes(id));
}

// ---------------------------------------------------------------------------
// Property 9: Tool Isolation
// Validates: Requirements 7.5, 7.6
// ---------------------------------------------------------------------------

describe('Property 9: Tool Isolation', () => {
  /**
   * **Validates: Requirements 7.5**
   *
   * For any agent with allowed_tools [T1, T2, ...], invoking any tool Ti
   * that IS in allowed_tools SHALL succeed and return a valid ToolResult.
   */
  it('invoking a tool in allowed_tools succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(toolSetsArb, async ({ allToolIds, allowedTools }) => {
        const registry = new ToolRegistry();

        // Register all tools
        for (const toolId of allToolIds) {
          registry.register(createMockTool(toolId));
        }

        // Pick any allowed tool and invoke it
        for (const toolId of allowedTools) {
          const result = await registry.invoke(toolId, { input: 'test' }, allowedTools);
          expect(result.success).toBe(true);
          expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.6**
   *
   * For any agent with allowed_tools [T1, T2, ...], invoking a tool Tx
   * that is registered but NOT in allowed_tools SHALL throw AgentError
   * with code TOOL_NOT_ALLOWED.
   */
  it('invoking a registered tool NOT in allowed_tools throws TOOL_NOT_ALLOWED', async () => {
    await fc.assert(
      fc.asyncProperty(toolSetsArb, async ({ allToolIds, allowedTools, disallowedTools }) => {
        const registry = new ToolRegistry();

        // Register all tools
        for (const toolId of allToolIds) {
          registry.register(createMockTool(toolId));
        }

        // Attempt to invoke each disallowed tool
        for (const toolId of disallowedTools) {
          try {
            await registry.invoke(toolId, { input: 'test' }, allowedTools);
            expect.fail(`Expected TOOL_NOT_ALLOWED for tool '${toolId}'`);
          } catch (err) {
            expect(err).toBeInstanceOf(AgentError);
            expect((err as AgentError).error_code).toBe('TOOL_NOT_ALLOWED');
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.5, 7.6**
   *
   * For any tool_id that is NOT registered in the Tool_Registry, invoking it
   * SHALL throw AgentError with code TOOL_NOT_FOUND regardless of whether
   * it appears in allowed_tools.
   */
  it('invoking an unregistered tool throws TOOL_NOT_FOUND', async () => {
    await fc.assert(
      fc.asyncProperty(
        toolSetsArb,
        toolIdArb,
        async ({ allToolIds, allowedTools }, extraId) => {
          // Ensure extraId is not in the registered set
          fc.pre(!allToolIds.includes(extraId));

          const registry = new ToolRegistry();

          // Register only the known tools
          for (const toolId of allToolIds) {
            registry.register(createMockTool(toolId));
          }

          // Try invoking the unregistered tool (even if it's in allowedTools)
          const allowedWithExtra = [...allowedTools, extraId];
          try {
            await registry.invoke(extraId, { input: 'test' }, allowedWithExtra);
            expect.fail(`Expected TOOL_NOT_FOUND for tool '${extraId}'`);
          } catch (err) {
            expect(err).toBeInstanceOf(AgentError);
            expect((err as AgentError).error_code).toBe('TOOL_NOT_FOUND');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.5, 7.6**
   *
   * Combined isolation property: for any random set of registered tools and
   * any random allowed_tools subset, the invoke behavior is fully determined
   * by membership — allowed tools succeed, disallowed tools are blocked,
   * and unregistered tools are not found.
   */
  it('tool access is fully determined by allowed_tools membership', async () => {
    await fc.assert(
      fc.asyncProperty(
        toolSetsArb,
        toolIdArb,
        async ({ allToolIds, allowedTools, disallowedTools }, unregisteredCandidate) => {
          fc.pre(!allToolIds.includes(unregisteredCandidate));

          const registry = new ToolRegistry();
          for (const toolId of allToolIds) {
            registry.register(createMockTool(toolId));
          }

          // Allowed tool succeeds
          const allowedTool = allowedTools[0];
          const result = await registry.invoke(allowedTool, { input: 'x' }, allowedTools);
          expect(result.success).toBe(true);

          // Disallowed tool is blocked
          const disallowedTool = disallowedTools[0];
          try {
            await registry.invoke(disallowedTool, { input: 'x' }, allowedTools);
            expect.fail('Expected TOOL_NOT_ALLOWED');
          } catch (err) {
            expect((err as AgentError).error_code).toBe('TOOL_NOT_ALLOWED');
          }

          // Unregistered tool is not found
          try {
            await registry.invoke(unregisteredCandidate, { input: 'x' }, [
              ...allowedTools,
              unregisteredCandidate,
            ]);
            expect.fail('Expected TOOL_NOT_FOUND');
          } catch (err) {
            expect((err as AgentError).error_code).toBe('TOOL_NOT_FOUND');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
