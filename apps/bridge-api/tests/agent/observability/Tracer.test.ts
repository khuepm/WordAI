import { describe, it, expect, beforeEach } from 'vitest';
import { Tracer, TraceContext } from '../../../src/agent/observability/Tracer';

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  describe('generateTraceId', () => {
    it('returns a valid UUID v4 string', () => {
      const traceId = tracer.generateTraceId();
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(traceId).toMatch(uuidV4Regex);
    });

    it('generates unique IDs on each call', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(tracer.generateTraceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('createSpan', () => {
    it('creates a span with the given trace_id', () => {
      const traceId = tracer.generateTraceId();
      const span = tracer.createSpan(traceId, 'research-agent-execute');
      expect(span.trace_id).toBe(traceId);
    });

    it('generates a unique span_id', () => {
      const traceId = tracer.generateTraceId();
      const span = tracer.createSpan(traceId, 'writer-agent-execute');
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(span.span_id).toMatch(uuidV4Regex);
    });

    it('creates different span_ids for multiple spans in the same trace', () => {
      const traceId = tracer.generateTraceId();
      const span1 = tracer.createSpan(traceId, 'step-1');
      const span2 = tracer.createSpan(traceId, 'step-2');
      expect(span1.span_id).not.toBe(span2.span_id);
      expect(span1.trace_id).toBe(span2.trace_id);
    });

    it('sets parent_span_id when provided', () => {
      const traceId = tracer.generateTraceId();
      const parentSpan = tracer.createSpan(traceId, 'parent');
      const childSpan = tracer.createSpan(
        traceId,
        'child',
        parentSpan.span_id,
      );
      expect(childSpan.parent_span_id).toBe(parentSpan.span_id);
      expect(childSpan.trace_id).toBe(traceId);
    });

    it('leaves parent_span_id undefined when not provided', () => {
      const traceId = tracer.generateTraceId();
      const span = tracer.createSpan(traceId, 'root-span');
      expect(span.parent_span_id).toBeUndefined();
    });
  });

  describe('createRootSpan', () => {
    it('creates a TraceContext with a new trace_id and span_id', () => {
      const root = tracer.createRootSpan('request-handler');
      expect(root.trace_id).toBeDefined();
      expect(root.span_id).toBeDefined();
      expect(root.parent_span_id).toBeUndefined();
    });

    it('generates unique trace_ids for each root span', () => {
      const root1 = tracer.createRootSpan('request-1');
      const root2 = tracer.createRootSpan('request-2');
      expect(root1.trace_id).not.toBe(root2.trace_id);
    });
  });

  describe('getTraceId', () => {
    it('extracts trace_id from a TraceContext', () => {
      const traceId = tracer.generateTraceId();
      const context: TraceContext = {
        trace_id: traceId,
        span_id: tracer.generateTraceId(),
      };
      expect(tracer.getTraceId(context)).toBe(traceId);
    });
  });

  describe('trace propagation flow', () => {
    it('supports full propagation chain: root → child → grandchild', () => {
      // Simulate Bridge_API request → Orchestrator → Agent
      const root = tracer.createRootSpan('bridge-api-request');

      const orchestratorSpan = tracer.createSpan(
        root.trace_id,
        'orchestrator-execute',
        root.span_id,
      );

      const agentSpan = tracer.createSpan(
        root.trace_id,
        'research-agent',
        orchestratorSpan.span_id,
      );

      // All share the same trace_id
      expect(root.trace_id).toBe(orchestratorSpan.trace_id);
      expect(root.trace_id).toBe(agentSpan.trace_id);

      // Parent chain is correct
      expect(orchestratorSpan.parent_span_id).toBe(root.span_id);
      expect(agentSpan.parent_span_id).toBe(orchestratorSpan.span_id);

      // All span_ids are unique
      const spanIds = [root.span_id, orchestratorSpan.span_id, agentSpan.span_id];
      expect(new Set(spanIds).size).toBe(3);
    });
  });
});
