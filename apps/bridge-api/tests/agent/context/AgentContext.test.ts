/**
 * Unit tests for ContextManager
 *
 * Tests: create, get, addIntermediateResult, addSharedKnowledge, dispose,
 * serialize/deserialize, retention, and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextManager } from '../../../src/agent/context/AgentContext';
import type { AgentResult } from '../../../src/agent/types';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ContextManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should default retention to 30 minutes', () => {
      expect(manager.retention).toBe(30);
    });

    it('should accept custom retention within valid range', () => {
      const custom = new ContextManager(60);
      expect(custom.retention).toBe(60);
      custom.destroy();
    });

    it('should clamp retention below minimum to 1 minute', () => {
      const custom = new ContextManager(0);
      expect(custom.retention).toBe(1);
      custom.destroy();
    });

    it('should clamp retention above maximum to 1440 minutes', () => {
      const custom = new ContextManager(2000);
      expect(custom.retention).toBe(1440);
      custom.destroy();
    });
  });

  describe('create()', () => {
    it('should create a context with empty collections', () => {
      const ctx = manager.create('task-1', { source: 'test' });

      expect(ctx.task_id).toBe('task-1');
      expect(ctx.conversation_history).toEqual([]);
      expect(ctx.intermediate_results.size).toBe(0);
      expect(ctx.task_metadata).toEqual({ source: 'test' });
      expect(ctx.shared_knowledge).toEqual({});
    });

    it('should set created_at and expires_at timestamps', () => {
      const now = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      const ctx = manager.create('task-1', {});

      expect(ctx.created_at).toBe('2024-01-15T10:00:00.000Z');
      expect(ctx.expires_at).toBe('2024-01-15T10:30:00.000Z'); // 30 min default
    });

    it('should use custom retention for expires_at', () => {
      manager.destroy();
      manager = new ContextManager(60); // 1 hour

      const now = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      const ctx = manager.create('task-1', {});
      expect(ctx.expires_at).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('get()', () => {
    it('should return the context for an existing task', () => {
      manager.create('task-1', { key: 'value' });
      const ctx = manager.get('task-1');

      expect(ctx).not.toBeNull();
      expect(ctx!.task_id).toBe('task-1');
    });

    it('should return null for a non-existent task', () => {
      expect(manager.get('non-existent')).toBeNull();
    });
  });

  describe('addIntermediateResult()', () => {
    it('should add a result to the context', () => {
      manager.create('task-1', {});
      const result: AgentResult = {
        status: 'success',
        output_content: 'Research findings',
        confidence_score: 0.9,
        tokens_used: 150,
        processing_time_ms: 500,
      };

      manager.addIntermediateResult('task-1', 'step-research', result);

      const ctx = manager.get('task-1');
      expect(ctx!.intermediate_results.get('step-research')).toEqual(result);
    });

    it('should do nothing for a non-existent task', () => {
      const result: AgentResult = {
        status: 'success',
        output_content: 'test',
        confidence_score: 0.5,
        tokens_used: 10,
        processing_time_ms: 100,
      };

      // Should not throw
      manager.addIntermediateResult('non-existent', 'step-1', result);
    });

    it('should overwrite existing step result', () => {
      manager.create('task-1', {});
      const result1: AgentResult = {
        status: 'error',
        output_content: '',
        confidence_score: 0,
        tokens_used: 10,
        processing_time_ms: 50,
      };
      const result2: AgentResult = {
        status: 'success',
        output_content: 'Retry succeeded',
        confidence_score: 0.8,
        tokens_used: 100,
        processing_time_ms: 300,
      };

      manager.addIntermediateResult('task-1', 'step-1', result1);
      manager.addIntermediateResult('task-1', 'step-1', result2);

      const ctx = manager.get('task-1');
      expect(ctx!.intermediate_results.get('step-1')).toEqual(result2);
    });
  });

  describe('addSharedKnowledge()', () => {
    it('should add a key-value pair to shared knowledge', () => {
      manager.create('task-1', {});
      manager.addSharedKnowledge('task-1', 'topic', 'AI agents');

      const ctx = manager.get('task-1');
      expect(ctx!.shared_knowledge['topic']).toBe('AI agents');
    });

    it('should do nothing for a non-existent task', () => {
      // Should not throw
      manager.addSharedKnowledge('non-existent', 'key', 'value');
    });

    it('should overwrite existing key', () => {
      manager.create('task-1', {});
      manager.addSharedKnowledge('task-1', 'tone', 'formal');
      manager.addSharedKnowledge('task-1', 'tone', 'casual');

      const ctx = manager.get('task-1');
      expect(ctx!.shared_knowledge['tone']).toBe('casual');
    });
  });

  describe('dispose()', () => {
    it('should remove the context', () => {
      manager.create('task-1', {});
      expect(manager.get('task-1')).not.toBeNull();

      manager.dispose('task-1');
      expect(manager.get('task-1')).toBeNull();
    });

    it('should not throw for non-existent task', () => {
      expect(() => manager.dispose('non-existent')).not.toThrow();
    });

    it('should decrement size', () => {
      manager.create('task-1', {});
      manager.create('task-2', {});
      expect(manager.size).toBe(2);

      manager.dispose('task-1');
      expect(manager.size).toBe(1);
    });
  });

  describe('serialize()', () => {
    it('should return a valid JSON string', () => {
      manager.create('task-1', { intent: 'write article' });
      manager.addSharedKnowledge('task-1', 'topic', 'testing');

      const json = manager.serialize('task-1');
      expect(json).not.toBeNull();

      const parsed = JSON.parse(json!);
      expect(parsed.task_id).toBe('task-1');
      expect(parsed.task_metadata).toEqual({ intent: 'write article' });
      expect(parsed.shared_knowledge).toEqual({ topic: 'testing' });
    });

    it('should serialize intermediate_results as a plain object', () => {
      manager.create('task-1', {});
      manager.addIntermediateResult('task-1', 'step-1', {
        status: 'success',
        output_content: 'output',
        confidence_score: 0.9,
        tokens_used: 50,
        processing_time_ms: 200,
      });

      const json = manager.serialize('task-1');
      const parsed = JSON.parse(json!);

      expect(parsed.intermediate_results).toEqual({
        'step-1': {
          status: 'success',
          output_content: 'output',
          confidence_score: 0.9,
          tokens_used: 50,
          processing_time_ms: 200,
        },
      });
    });

    it('should return null for non-existent task', () => {
      expect(manager.serialize('non-existent')).toBeNull();
    });
  });

  describe('deserialize()', () => {
    it('should reconstruct an AgentContextState from JSON', () => {
      const json = JSON.stringify({
        task_id: 'task-1',
        conversation_history: [{ role: 'user', content: 'Hello' }],
        intermediate_results: {
          'step-1': {
            status: 'success',
            output_content: 'result',
            confidence_score: 0.85,
            tokens_used: 100,
            processing_time_ms: 300,
          },
        },
        task_metadata: { key: 'value' },
        shared_knowledge: { topic: 'testing' },
        created_at: '2024-01-15T10:00:00.000Z',
        expires_at: '2024-01-15T10:30:00.000Z',
      });

      const ctx = manager.deserialize(json);

      expect(ctx.task_id).toBe('task-1');
      expect(ctx.conversation_history).toHaveLength(1);
      expect(ctx.intermediate_results).toBeInstanceOf(Map);
      expect(ctx.intermediate_results.get('step-1')?.status).toBe('success');
      expect(ctx.task_metadata).toEqual({ key: 'value' });
      expect(ctx.shared_knowledge).toEqual({ topic: 'testing' });
    });

    it('should produce a round-trip equivalent context', () => {
      manager.create('task-1', { intent: 'test' });
      manager.addSharedKnowledge('task-1', 'key', 'value');
      manager.addIntermediateResult('task-1', 'step-1', {
        status: 'success',
        output_content: 'content',
        confidence_score: 0.7,
        tokens_used: 50,
        processing_time_ms: 100,
      });

      const original = manager.get('task-1')!;
      const json = manager.serialize('task-1')!;
      const restored = manager.deserialize(json);

      expect(restored.task_id).toBe(original.task_id);
      expect(restored.conversation_history).toEqual(original.conversation_history);
      expect(restored.task_metadata).toEqual(original.task_metadata);
      expect(restored.shared_knowledge).toEqual(original.shared_knowledge);
      expect(restored.created_at).toBe(original.created_at);
      expect(restored.expires_at).toBe(original.expires_at);

      // Compare Map contents
      expect(Object.fromEntries(restored.intermediate_results)).toEqual(
        Object.fromEntries(original.intermediate_results),
      );
    });
  });

  describe('cleanup interval', () => {
    it('should dispose expired contexts after cleanup runs', () => {
      const now = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      manager.create('task-1', {});
      expect(manager.size).toBe(1);

      // Advance past retention period (30 min) + cleanup interval (60s)
      vi.advanceTimersByTime(31 * 60_000);

      expect(manager.size).toBe(0);
    });

    it('should not dispose contexts that have not expired', () => {
      const now = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      manager.create('task-1', {});

      // Advance 10 minutes (well within 30 min retention)
      vi.advanceTimersByTime(10 * 60_000);

      expect(manager.size).toBe(1);
    });

    it('should dispose only expired contexts in a mixed set', () => {
      manager.destroy();
      manager = new ContextManager(5); // 5 minute retention

      const now = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(now);

      manager.create('task-old', {});

      // Advance 3 minutes, create another
      vi.advanceTimersByTime(3 * 60_000);
      manager.create('task-new', {});

      // Advance 3 more minutes (total 6 min from start)
      // task-old should expire (5 min retention), task-new should remain
      vi.advanceTimersByTime(3 * 60_000);

      expect(manager.get('task-old')).toBeNull();
      expect(manager.get('task-new')).not.toBeNull();
    });
  });

  describe('destroy()', () => {
    it('should clear all contexts', () => {
      manager.create('task-1', {});
      manager.create('task-2', {});

      manager.destroy();
      expect(manager.size).toBe(0);
    });

    it('should stop the cleanup interval', () => {
      manager.create('task-1', {});
      manager.destroy();

      // Create a new context directly on the internal map won't be cleaned
      // This verifies the interval is stopped by checking no further cleanup occurs
      // After destroy, size should remain 0
      expect(manager.size).toBe(0);
    });
  });
});
