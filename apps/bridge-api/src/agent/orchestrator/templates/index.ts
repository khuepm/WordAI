/**
 * AuraSphere Agent Framework — Workflow Template Registry
 *
 * Central registry for predefined workflow templates. Provides lookup
 * by template_id and exports all available templates.
 *
 * Requirements: 3.9, 3.10
 */

import type { WorkflowTemplate } from '../../types';
import { researchThenWrite } from './researchThenWrite';
import { writeThenEdit } from './writeThenEdit';
import { researchWriteEditFormat } from './researchWriteEditFormat';

// Re-export individual templates
export { researchThenWrite } from './researchThenWrite';
export { writeThenEdit } from './writeThenEdit';
export { researchWriteEditFormat } from './researchWriteEditFormat';

/**
 * Registry mapping template_id to its WorkflowTemplate definition.
 */
export const templateRegistry: Map<string, WorkflowTemplate> = new Map([
  [researchThenWrite.template_id, researchThenWrite],
  [writeThenEdit.template_id, writeThenEdit],
  [researchWriteEditFormat.template_id, researchWriteEditFormat],
]);

/**
 * Retrieves a workflow template by its ID.
 *
 * @param id - The template_id to look up
 * @returns The WorkflowTemplate if found, undefined otherwise
 */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return templateRegistry.get(id);
}

/**
 * Returns all registered workflow templates.
 */
export function getAllTemplates(): WorkflowTemplate[] {
  return Array.from(templateRegistry.values());
}
