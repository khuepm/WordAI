/**
 * Property-based tests for DAG Acyclicity.
 *
 * Property 1: DAG Acyclicity
 *   Validates: Requirements 3.5
 *
 * Verifies that:
 * - Every generated valid DAG (acyclic graph) passes validateDAG
 * - Every generated graph with intentional cycles fails validateDAG
 * - createExecutionPlan throws for cyclic graphs
 * - topologicalSort succeeds for valid DAGs and returns all steps
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateDAG,
  createExecutionPlan,
  topologicalSort,
} from '../../../src/agent/orchestrator/ExecutionPlan';
import type { ExecutionPlan, ExecutionStep } from '../../../src/agent/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const agentRoles = ['research', 'writer', 'editor', 'formatter'] as const;
const stepTypes = ['sequential', 'parallel', 'conditional'] as const;
const failurePolicies = ['retry', 'skip', 'abort'] as const;

/**
 * Generates a valid DAG of ExecutionSteps.
 *
 * Strategy: generate steps in order where each step can only depend on
 * previously generated steps (lower index). This guarantees acyclicity
 * by construction — a step at index i can only reference steps 0..i-1.
 */
const validDAGArb: fc.Arbitrary<ExecutionStep[]> = fc
  .integer({ min: 1, max: 10 })
  .chain((numSteps) =>
    fc.tuple(
      ...Array.from({ length: numSteps }, (_, i) =>
        fc.record({
          step_id: fc.constant(`step-${i}`),
          agent_role: fc.constantFrom(...agentRoles),
          step_type: fc.constantFrom(...stepTypes),
          depends_on: i === 0
            ? fc.constant([] as string[])
            : fc.subarray(
                Array.from({ length: i }, (_, j) => `step-${j}`),
                { minLength: 0 },
              ),
          failure_policy: fc.constantFrom(...failurePolicies),
        }),
      ),
    ),
  )
  .map((steps) =>
    steps.map((s) => ({
      ...s,
      agent_role: s.agent_role as ExecutionStep['agent_role'],
      step_type: s.step_type as ExecutionStep['step_type'],
      failure_policy: s.failure_policy as ExecutionStep['failure_policy'],
    })),
  );

/**
 * Generates a graph with at least one intentional cycle.
 *
 * Strategy: create a guaranteed cycle by making a chain where the last step
 * depends on the first step, and the first step depends on the last step
 * (mutual dependency). More specifically, we create steps where:
 * - step-0 depends on step-(n-1)
 * - step-1 depends on step-0
 * - step-2 depends on step-1
 * - ...
 * - step-(n-1) depends on step-(n-2)
 * This forms a complete cycle: 0 → (n-1) → (n-2) → ... → 1 → 0
 */
const cyclicGraphArb: fc.Arbitrary<ExecutionStep[]> = fc
  .integer({ min: 2, max: 8 })
  .chain((numSteps) =>
    fc.tuple(
      fc.constantFrom(...agentRoles),
      fc.constantFrom(...stepTypes),
      fc.constantFrom(...failurePolicies),
    ).map(([role, stepType, policy]) => {
      // Create a cycle: each step depends on the previous one,
      // and step-0 depends on the last step (closing the cycle)
      const steps: ExecutionStep[] = Array.from({ length: numSteps }, (_, i) => ({
        step_id: `step-${i}`,
        agent_role: role as ExecutionStep['agent_role'],
        step_type: stepType as ExecutionStep['step_type'],
        depends_on: i === 0
          ? [`step-${numSteps - 1}`] // step-0 depends on last step (creates cycle)
          : [`step-${i - 1}`],       // each step depends on previous
        failure_policy: policy as ExecutionStep['failure_policy'],
      }));
      return steps;
    }),
  );

/**
 * Wraps steps into an ExecutionPlan structure.
 */
function makePlan(steps: ExecutionStep[]): ExecutionPlan {
  return {
    plan_id: 'test-plan-id',
    task_id: 'test-task-id',
    tier: 'turbo',
    steps,
    max_execution_time_ms: 120000,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Property 1: DAG Acyclicity
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------

describe('Property 1: DAG Acyclicity', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated valid DAG (steps where depends_on only references
   * earlier steps), validateDAG SHALL return true.
   */
  it('validateDAG returns true for all generated valid DAGs', () => {
    fc.assert(
      fc.property(validDAGArb, (steps) => {
        const plan = makePlan(steps);
        expect(validateDAG(plan)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated graph with an intentional cycle, validateDAG
   * SHALL return false.
   */
  it('validateDAG returns false for graphs with cycles', () => {
    fc.assert(
      fc.property(cyclicGraphArb, (steps) => {
        const plan = makePlan(steps);
        expect(validateDAG(plan)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated graph with a cycle, createExecutionPlan SHALL throw
   * an error indicating a cycle was detected.
   */
  it('createExecutionPlan throws for cyclic graphs', () => {
    fc.assert(
      fc.property(cyclicGraphArb, (steps) => {
        expect(() => createExecutionPlan('test-task', 'turbo', steps)).toThrow(
          /cycle detected/i,
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated valid DAG, topologicalSort SHALL succeed and return
   * all steps (same count as input), with each step appearing after all
   * of its dependencies.
   */
  it('topologicalSort succeeds for valid DAGs and returns all steps in valid order', () => {
    fc.assert(
      fc.property(validDAGArb, (steps) => {
        const plan = makePlan(steps);
        const sorted = topologicalSort(plan);

        // All steps are present
        expect(sorted.length).toBe(steps.length);

        // Build position map for ordering verification
        const positionMap = new Map<string, number>();
        sorted.forEach((step, idx) => positionMap.set(step.step_id, idx));

        // Every step appears after all its dependencies
        for (const step of sorted) {
          for (const dep of step.depends_on) {
            const depPos = positionMap.get(dep);
            const stepPos = positionMap.get(step.step_id)!;
            // Dependency must appear before the step
            if (depPos !== undefined) {
              expect(depPos).toBeLessThan(stepPos);
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated graph with a cycle, topologicalSort SHALL throw
   * an error indicating a cycle was detected.
   */
  it('topologicalSort throws for cyclic graphs', () => {
    fc.assert(
      fc.property(cyclicGraphArb, (steps) => {
        const plan = makePlan(steps);
        expect(() => topologicalSort(plan)).toThrow(/cycle detected/i);
      }),
      { numRuns: 200 },
    );
  });
});
