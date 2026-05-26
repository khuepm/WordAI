import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../src/agent/errors/CircuitBreaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isHealthy()', () => {
    it('returns true for unknown provider', () => {
      const cb = new CircuitBreaker();
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('returns true when provider has failures below threshold', () => {
      const cb = new CircuitBreaker();
      cb.recordFailure('provider-a');
      cb.recordFailure('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('returns false after 5 consecutive failures within 60s', () => {
      const cb = new CircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);
    });

    it('returns true after cooldown expires (probe allowed)', () => {
      const cb = new CircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);

      // Advance time past cooldown (30s)
      vi.advanceTimersByTime(30_000);
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('returns false during cooldown period', () => {
      const cb = new CircuitBreaker();
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }

      // Advance time but not past cooldown
      vi.advanceTimersByTime(15_000);
      expect(cb.isHealthy('provider-a')).toBe(false);
    });
  });

  describe('recordFailure()', () => {
    it('resets window when first failure is older than windowMs', () => {
      const cb = new CircuitBreaker();

      // Record 4 failures
      for (let i = 0; i < 4; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(true);

      // Advance past the 60s window
      vi.advanceTimersByTime(61_000);

      // This failure starts a new window (count resets to 1)
      cb.recordFailure('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('marks unhealthy after threshold within window', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 10_000, cooldownMs: 5_000 });

      cb.recordFailure('p1');
      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(true);

      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(false);
    });

    it('tracks failures independently per provider', () => {
      const cb = new CircuitBreaker();

      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }

      expect(cb.isHealthy('provider-a')).toBe(false);
      expect(cb.isHealthy('provider-b')).toBe(true);
    });

    it('re-marks unhealthy on probe failure after cooldown', () => {
      const cb = new CircuitBreaker();

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);

      // Wait for cooldown to expire
      vi.advanceTimersByTime(30_000);
      expect(cb.isHealthy('provider-a')).toBe(true);

      // Probe fails — 5 more failures should trip again
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);
    });
  });

  describe('recordSuccess()', () => {
    it('clears failure count and unhealthy state', () => {
      const cb = new CircuitBreaker();

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);

      cb.recordSuccess('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('clears partial failure count', () => {
      const cb = new CircuitBreaker();

      cb.recordFailure('provider-a');
      cb.recordFailure('provider-a');
      cb.recordSuccess('provider-a');

      // Now 5 more failures needed to trip
      for (let i = 0; i < 4; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(true);

      cb.recordFailure('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(false);
    });
  });

  describe('reset()', () => {
    it('clears all state for a provider', () => {
      const cb = new CircuitBreaker();

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(false);

      cb.reset('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(true);

      // Failures start fresh
      for (let i = 0; i < 4; i++) {
        cb.recordFailure('provider-a');
      }
      expect(cb.isHealthy('provider-a')).toBe(true);
    });

    it('does not affect other providers', () => {
      const cb = new CircuitBreaker();

      for (let i = 0; i < 5; i++) {
        cb.recordFailure('provider-a');
        cb.recordFailure('provider-b');
      }

      cb.reset('provider-a');
      expect(cb.isHealthy('provider-a')).toBe(true);
      expect(cb.isHealthy('provider-b')).toBe(false);
    });
  });

  describe('custom configuration', () => {
    it('respects custom failureThreshold', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });

      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(true);

      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(false);
    });

    it('respects custom cooldownMs', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 10_000 });

      cb.recordFailure('p1');
      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(false);

      vi.advanceTimersByTime(9_999);
      expect(cb.isHealthy('p1')).toBe(false);

      vi.advanceTimersByTime(1);
      expect(cb.isHealthy('p1')).toBe(true);
    });

    it('respects custom windowMs', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, windowMs: 5_000 });

      cb.recordFailure('p1');
      cb.recordFailure('p1');

      // Advance past the custom window
      vi.advanceTimersByTime(5_001);

      // This resets the window — only 1 failure in new window
      cb.recordFailure('p1');
      expect(cb.isHealthy('p1')).toBe(true);
    });
  });
});
