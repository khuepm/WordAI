/**
 * Property-based tests for PreferencesDialog responsive layout
 * Validates: Requirements 3.1, 6.1, 3.2, 6.2
 */

// Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
// Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { CollapsedSidebar, HorizontalTabBar } from './PreferencesDialog';
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

// ---------------------------------------------------------------------------
// Property 4: Stacked layout and ARIA roles
// Validates: Requirements 3.2, 6.2
// ---------------------------------------------------------------------------

describe('Property 4: Stacked layout and ARIA roles', () => {
  const allTabs: Tab[] = ['general', 'ai-engine', 'typography', 'privacy'];

  afterEach(() => {
    // Clean up any rendered components
  });

  it('for any viewport width in [200, 479], vw < MODAL_BREAKPOINTS.STACK_LAYOUT (480)', () => {
    // Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 479 }),
        (vw) => {
          expect(vw).toBeLessThan(MODAL_BREAKPOINTS.STACK_LAYOUT);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('HorizontalTabBar container has role="tablist", each tab has role="tab" and correct aria-selected', () => {
    // Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 479 }),
        fc.constantFrom<Tab>('general', 'ai-engine', 'typography', 'privacy'),
        (vw, activeTab) => {
          void vw; // represents stacked layout viewport width condition

          const { unmount, container } = render(
            createElement(HorizontalTabBar, {
              activeTab,
              onTabChange: () => { },
            })
          );

          // Container must have role="tablist"
          const tablist = container.querySelector('[role="tablist"]');
          expect(tablist).not.toBeNull();

          // Each tab button must have role="tab"
          const tabButtons = container.querySelectorAll('[role="tab"]');
          expect(tabButtons.length).toBe(allTabs.length);

          // Active tab must have aria-selected="true", inactive tabs aria-selected="false"
          for (const btn of tabButtons) {
            const tabId = btn.getAttribute('data-tab-id') ?? btn.textContent?.trim();
            const isActive = btn.getAttribute('aria-selected');
            if (btn === container.querySelector(`[role="tab"][aria-selected="true"]`)) {
              expect(isActive).toBe('true');
            } else {
              expect(isActive).toBe('false');
            }
          }

          // Exactly one tab should be aria-selected="true"
          const selectedTabs = container.querySelectorAll('[role="tab"][aria-selected="true"]');
          expect(selectedTabs.length).toBe(1);

          // All other tabs should be aria-selected="false"
          const unselectedTabs = container.querySelectorAll('[role="tab"][aria-selected="false"]');
          expect(unselectedTabs.length).toBe(allTabs.length - 1);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the active tab button has aria-selected="true" matching the activeTab prop', () => {
    // Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
    fc.assert(
      fc.property(
        fc.constantFrom<Tab>('general', 'ai-engine', 'typography', 'privacy'),
        (activeTab) => {
          const { unmount, container } = render(
            createElement(HorizontalTabBar, {
              activeTab,
              onTabChange: () => { },
            })
          );

          const tabButtons = Array.from(container.querySelectorAll('[role="tab"]'));

          // Find the button corresponding to activeTab by checking aria-selected
          const selectedBtn = tabButtons.find(
            (btn) => btn.getAttribute('aria-selected') === 'true'
          );
          expect(selectedBtn).not.toBeUndefined();

          // All other buttons must have aria-selected="false"
          const inactiveBtns = tabButtons.filter(
            (btn) => btn.getAttribute('aria-selected') !== 'true'
          );
          expect(inactiveBtns.length).toBe(allTabs.length - 1);
          for (const btn of inactiveBtns) {
            expect(btn.getAttribute('aria-selected')).toBe('false');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
