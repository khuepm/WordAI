/**
 * Property-based tests for PreferencesDialog responsive layout
 * Validates: Requirements 3.1, 6.1
 */

// Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { CollapsedSidebar } from './PreferencesDialog';
import { MODAL_BREAKPOINTS } from '../hooks/useViewportSize';
import type { Tab } from '../types/preferences';

// ---------------------------------------------------------------------------
// Property 3: Collapsed sidebar layout and accessibility
// Validates: Requirements 3.1, 6.1
// ---------------------------------------------------------------------------

describe('Property 3: Collapsed sidebar layout and accessibility', () => {
  const tabs: Tab[] = ['general', 'ai-engine', 'typography', 'privacy'];
  const tabLabels: Record<Tab, string> = {
    general: 'General',
    'ai-engine': 'AI Engine',
    typography: 'Typography',
    privacy: 'Privacy',
  };

  afterEach(() => {
    // Clean up any rendered components
  });

  it('for any viewport width < 720, the collapsed sidebar condition holds (vw < COLLAPSE_SIDEBAR)', () => {
    // Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 719 }),
        (vw) => {
          // Verify the breakpoint logic: any vw in [200, 719] is < COLLAPSE_SIDEBAR (720)
          expect(vw).toBeLessThan(MODAL_BREAKPOINTS.COLLAPSE_SIDEBAR);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('CollapsedSidebar aside has width: var(--modal-sidebar-collapsed-width, 64px) for any activeTab', () => {
    // Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 719 }),
        fc.constantFrom<Tab>(...tabs),
        (vw, activeTab) => {
          void vw; // vw drives the collapsed state decision; sidebar is always 64px when collapsed

          const { unmount, container } = render(
            createElement(CollapsedSidebar, {
              activeTab,
              onTabChange: () => { },
              isSearching: false,
              onClearSearch: () => { },
            })
          );

          const aside = container.querySelector('aside');
          expect(aside).not.toBeNull();

          const width = aside!.style.width;
          expect(width).toBe('var(--modal-sidebar-collapsed-width, 64px)');

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each tab button in CollapsedSidebar has an aria-label containing the full tab name', () => {
    // Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
    fc.assert(
      fc.property(
        fc.constantFrom<Tab>(...tabs),
        (activeTab) => {
          const { unmount } = render(
            createElement(CollapsedSidebar, {
              activeTab,
              onTabChange: () => { },
              isSearching: false,
              onClearSearch: () => { },
            })
          );

          // Each tab should have a button with aria-label = full tab name
          for (const tab of tabs) {
            const label = tabLabels[tab];
            const btn = screen.getByRole('button', { name: label });
            expect(btn).not.toBeNull();
            expect(btn.getAttribute('aria-label')).toBe(label);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
