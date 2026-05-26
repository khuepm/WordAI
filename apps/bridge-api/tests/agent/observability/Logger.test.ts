/**
 * Unit tests for AgentLogger
 *
 * Tests cover:
 * - logAgentInvocation() emits structured metadata
 * - logPlanSummary() emits aggregated metrics
 * - Development mode includes prompt/response content
 * - Production mode excludes prompt/response content
 * - Degraded statuses use warn log level
 * - Logging is non-blocking (fire-and-forget via setImmediate)
 * - Log emission failures do not throw
 *
 * Requirements: 10.1, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentLogger, AgentInvocationLogData, PlanSummaryLogData } from '../../../src/agent/observability/Logger';

// Mock the winston logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();

vi.mock('../../../src/utils/logger', () => ({
  default: {
    info: (...args: unknown[]) => mockInfo(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}));

describe('AgentLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to flush setImmediate callbacks
  function flushImmediate(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  describe('logAgentInvocation', () => {
    const baseInvocationData: AgentInvocationLogData = {
      task_id: 'task-123',
      agent_id: 'research-agent',
      tier: 'pro',
      provider_id: 'mock',
      tokens_used: 150,
      execution_time_ms: 320,
      status: 'success',
      trace_id: 'trace-abc-123',
    };

    it('should log structured metadata for successful invocations', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation(baseInvocationData);

      await flushImmediate();

      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockInfo).toHaveBeenCalledWith(
        'Agent invocation completed',
        expect.objectContaining({
          event: 'agent_invocation',
          task_id: 'task-123',
          agent_id: 'research-agent',
          tier: 'pro',
          provider_id: 'mock',
          tokens_used: 150,
          execution_time_ms: 320,
          status: 'success',
          trace_id: 'trace-abc-123',
        })
      );
    });

    it('should include prompt and response in development mode', async () => {
      const agentLogger = new AgentLogger('development');
      const dataWithContent: AgentInvocationLogData = {
        ...baseInvocationData,
        prompt: 'Write a poem about cats',
        response: 'Cats are fluffy creatures...',
      };

      agentLogger.logAgentInvocation(dataWithContent);

      await flushImmediate();

      expect(mockInfo).toHaveBeenCalledWith(
        'Agent invocation completed',
        expect.objectContaining({
          prompt: 'Write a poem about cats',
          response: 'Cats are fluffy creatures...',
        })
      );
    });

    it('should NOT include prompt and response in production mode', async () => {
      const agentLogger = new AgentLogger('production');
      const dataWithContent: AgentInvocationLogData = {
        ...baseInvocationData,
        prompt: 'Write a poem about cats',
        response: 'Cats are fluffy creatures...',
      };

      agentLogger.logAgentInvocation(dataWithContent);

      await flushImmediate();

      const loggedMetadata = mockInfo.mock.calls[0][1];
      expect(loggedMetadata).not.toHaveProperty('prompt');
      expect(loggedMetadata).not.toHaveProperty('response');
    });

    it('should use warn level for error status', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation({ ...baseInvocationData, status: 'error' });

      await flushImmediate();

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockWarn).toHaveBeenCalledWith(
        'Agent invocation completed with degraded status',
        expect.objectContaining({ status: 'error' })
      );
    });

    it('should use warn level for partial status', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation({ ...baseInvocationData, status: 'partial' });

      await flushImmediate();

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockInfo).not.toHaveBeenCalled();
    });

    it('should use warn level for max_iterations_reached status', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation({ ...baseInvocationData, status: 'max_iterations_reached' });

      await flushImmediate();

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockInfo).not.toHaveBeenCalled();
    });

    it('should be non-blocking (does not log synchronously)', () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation(baseInvocationData);

      // Synchronously, nothing should have been logged yet
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('should not throw when logger fails', async () => {
      mockInfo.mockImplementation(() => {
        throw new Error('Logger transport failure');
      });

      const agentLogger = new AgentLogger('production');

      // Should not throw
      expect(() => agentLogger.logAgentInvocation(baseInvocationData)).not.toThrow();

      await flushImmediate();

      // The error was swallowed; execution continued (mockInfo was called but threw)
      expect(mockInfo).toHaveBeenCalled();
    });

    it('should include trace_id for distributed tracing', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logAgentInvocation(baseInvocationData);

      await flushImmediate();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ trace_id: 'trace-abc-123' })
      );
    });
  });

  describe('logPlanSummary', () => {
    const baseSummaryData: PlanSummaryLogData = {
      task_id: 'task-456',
      total_agents_invoked: 3,
      total_tokens_used: 450,
      total_execution_time_ms: 1200,
      final_status: 'success',
      trace_id: 'trace-def-456',
    };

    it('should log structured plan summary for successful plans', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logPlanSummary(baseSummaryData);

      await flushImmediate();

      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockInfo).toHaveBeenCalledWith(
        'Execution plan completed',
        expect.objectContaining({
          event: 'plan_summary',
          task_id: 'task-456',
          total_agents_invoked: 3,
          total_tokens_used: 450,
          total_execution_time_ms: 1200,
          final_status: 'success',
          trace_id: 'trace-def-456',
        })
      );
    });

    it('should use warn level for non-success final status', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logPlanSummary({ ...baseSummaryData, final_status: 'timeout_exceeded' });

      await flushImmediate();

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockWarn).toHaveBeenCalledWith(
        'Execution plan completed with non-success status',
        expect.objectContaining({ final_status: 'timeout_exceeded' })
      );
    });

    it('should use warn level for aborted plans', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logPlanSummary({ ...baseSummaryData, final_status: 'aborted' });

      await flushImmediate();

      expect(mockWarn).toHaveBeenCalledTimes(1);
    });

    it('should be non-blocking (does not log synchronously)', () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logPlanSummary(baseSummaryData);

      // Synchronously, nothing should have been logged yet
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('should not throw when logger fails', async () => {
      mockInfo.mockImplementation(() => {
        throw new Error('Logger transport failure');
      });

      const agentLogger = new AgentLogger('production');

      // Should not throw
      expect(() => agentLogger.logPlanSummary(baseSummaryData)).not.toThrow();

      await flushImmediate();

      // The error was swallowed; execution continued (mockInfo was called but threw)
      expect(mockInfo).toHaveBeenCalled();
    });

    it('should include trace_id for distributed tracing', async () => {
      const agentLogger = new AgentLogger('production');
      agentLogger.logPlanSummary(baseSummaryData);

      await flushImmediate();

      expect(mockInfo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ trace_id: 'trace-def-456' })
      );
    });
  });
});
