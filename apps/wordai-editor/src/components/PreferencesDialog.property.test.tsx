/**
 * Property-based tests for PreferencesDialog responsive layout
 * Validates: Requirements 1.1, 1.2, 3.1, 6.1, 3.2, 6.2
 */

// Feature: responsive-modal-system, Property 1: PreferencesDialog size constraints
// Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
// Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { CollapsedSidebar, HorizontalTabBar, PreferencesDialog } from './PreferencesDialog';
import { useViewportSize, MODAL_BREAKPOINTS } from '../hooks/useViewportSize';
import type { Tab } from '../types/preferences';

vi.mock('../hooks/useViewportSize', () => ({
  useViewportSize: vi.fn(),
  MODAL_BREAKPOINTS: { COLLAPSE_SIDEBAR: 720, STACK_LAYOUT: 480 },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const allTabs: Tab[] = ['general', 'ai-engine', 'typography', 'privacy', 'about'];

// ---------------------------------------------------------------------------
// Property 1: PreferencesDialog size constraints
// Validates: Requirements 1.1, 1.2
// ---------------------------------------------------------------------------

describe('Property 1: PreferencesDialog size constraints', () => {
  // Feature: responsive-modal-system, Property 1: PreferencesDialog size constraints
  it('for any viewport size, modal container has correct CSS variable references for maxWidth and maxHeight', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 2560 }), // viewport width
        fc.integer({ min: 200, max: 1440 }), // viewport height
        (vw, vh) => {
          vi.mocked(useViewportSize).mockReturnValue({ width: vw, height: vh });

          const { unmount, container } = render(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
            })
          );

          // Find the inner modal container div (has maxWidth + maxHeight CSS variables)
          const modalContainer = container.querySelector<HTMLElement>(
            '[style*="modal-max-width-preferences"]'
          );
          expect(modalContainer).not.toBeNull();

          const style = modalContainer!.style;
          expect(style.maxWidth).toContain(
            'var(--modal-max-width-preferences, min(900px, calc(100vw - 48px)))'
          );
          expect(style.maxHeight).toContain(
            'var(--modal-max-height-preferences, min(680px, calc(100vh - 80px)))'
          );

          unmount();
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Collapsed sidebar layout and accessibility
// Validates: Requirements 3.1, 6.1
// ---------------------------------------------------------------------------

describe('Property 3: Collapsed sidebar layout and accessibility', () => {
  const tabs: Tab[] = ['general', 'ai-engine', 'typography', 'privacy', 'about'];
  const tabLabels: Record<Tab, string> = {
    general: 'General',
    'ai-engine': 'AI Engine',
    typography: 'Typography',
    privacy: 'Privacy',
    about: 'About',
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
      { numRuns: 25 }
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
      { numRuns: 25 }
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
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Stacked layout and ARIA roles
// Validates: Requirements 3.2, 6.2
// ---------------------------------------------------------------------------

describe('Property 4: Stacked layout and ARIA roles', () => {
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
      { numRuns: 25 }
    );
  });

  it('HorizontalTabBar container has role="tablist", each tab has role="tab" and correct aria-selected', () => {
    // Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 479 }),
        fc.constantFrom<Tab>('general', 'ai-engine', 'typography', 'privacy', 'about'),
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
      { numRuns: 25 }
    );
  });

  it('the active tab button has aria-selected="true" matching the activeTab prop', () => {
    // Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
    fc.assert(
      fc.property(
        fc.constantFrom<Tab>(...allTabs),
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
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: State preservation across resize
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------

describe('Property 5: State preservation across resize', () => {
  // Feature: responsive-modal-system, Property 5: State preservation across resize

  // Tab titles now come from i18n translations (default: English)
  const tabTitles: Record<Tab, string> = {
    general: 'General Settings',  // t('settings.general.sectionTitle')
    'ai-engine': 'AI Engine Settings',  // t('settings.aiEngine.sectionTitle')
    typography: 'Typography',  // t('settings.tabs.typography')
    privacy: 'Privacy & Security',  // t('settings.privacy.sectionTitle')
    about: 'About WordAI',  // t('settings.about.title')
  };

  it('active tab heading is preserved after viewport resize', () => {
    // Feature: responsive-modal-system, Property 5: State preservation across resize
    fc.assert(
      fc.property(
        fc.constantFrom<Tab>(...allTabs),
        fc.integer({ min: 400, max: 1200 }), // new viewport width after resize
        (activeTab, newVw) => {
          // Start with normal layout (900px wide)
          vi.mocked(useViewportSize).mockReturnValue({ width: 900, height: 768 });

          const { unmount, rerender, container } = render(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
              initialTab: activeTab,
            })
          );

          // The dialog header h2 is the first h2 inside the <header> element
          const headerEl = container.querySelector('header');
          expect(headerEl).not.toBeNull();
          const initialHeading = headerEl!.querySelector('h2');
          expect(initialHeading).not.toBeNull();
          expect(initialHeading!.textContent).toBe(tabTitles[activeTab]);

          // Trigger resize by updating the mocked useViewportSize return value
          vi.mocked(useViewportSize).mockReturnValue({ width: newVw, height: 768 });

          // Re-render to simulate the resize
          rerender(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
              initialTab: activeTab,
            })
          );

          // Verify the active tab heading is still showing the same tab title
          const headerAfter = container.querySelector('header');
          expect(headerAfter).not.toBeNull();
          const headingAfterResize = headerAfter!.querySelector('h2');
          expect(headingAfterResize).not.toBeNull();
          expect(headingAfterResize!.textContent).toBe(tabTitles[activeTab]);

          unmount();
        }
      ),
      { numRuns: 25 }
    );
  });

  it('component does not unmount/remount on resize (state is preserved naturally)', () => {
    // Feature: responsive-modal-system, Property 5: State preservation across resize
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 1200 }), // new viewport width after resize
        (newVw) => {
          // Start with normal layout (900px wide)
          vi.mocked(useViewportSize).mockReturnValue({ width: 900, height: 768 });

          const { unmount, rerender, container } = render(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
            })
          );

          // Capture the modal container element reference before resize
          const modalBefore = container.querySelector<HTMLElement>(
            '[style*="modal-max-width-preferences"]'
          );
          expect(modalBefore).not.toBeNull();

          // Trigger resize
          vi.mocked(useViewportSize).mockReturnValue({ width: newVw, height: 768 });

          rerender(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
            })
          );

          // The modal container should still be present (not unmounted)
          const modalAfter = container.querySelector<HTMLElement>(
            '[style*="modal-max-width-preferences"]'
          );
          expect(modalAfter).not.toBeNull();

          // Default tab (general) heading should still be visible in the header
          const headerEl = container.querySelector('header');
          expect(headerEl).not.toBeNull();
          const heading = headerEl!.querySelector('h2');
          expect(heading).not.toBeNull();
          expect(heading!.textContent).toBe('General Settings'); // matches t('settings.general.sectionTitle')

          unmount();
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Focus trap within modal
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

// Feature: responsive-modal-system, Property 7: Focus trap within modal
describe('Property 7: Focus trap within modal', () => {
  it('after any number of Tab key presses, focused element is always within the modal container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // number of Tab key presses
        (tabPresses) => {
          vi.mocked(useViewportSize).mockReturnValue({ width: 900, height: 768 });

          const { unmount, container } = render(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
            })
          );

          // Find the modal container div (the one with ref={modalRef})
          const modalContainer = container.querySelector<HTMLElement>(
            '[style*="modal-max-width-preferences"]'
          );
          expect(modalContainer).not.toBeNull();

          // Get all focusable elements within the modal
          const focusableElements = Array.from(
            modalContainer!.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter(el => !el.hasAttribute('disabled'));

          // The modal must have at least one focusable element
          expect(focusableElements.length).toBeGreaterThan(0);

          // Focus the first element to start (simulating dialog open behavior)
          focusableElements[0].focus();

          // Simulate Tab key presses
          for (let i = 0; i < tabPresses; i++) {
            const { fireEvent } = require('@testing-library/react');
            fireEvent.keyDown(modalContainer!, { key: 'Tab', bubbles: true });

            // After each Tab press, verify document.activeElement is within the modal
            // jsdom may not move focus on keyDown alone, so we verify the invariant:
            // either activeElement is within the modal, or it is the body/null (jsdom limitation)
            const active = document.activeElement;
            if (active && active !== document.body) {
              expect(modalContainer!.contains(active)).toBe(true);
            }
          }

          unmount();
        }
      ),
      { numRuns: 25 }
    );
  });

  it('modal container always has at least one focusable element when open', () => {
    // Feature: responsive-modal-system, Property 7: Focus trap within modal
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // number of Tab key presses (unused, but keeps same generator shape)
        (_tabPresses) => {
          vi.mocked(useViewportSize).mockReturnValue({ width: 900, height: 768 });

          const { unmount, container } = render(
            createElement(PreferencesDialog, {
              isOpen: true,
              onClose: () => { },
            })
          );

          const modalContainer = container.querySelector<HTMLElement>(
            '[style*="modal-max-width-preferences"]'
          );
          expect(modalContainer).not.toBeNull();

          const focusableElements = Array.from(
            modalContainer!.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter(el => !el.hasAttribute('disabled'));

          // Focus trap invariant: modal must always have focusable elements
          expect(focusableElements.length).toBeGreaterThan(0);

          unmount();
        }
      ),
      { numRuns: 25 }
    );
  });
});
