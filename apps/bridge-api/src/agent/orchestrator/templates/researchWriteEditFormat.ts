/**
 * AuraSphere Agent Framework — Research Write Edit Format Workflow Template
 *
 * A sequential four-step workflow: Research → Writer → Editor → Formatter.
 * The full content pipeline: gather information, produce content,
 * refine quality, and apply final formatting.
 *
 * Requirements: 3.9, 3.10
 */

import type { WorkflowTemplate } from '../../types';

export const researchWriteEditFormat: WorkflowTemplate = {
  template_id: 'research-write-edit-format',
  name: 'Research Write Edit Format',
  description:
    'Full sequential pipeline: research agent gathers information, writer produces content, editor refines quality, and formatter applies final structural formatting.',
  steps: [
    {
      step_id: 'step-research',
      agent_role: 'research',
      step_type: 'sequential',
      depends_on: [],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-writer',
      agent_role: 'writer',
      step_type: 'sequential',
      depends_on: ['step-research'],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-editor',
      agent_role: 'editor',
      step_type: 'sequential',
      depends_on: ['step-writer'],
      failure_policy: 'abort',
    },
    {
      step_id: 'step-formatter',
      agent_role: 'formatter',
      step_type: 'sequential',
      depends_on: ['step-editor'],
      failure_policy: 'abort',
    },
  ],
};
