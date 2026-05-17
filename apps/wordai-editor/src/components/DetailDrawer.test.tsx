/**
 * Unit tests for DetailDrawer component
 * Requirements: 7.1, 7.5, 7.6, 7.8, 9.4, 9.5, 14.2, 14.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailDrawer, type DetailDrawerProps } from './DetailDrawer';
import type { ArchivedIntentDocument, AISummaryState } from '../types/archive';
import React from 'react';

// --- Mocks ---

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockUseFocusTrap = vi.fn();
vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: (...args: unknown[]) => mockUseFocusTrap(...args),
}));

let mockAISummaryState: AISummaryState = { status: 'idle', text: null, retryCount: 0 };
const mockRetryAISummary = vi.fn();
vi.mock('../hooks/useAISummary', () => ({
  useAISummary: () => ({ state: mockAISummaryState, retry: mockRetryAISummary }),
}));

// --- Helpers ---

function createItem(overrides: Partial<ArchivedIntentDocument> = {}): ArchivedIntentDocument {
  return {
    id: 'item-1',
    intent_name: 'Test Document',
    archived_at: 1705334400, // Jan 15, 2024
    archive_reason: 'No longer needed',
    archive_type: 'draft',
    related_current_id: 'doc-current-1',
    memory_access_enabled: true,
    created_at: 1700000000,
    updated_at: 1705334400,
    version: 1,
    project_id: null,
    content: [],
    ...overrides,
  };
}

function createTriggerRef(): React.RefObject<HTMLElement> {
  const button = document.createElement('button');
  button.textContent = 'Trigger';
  document.body.appendChild(button);
  return { current: button } as React.RefObject<HTMLElement>;
}

function renderDrawer(overrides: Partial<DetailDrawerProps> = {}) {
  const triggerRef = createTriggerRef();
  const props: DetailDrawerProps = {
    isOpen: true,
    item: createItem(),
    isLoading: false,
    loadError: null,
    onClose: vi.fn(),
    onRestore: vi.fn(),
    onCompare: vi.fn(),
    onOpenReadOnly: vi.fn(),
    onSaveToLibrary: vi.fn(),
    onDelete: vi.fn(),
    onToggleMemoryAccess: vi.fn(),
    onRetryLoad: vi.fn(),
    triggerRef,
    ...overrides,
  };
  const result = render(<DetailDrawer {...props} />);
  return { props, result, triggerRef };
}

// --- Tests ---

beforeEach(() => {
  mockUseFocusTrap.mockReset();
  mockRetryAISummary.mockReset();
  mockAISummaryState = { status: 'idle', text: null, retryCount: 0 };
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Req 7.1 — Drawer opens with slide animation
// ---------------------------------------------------------------------------
describe('Drawer opens with slide animation (Req 7.1)', () => {
  it('renders with slideInFromRight animation style', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.animation).toContain('slideInFromRight');
    expect(dialog.style.animation).toContain('500ms');
    expect(dialog.style.animation).toContain('ease-out');
  });

  it('has max-width of 672px on non-mobile', () => {
    // Default window.innerWidth is 1024 in jsdom
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.maxWidth).toBe('672px');
  });
});

// ---------------------------------------------------------------------------
// Req 7.6 — Escape key closes drawer
// ---------------------------------------------------------------------------
describe('Escape key closes drawer (Req 7.6)', () => {
  it('calls useFocusTrap with onClose callback for Escape handling', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    // useFocusTrap is called with (containerRef, isActive, triggerRef, onClose)
    expect(mockUseFocusTrap).toHaveBeenCalled();
    const lastCall = mockUseFocusTrap.mock.calls[mockUseFocusTrap.mock.calls.length - 1];
    // 4th argument is the onClose callback
    expect(lastCall[3]).toBe(onClose);
  });
});

// ---------------------------------------------------------------------------
// Req 7.5 — Scrim click closes drawer
// ---------------------------------------------------------------------------
describe('Scrim click closes drawer (Req 7.5)', () => {
  it('calls onClose when scrim overlay is clicked', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    // The scrim is the element with aria-hidden="true" that is not the dialog
    const scrim = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Req 7.8, 14.2 — Focus trap behavior
// ---------------------------------------------------------------------------
describe('Focus trap behavior (Req 7.8, 14.2)', () => {
  it('calls useFocusTrap with isActive=true when drawer is open', () => {
    renderDrawer({ isOpen: true });
    expect(mockUseFocusTrap).toHaveBeenCalled();
    const lastCall = mockUseFocusTrap.mock.calls[mockUseFocusTrap.mock.calls.length - 1];
    // 2nd argument is isActive
    expect(lastCall[1]).toBe(true);
  });

  it('does not render when isOpen is false (no focus trap needed)', () => {
    renderDrawer({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 14.3 — Focus restoration to trigger element
// ---------------------------------------------------------------------------
describe('Focus restoration to trigger element (Req 14.3)', () => {
  it('passes triggerRef to useFocusTrap for focus restoration', () => {
    const triggerRef = createTriggerRef();
    renderDrawer({ triggerRef });
    expect(mockUseFocusTrap).toHaveBeenCalled();
    const lastCall = mockUseFocusTrap.mock.calls[mockUseFocusTrap.mock.calls.length - 1];
    // 3rd argument is triggerRef
    expect(lastCall[2]).toBe(triggerRef);
  });
});

// ---------------------------------------------------------------------------
// Req 7.1 — Error state rendering
// ---------------------------------------------------------------------------
describe('Error state rendering (Req 7.1)', () => {
  it('displays error message when loadError is set', () => {
    renderDrawer({ loadError: 'Network failure', item: null });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Error message should contain the translated key with the error
    expect(dialog.textContent).toContain('archive.errors.loadFailed');
  });

  it('renders retry button in error state', () => {
    const onRetryLoad = vi.fn();
    renderDrawer({ loadError: 'Network failure', item: null, onRetryLoad });
    const retryButton = screen.getByText('archive.retry');
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetryLoad).toHaveBeenCalledOnce();
  });

  it('does not render metadata or AI summary sections in error state', () => {
    renderDrawer({ loadError: 'Network failure', item: null });
    expect(screen.queryByText('archive.detail.archivedDate')).not.toBeInTheDocument();
    expect(screen.queryByText('archive.detail.aiSummary.title')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 7.1 — Metadata section displays correctly
// ---------------------------------------------------------------------------
describe('Metadata section displays correctly (Req 7.1)', () => {
  it('displays archived date formatted as locale date', () => {
    const item = createItem({ archived_at: 1705334400 }); // Jan 15, 2024
    renderDrawer({ item });
    const dialog = screen.getByRole('dialog');
    // The date should be formatted — check it contains "2024" at minimum
    expect(dialog.textContent).toContain('2024');
  });

  it('displays archive reason', () => {
    const item = createItem({ archive_reason: 'No longer needed' });
    renderDrawer({ item });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('No longer needed');
  });

  it('displays placeholder when archive reason is empty', () => {
    const item = createItem({ archive_reason: '' });
    renderDrawer({ item });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('archive.detail.reasonPlaceholder');
  });

  it('displays archive type badge', () => {
    const item = createItem({ archive_type: 'draft' });
    renderDrawer({ item });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Archived Draft');
  });

  it('displays document title', () => {
    const item = createItem({ intent_name: 'My Important Doc' });
    renderDrawer({ item });
    expect(screen.getByText('My Important Doc')).toBeInTheDocument();
  });

  it('displays related current file link when available', () => {
    const item = createItem({ related_current_id: 'doc-123' });
    renderDrawer({ item });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('archive.detail.relatedCurrentFile');
    expect(dialog.textContent).toContain('doc-123');
  });
});

// ---------------------------------------------------------------------------
// Req 9.4, 9.5 — AI summary loading/success/error states
// ---------------------------------------------------------------------------
describe('AI summary loading/success/error states (Req 9.4, 9.5)', () => {
  it('displays loading state when AI summary is loading', () => {
    mockAISummaryState = { status: 'loading', text: null, retryCount: 0 };
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('archive.detail.aiSummary.generating');
  });

  it('displays summary text on success', () => {
    mockAISummaryState = { status: 'success', text: 'This is a great summary of the document.', retryCount: 0 };
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('This is a great summary of the document.');
  });

  it('displays error state with retry button on failure', () => {
    mockAISummaryState = { status: 'error', text: null, retryCount: 1 };
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('archive.detail.aiSummary.unavailable');
    expect(dialog.textContent).toContain('archive.detail.aiSummary.retry');
  });

  it('calls retry when retry button is clicked', () => {
    mockAISummaryState = { status: 'error', text: null, retryCount: 1 };
    renderDrawer();
    const retryButton = screen.getByText('archive.detail.aiSummary.retry');
    fireEvent.click(retryButton);
    expect(mockRetryAISummary).toHaveBeenCalledOnce();
  });

  it('disables retry button after 3 retries', () => {
    mockAISummaryState = { status: 'error', text: null, retryCount: 3 };
    renderDrawer();
    const retryButton = screen.getByText('archive.detail.aiSummary.retry');
    expect(retryButton).toBeDisabled();
  });

  it('renders AI summary section title', () => {
    mockAISummaryState = { status: 'success', text: 'Summary text', retryCount: 0 };
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('archive.detail.aiSummary.title');
  });
});

// ---------------------------------------------------------------------------
// Additional: Dialog ARIA attributes (Req 14.2)
// ---------------------------------------------------------------------------
describe('Dialog ARIA attributes (Req 14.2)', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has an aria-label', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'archive.aria.drawer');
  });
});

// ---------------------------------------------------------------------------
// Additional: Close button
// ---------------------------------------------------------------------------
describe('Close button', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    const closeButton = screen.getByLabelText('archive.aria.closeDrawer');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
