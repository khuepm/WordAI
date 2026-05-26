import { describe, it, expect } from 'vitest';
import {
  AgentError,
  AgentErrorCode,
  LLMProviderErrorCode,
  isRecoverable,
} from '../../../src/agent/errors/AgentError';

describe('AgentError', () => {
  describe('constructor', () => {
    it('creates an error with all required properties', () => {
      const error = new AgentError(
        'PROVIDER_UNAVAILABLE',
        'Service is down',
        'research-agent',
        'task-123',
        true,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AgentError);
      expect(error.name).toBe('AgentError');
      expect(error.error_code).toBe('PROVIDER_UNAVAILABLE');
      expect(error.message).toBe('Service is down');
      expect(error.agent_id).toBe('research-agent');
      expect(error.task_id).toBe('task-123');
      expect(error.recoverable).toBe(true);
    });

    it('defaults recoverable to false when not specified', () => {
      const error = new AgentError('INVALID_REQUEST', 'Bad input');

      expect(error.recoverable).toBe(false);
      expect(error.agent_id).toBeUndefined();
      expect(error.task_id).toBeUndefined();
    });

    it('preserves the prototype chain for instanceof checks', () => {
      const error = new AgentError('TOOL_NOT_FOUND', 'Tool missing');

      expect(error instanceof AgentError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('includes a stack trace', () => {
      const error = new AgentError('PROVIDER_ERROR', 'Unexpected failure');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AgentError');
    });
  });

  describe('isRecoverable', () => {
    it('classifies PROVIDER_UNAVAILABLE as recoverable', () => {
      expect(isRecoverable('PROVIDER_UNAVAILABLE')).toBe(true);
    });

    it('classifies RATE_LIMITED as recoverable', () => {
      expect(isRecoverable('RATE_LIMITED')).toBe(true);
    });

    it('classifies CONTEXT_TOO_LONG as recoverable', () => {
      expect(isRecoverable('CONTEXT_TOO_LONG')).toBe(true);
    });

    it('classifies INVALID_REQUEST as non-recoverable', () => {
      expect(isRecoverable('INVALID_REQUEST')).toBe(false);
    });

    it('classifies PROVIDER_ERROR as non-recoverable', () => {
      expect(isRecoverable('PROVIDER_ERROR')).toBe(false);
    });

    it('classifies TASK_ROLE_MISMATCH as non-recoverable', () => {
      expect(isRecoverable('TASK_ROLE_MISMATCH')).toBe(false);
    });

    it('classifies AGENT_ID_DUPLICATE as non-recoverable', () => {
      expect(isRecoverable('AGENT_ID_DUPLICATE')).toBe(false);
    });

    it('classifies TOOL_NOT_ALLOWED as non-recoverable', () => {
      expect(isRecoverable('TOOL_NOT_ALLOWED')).toBe(false);
    });

    it('classifies TOOL_NOT_FOUND as non-recoverable', () => {
      expect(isRecoverable('TOOL_NOT_FOUND')).toBe(false);
    });

    it('classifies TOOL_INVALID_INPUT as non-recoverable', () => {
      expect(isRecoverable('TOOL_INVALID_INPUT')).toBe(false);
    });

    it('classifies TOOL_TIMEOUT as non-recoverable', () => {
      expect(isRecoverable('TOOL_TIMEOUT')).toBe(false);
    });

    it('classifies TOOL_NOT_REGISTERED as non-recoverable', () => {
      expect(isRecoverable('TOOL_NOT_REGISTERED')).toBe(false);
    });

    it('classifies PROVIDER_NOT_FOUND as non-recoverable', () => {
      expect(isRecoverable('PROVIDER_NOT_FOUND')).toBe(false);
    });

    it('classifies ALL_PROVIDERS_UNAVAILABLE as non-recoverable', () => {
      expect(isRecoverable('ALL_PROVIDERS_UNAVAILABLE')).toBe(false);
    });

    it('classifies CONTEXT_REDUCTION_FAILED as non-recoverable', () => {
      expect(isRecoverable('CONTEXT_REDUCTION_FAILED')).toBe(false);
    });

    it('classifies AI_QUOTA_EXCEEDED as non-recoverable', () => {
      expect(isRecoverable('AI_QUOTA_EXCEEDED')).toBe(false);
    });

    it('classifies AUTH_REQUIRED as non-recoverable', () => {
      expect(isRecoverable('AUTH_REQUIRED')).toBe(false);
    });
  });

  describe('AgentErrorCode type coverage', () => {
    it('includes all LLM provider error codes', () => {
      const providerCodes: LLMProviderErrorCode[] = [
        'PROVIDER_UNAVAILABLE',
        'RATE_LIMITED',
        'CONTEXT_TOO_LONG',
        'INVALID_REQUEST',
        'PROVIDER_ERROR',
      ];

      // Each provider code should be usable as an AgentErrorCode
      for (const code of providerCodes) {
        const agentCode: AgentErrorCode = code;
        expect(agentCode).toBe(code);
      }
    });
  });
});
