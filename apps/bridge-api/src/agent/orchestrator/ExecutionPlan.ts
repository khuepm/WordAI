/**
 * AuraSphere Agent Framework — Execution Plan (DAG)
 *
 * Defines the execution plan structure and provides utilities for:
 * - Validating DAG acyclicity using Kahn's algorithm (topological sort)
 * - Creating execution plans with tier-based timeout configuration
 * - Topological sorting of steps for correct execution order
 *
 * Requirements: 3.1, 3.5
 */

import { randomUUID } from 'crypto';
import type { ExecutionPlan, ExecutionStep } from '../types';

// Re-export types for convenience
export type { ExecutionPlan, ExecutionStep } from '../types';
export type { StepType, FailurePolicy, BranchCondition } from '../types';

/**
 * Maximum execution time per tier in milliseconds.
 * - Turbo: 120 seconds (lightweight, single-agent tasks)
 * - Pro: 300 seconds (complex, multi-agent orchestration)
 */
const MAX_EXECUTION_TIME_MS: Record<'turbo' | 'pro', number> = {
  turbo: 120000,
  pro: 300000,
};

/**
 * Validates that an ExecutionPlan's step graph is a valid DAG (no cycles).
 *
 * Uses Kahn's algorithm (BFS-based topological sort):
 * 1. Build adjacency list and compute in-degree for each step
 * 2. Start with all steps that have in-degree 0 (no dependencies)
 * 3. Process each step by reducing in-degree of its dependents
 * 4. If all steps are processed, the graph is acyclic (valid DAG)
 * 5. If some steps remain unprocessed, a cycle exists (invalid)
 *
 * @param plan - The execution plan to validate
 * @returns true if the plan is a valid DAG, false if a cycle is detected
 */
export function validateDAG(plan: ExecutionPlan): boolean {
  const steps = plan.steps;

  if (steps.length === 0) {
    return true;
  }

  // Build a set of valid step IDs for reference validation
  const stepIds = new Set(steps.map((s) => s.step_id));

  // Build adjacency list (step_id → list of step_ids that depend on it)
  const adjacency = new Map<string, string[]>();
  // In-degree: number of dependencies each step has
  const inDegree = new Map<string, number>();

  // Initialize
  for (const step of steps) {
    adjacency.set(step.step_id, []);
    inDegree.set(step.step_id, 0);
  }

  // Build graph edges from depends_on relationships
  for (const step of steps) {
    for (const dep of step.depends_on) {
      // Only count dependencies that reference valid steps in this plan
      if (stepIds.has(dep)) {
        adjacency.get(dep)!.push(step.step_id);
        inDegree.set(step.step_id, (inDegree.get(step.step_id) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm: start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const [stepId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(stepId);
    }
  }

  let processedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    processedCount++;

    // Reduce in-degree for all dependents of the current step
    const dependents = adjacency.get(current) ?? [];
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // If all steps were processed, no cycle exists
  return processedCount === steps.length;
}

/**
 * Creates a new ExecutionPlan with proper defaults and validation.
 *
 * @param taskId - The task this plan is for
 * @param tier - Performance tier ('turbo' or 'pro')
 * @param steps - Array of execution steps forming the DAG
 * @returns A validated ExecutionPlan
 * @throws Error if the steps contain a cycle (invalid DAG)
 */
export function createExecutionPlan(
  taskId: string,
  tier: 'turbo' | 'pro',
  steps: ExecutionStep[],
): ExecutionPlan {
  const plan: ExecutionPlan = {
    plan_id: randomUUID(),
    task_id: taskId,
    tier,
    steps,
    max_execution_time_ms: MAX_EXECUTION_TIME_MS[tier],
    created_at: new Date().toISOString(),
  };

  if (!validateDAG(plan)) {
    throw new Error(
      `Invalid execution plan: cycle detected in step dependencies for task ${taskId}`,
    );
  }

  return plan;
}

/**
 * Returns the execution steps in topological order (respecting dependencies).
 *
 * Uses Kahn's algorithm to produce a valid execution ordering where
 * each step appears after all of its dependencies.
 *
 * @param plan - The execution plan to sort
 * @returns Steps in valid execution order
 * @throws Error if the plan contains a cycle
 */
export function topologicalSort(plan: ExecutionPlan): ExecutionStep[] {
  const steps = plan.steps;

  if (steps.length === 0) {
    return [];
  }

  const stepMap = new Map<string, ExecutionStep>();
  const stepIds = new Set<string>();
  for (const step of steps) {
    stepMap.set(step.step_id, step);
    stepIds.add(step.step_id);
  }

  // Build adjacency list and in-degree
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const step of steps) {
    adjacency.set(step.step_id, []);
    inDegree.set(step.step_id, 0);
  }

  for (const step of steps) {
    for (const dep of step.depends_on) {
      if (stepIds.has(dep)) {
        adjacency.get(dep)!.push(step.step_id);
        inDegree.set(step.step_id, (inDegree.get(step.step_id) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [stepId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(stepId);
    }
  }

  const sorted: ExecutionStep[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(stepMap.get(current)!);

    const dependents = adjacency.get(current) ?? [];
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  if (sorted.length !== steps.length) {
    throw new Error('Cannot topologically sort: cycle detected in execution plan');
  }

  return sorted;
}
