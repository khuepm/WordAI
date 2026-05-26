/**
 * AuraSphere Agent Framework — Write Then Edit Workflow Template
 *
 * A sequential two-step workflow: Writer → Editor.
 * The writer agent produces content, then the editor agent
 * reviews and refines it for grammar, tone, and clarity.
 *
 * Requirements: 3.9, 3.10
 */

import type { WorkflowTemplate } from '../../types';

export const writeThenEdit: WorkflowTemplate = {
  template_id: 'write-then-edit',
  name: 'Write Then Edit',
  description:
    'Sequential workflow where a writer agent produces content, then an editor agent reviews and refines it for grammar, tone, and clarity.',
  steps: [
    {
      step_id: 'step-writer',
      agent_role: 'writer',
      step_type: 'sequential',
      depends_on: [],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-editor',
      agent_role: 'editor',
      step_type: 'sequential',
      depends_on: ['step-writer'],
      failure_policy: 'abort',
    },
  ],
};
