import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../../src/agent/observability/Metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('incrementCounter', () => {
    it('creates a counter at 1 on first increment', () => {
      collector.incrementCounter('provider_request_count', {
        provider_id: 'mock',
        status: 'success',
      });
      const snapshot = collector.getSnapshot();
      expect(
        snapshot.counters['provider_request_count{provider_id=mock,status=success}'],
      ).toBe(1);
    });

    it('increments an existing counter', () => {
      collector.incrementCounter('tier_routing_decisions', {
        assigned_tier: 'turbo',
        reasoning: 'low_complexity',
      });
      collector.incrementCounter('tier_routing_decisions', {
        assigned_tier: 'turbo',
        reasoning: 'low_complexity',
      });
      collector.incrementCounter('tier_routing_decisions', {
        assigned_tier: 'turbo',
        reasoning: 'low_complexity',
      });
      const snapshot = collector.getSnapshot();
      expect(
        snapshot.counters[
          'tier_routing_decisions{assigned_tier=turbo,reasoning=low_complexity}'
        ],
      ).toBe(3);
    });

    it('tracks separate counters for different labels', () => {
      collector.incrementCounter('agent_token_usage', {
        agent_role: 'writer',
        tier: 'pro',
      });
      collector.incrementCounter('agent_token_usage', {
        agent_role: 'editor',
        tier: 'turbo',
      });
      const snapshot = collector.getSnapshot();
      expect(
        snapshot.counters['agent_token_usage{agent_role=writer,tier=pro}'],
      ).toBe(1);
      expect(
        snapshot.counters['agent_token_usage{agent_role=editor,tier=turbo}'],
      ).toBe(1);
    });

    it('works with no labels', () => {
      collector.incrementCounter('simple_counter');
      collector.incrementCounter('simple_counter');
      const snapshot = collector.getSnapshot();
      expect(snapshot.counters['simple_counter']).toBe(2);
    });

    it('sorts labels alphabetically for consistent keys', () => {
      collector.incrementCounter('test', { z: '1', a: '2' });
      collector.incrementCounter('test', { a: '2', z: '1' });
      const snapshot = collector.getSnapshot();
      expect(snapshot.counters['test{a=2,z=1}']).toBe(2);
    });
  });

  describe('recordHistogram', () => {
    it('records a single value', () => {
      collector.recordHistogram('agent_execution_duration_ms', 150, {
        agent_role: 'research',
        tier: 'pro',
      });
      const snapshot = collector.getSnapshot();
      const hist =
        snapshot.histograms[
          'agent_execution_duration_ms{agent_role=research,tier=pro}'
        ];
      expect(hist).toEqual({
        count: 1,
        sum: 150,
        min: 150,
        max: 150,
        avg: 150,
      });
    });

    it('computes correct summary for multiple values', () => {
      collector.recordHistogram('orchestration_plan_duration_ms', 100, {
        template_id: 'research-then-write',
      });
      collector.recordHistogram('orchestration_plan_duration_ms', 200, {
        template_id: 'research-then-write',
      });
      collector.recordHistogram('orchestration_plan_duration_ms', 300, {
        template_id: 'research-then-write',
      });
      const snapshot = collector.getSnapshot();
      const hist =
        snapshot.histograms[
          'orchestration_plan_duration_ms{template_id=research-then-write}'
        ];
      expect(hist).toEqual({
        count: 3,
        sum: 600,
        min: 100,
        max: 300,
        avg: 200,
      });
    });

    it('tracks separate histograms for different labels', () => {
      collector.recordHistogram('agent_execution_duration_ms', 50, {
        agent_role: 'formatter',
        tier: 'turbo',
      });
      collector.recordHistogram('agent_execution_duration_ms', 500, {
        agent_role: 'writer',
        tier: 'pro',
      });
      const snapshot = collector.getSnapshot();
      expect(
        snapshot.histograms[
          'agent_execution_duration_ms{agent_role=formatter,tier=turbo}'
        ].avg,
      ).toBe(50);
      expect(
        snapshot.histograms[
          'agent_execution_duration_ms{agent_role=writer,tier=pro}'
        ].avg,
      ).toBe(500);
    });
  });

  describe('getSnapshot', () => {
    it('returns empty snapshot when no metrics recorded', () => {
      const snapshot = collector.getSnapshot();
      expect(snapshot.counters).toEqual({});
      expect(snapshot.histograms).toEqual({});
      expect(snapshot.timestamp).toBeDefined();
    });

    it('includes a valid ISO 8601 timestamp', () => {
      const snapshot = collector.getSnapshot();
      const parsed = new Date(snapshot.timestamp);
      expect(parsed.toISOString()).toBe(snapshot.timestamp);
    });

    it('returns a snapshot that does not mutate when collector changes', () => {
      collector.incrementCounter('test_counter', { label: 'a' });
      const snapshot = collector.getSnapshot();
      collector.incrementCounter('test_counter', { label: 'a' });
      // Snapshot should still show 1
      expect(snapshot.counters['test_counter{label=a}']).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all counters and histograms', () => {
      collector.incrementCounter('c1', { x: '1' });
      collector.recordHistogram('h1', 42, { y: '2' });
      collector.reset();
      const snapshot = collector.getSnapshot();
      expect(snapshot.counters).toEqual({});
      expect(snapshot.histograms).toEqual({});
    });
  });
});
