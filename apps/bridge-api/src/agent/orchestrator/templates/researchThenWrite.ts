/**
 * AuraSphere Agent Framework — Research Then Write Workflow Template
 *
 * A sequential two-step workflow: Research → Writer.
 * The research agent gathers information, then the writer agent
 * produces content based on the research output.
 *
 * Requirements: 3.9, 3.10
 */

import type { WorkflowTemplate } from '../../types';

export const researchThenWrite: WorkflowTemplate = {
  template_id: 'research-then-write',
  name: 'Research Then Write',
  description:
    'Sequential workflow where a research agent gathers information, then a writer agent produces content based on the research output.',
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
  ],
};
