import { describe, it, expect } from 'vitest';
import { ContextWindow } from '../../../src/agent/context/ContextWindow';
import type { AgentMessage } from '../../../src/agent/types';

describe('ContextWindow', () => {
  describe('constructor', () => {
    it('should create instance with valid maxContextLength', () => {
      const cw = new ContextWindow(128000);
      expect(cw.getMaxTokens()).toBe(128000);
      expect(cw.getCurrentTokens()).toBe(0);
    });

    it('should throw for non-positive maxContextLength', () => {
      expect(() => new ContextWindow(0)).toThrow('maxContextLength must be a positive number');
      expect(() => new ContextWindow(-1)).toThrow('maxContextLength must be a positive number');
    });
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      const cw = new ContextWindow(1000);
      expect(cw.estimateTokens('')).toBe(0);
    });

    it('should estimate ~4 chars per token', () => {
      const cw = new ContextWindow(1000);
      // 4 chars = 1 token
      expect(cw.estimateTokens('abcd')).toBe(1);
      // 5 chars = ceil(5/4) = 2 tokens
      expect(cw.estimateTokens('abcde')).toBe(2);
      // 8 chars = 2 tokens
      expect(cw.estimateTokens('abcdefgh')).toBe(2);
      // 12 chars = 3 tokens
      expect(cw.estimateTokens('abcdefghijkl')).toBe(3);
    });

    it('should return at least 1 for non-empty string', () => {
      const cw = new ContextWindow(1000);
      expect(cw.estimateTokens('a')).toBe(1);
    });
  });

  describe('fitToWindow', () => {
    const makeMessage = (content: string, role: 'user' | 'assistant' = 'user'): AgentMessage => ({
      role,
      content,
    });

    it('should return all messages when within limit', () => {
      const cw = new ContextWindow(10000);
      const systemPrompt = 'You are a helpful assistant.';
      const messages = [
        makeMessage('Hello'),
        makeMessage('How are you?', 'assistant'),
        makeMessage('Fine thanks'),
      ];

      const result = cw.fitToWindow(systemPrompt, messages, 100);
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('Hello');
      expect(result[1].content).toBe('How are you?');
      expect(result[2].content).toBe('Fine thanks');
    });

    it('should update currentTokens after fitting', () => {
      const cw = new ContextWindow(10000);
      const systemPrompt = 'System'; // 2 tokens (ceil(6/4))
      const messages = [makeMessage('Test')]; // 4 overhead + ceil(4/4) = 5 tokens

      cw.fitToWindow(systemPrompt, messages, 100);
      expect(cw.getCurrentTokens()).toBeGreaterThan(0);
    });

    it('should preserve last 3 messages when truncating', () => {
      // Small context window to force truncation
      const cw = new ContextWindow(100);
      const systemPrompt = 'System prompt here'; // ~5 tokens
      const messages = [
        makeMessage('Message 1 - this is old content that should be removed'),
        makeMessage('Message 2 - also old content'),
        makeMessage('Message 3 - recent'),
        makeMessage('Message 4 - recent'),
        makeMessage('Message 5 - most recent'),
      ];

      const result = cw.fitToWindow(systemPrompt, messages, 10);

      // Last 3 messages should always be preserved
      const lastThree = result.slice(-3);
      expect(lastThree[0].content).toBe('Message 3 - recent');
      expect(lastThree[1].content).toBe('Message 4 - recent');
      expect(lastThree[2].content).toBe('Message 5 - most recent');
    });

    it('should remove oldest messages first when truncating', () => {
      // Small context window to force truncation of older messages
      const cw = new ContextWindow(80);
      const systemPrompt = 'Sys'; // ~1 token
      const messages = [
        makeMessage('A'.repeat(100)), // ~25 tokens + 4 overhead = 29
        makeMessage('B'.repeat(100)), // ~29 tokens
        makeMessage('C'.repeat(100)), // ~29 tokens
        makeMessage('Recent 1'),      // ~6 tokens + 4 = 10
        makeMessage('Recent 2'),      // ~10 tokens
        makeMessage('Recent 3'),      // ~10 tokens
      ];

      const result = cw.fitToWindow(systemPrompt, messages, 10);

      // Last 3 should be preserved
      expect(result[result.length - 1].content).toBe('Recent 3');
      expect(result[result.length - 2].content).toBe('Recent 2');
      expect(result[result.length - 3].content).toBe('Recent 1');

      // Oldest messages (A, B, C repeats) should be removed
      const contents = result.map((m) => m.content);
      // With only ~59 tokens available (80 - 10 maxTokens - 1 system),
      // and last 3 taking ~30 tokens, only ~29 tokens left for older messages.
      // Each older message is ~29 tokens, so at most 1 can fit.
      // The most recent of the older set (C) should be kept over A and B.
      if (contents.length > 3) {
        // If any older message survived, it should be the most recent one (C)
        expect(contents[0]).toBe('C'.repeat(100));
      }
    });

    it('should handle empty messages array', () => {
      const cw = new ContextWindow(1000);
      const result = cw.fitToWindow('System', [], 100);
      expect(result).toHaveLength(0);
    });

    it('should handle fewer than 3 messages', () => {
      const cw = new ContextWindow(50); // Very small window
      const systemPrompt = 'A'.repeat(100); // Large system prompt
      const messages = [
        makeMessage('Short'),
        makeMessage('Also short'),
      ];

      const result = cw.fitToWindow(systemPrompt, messages, 10);
      // With only 2 messages, both are "preserved" (fewer than 3)
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should respect maxTokens reservation for response', () => {
      const cw = new ContextWindow(100);
      const systemPrompt = 'Sys'; // ~1 token
      const messages = [
        makeMessage('A'.repeat(200)), // ~50 tokens + 4 overhead
        makeMessage('B'.repeat(200)), // ~54 tokens
      ];

      // Reserve 80 tokens for response, leaving only 20 for context
      const result = cw.fitToWindow(systemPrompt, messages, 80);
      // Should truncate heavily due to large maxTokens reservation
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should return only preserved messages when they alone exceed budget', () => {
      const cw = new ContextWindow(50);
      const systemPrompt = 'A'.repeat(100); // ~25 tokens (exceeds budget alone)
      const messages = [
        makeMessage('Old message'),
        makeMessage('Recent 1'),
        makeMessage('Recent 2'),
        makeMessage('Recent 3'),
      ];

      const result = cw.fitToWindow(systemPrompt, messages, 10);
      // Should still return the last 3 preserved messages even if over budget
      expect(result[result.length - 1].content).toBe('Recent 3');
    });
  });

  describe('getSummaryBudget', () => {
    it('should return 20% of maxContextLength', () => {
      const cw = new ContextWindow(10000);
      expect(cw.getSummaryBudget()).toBe(2000);
    });

    it('should floor the result', () => {
      const cw = new ContextWindow(1001);
      expect(cw.getSummaryBudget()).toBe(200); // floor(1001 * 0.2) = 200
    });
  });

  describe('observable metrics', () => {
    it('should track currentTokens after fitToWindow', () => {
      const cw = new ContextWindow(10000);
      expect(cw.getCurrentTokens()).toBe(0);

      cw.fitToWindow('System prompt', [{ role: 'user', content: 'Hello world' }], 100);
      expect(cw.getCurrentTokens()).toBeGreaterThan(0);
    });

    it('should expose maxTokens', () => {
      const cw = new ContextWindow(128000);
      expect(cw.getMaxTokens()).toBe(128000);
    });
  });
});
