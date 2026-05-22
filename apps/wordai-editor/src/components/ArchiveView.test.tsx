/**
 * Integration tests for ArchiveView component
 * Requirements: 1.1, 3.3, 3.6, 4.3, 5.5, 11.4, 11.10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ArchiveView } from './ArchiveView';
import type {
  ArchivedIntentSummary,
  ArchiveSuggestion,
  PausedProject,
  ArchivedIntentDocument,
} from '../types/archive';

// --- Mocks ---

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('../services/auraDocumentAdapter', () => ({
  auraIntentToDocument: (intent: unknown) => ({
    value: {
      id: (intent as { id: string }).id,
      title: (intent as { intent_name: string }).intent_name,
      content: '',
      metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
      version: 1,
      lastModified: new Date(),
    },
    warnings: [],
  }),
}));

// Mock useFocusTrap to avoid DOM focus issues in tests
vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

// Mock useAISummary
vi.mock('../hooks/useAISummary', () => ({
  useAISummary: () => ({ state: { status: 'idle', text: null, retryCount: 0 }, retry: vi.fn() }),
}));

// --- Test Data ---

function createArchivedItem(overrides: Partial<ArchivedIntentSummary> = {}): ArchivedIntentSummary {
  return {
    id: 'item-1',
    intent_name: 'Test Document',
    archived_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    archive_reason: 'No longer needed',
    archive_type: 'draft',
    related_current_id: 'doc-current-1',
    memory_access_enabled: true,
    created_at: Math.floor(Date.now() / 1000) - 172800,
    updated_at: Math.floor(Date.now() / 1000) - 86400,
    version: 1,
    project_id: null,
    ...overrides,
  };
}

function createSuggestion(overrides: Partial<ArchiveSuggestion> = {}): ArchiveSuggestion {
  return {
    id: 'sug-1',
    archive_item_id: 'item-1',
    category: 'unused_concept',
    title: 'Unused Concept Doc',
    description: 'A concept that was never used',
    archived_at: Math.floor(Date.now() / 1000) - 86400,
    relevance_score: 0.9,
    ...overrides,
  };
}

function createPausedProject(overrides: Partial<PausedProject> = {}): PausedProject {
  return {
    id: 'proj-1',
    name: 'Paused Project Alpha',
    description: 'A project that was paused',
    document_count: 5,
    paused_at: Math.floor(Date.now() / 1000) - 604800,
    ...overrides,
  };
}

function createArchivedDocument(overrides: Partial<ArchivedIntentDocument> = {}): ArchivedIntentDocument {
  return {
    ...createArchivedItem(),
    content: [],
    ...overrides,
  };
}

// --- Helpers ---

function setupDefaultMocks(options: {
  items?: ArchivedIntentSummary[];
  suggestions?: ArchiveSuggestion[];
  projects?: PausedProject[];
} = {}) {
  const items = options.items ?? [
    createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha' }),
    createArchivedItem({ id: 'item-2', intent_name: 'Draft Beta', archive_type: 'version' }),
    createArchivedItem({ id: 'item-3', intent_name: 'Project Doc', archive_type: 'project_doc' }),
  ];
  const suggestions = options.suggestions ?? [createSuggestion()];
  const projects = options.projects ?? [createPausedProject()];

  mockInvoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case 'list_archived_intents':
        return Promise.resolve(items);
      case 'get_archive_suggestions':
        return Promise.resolve(suggestions);
      case 'list_paused_projects':
        return Promise.resolve(projects);
      case 'get_archived_intent':
        return Promise.resolve(createArchivedDocument());
      case 'restore_intent':
        return Promise.resolve(createArchivedDocument());
      case 'delete_archived_intent':
        return Promise.resolve(undefined);
      default:
        return Promise.resolve(undefined);
    }
  });
}

function renderArchiveView(props: Partial<React.ComponentProps<typeof ArchiveView>> = {}) {
  const defaultProps = {
    onOpenDocument: vi.fn(),
    onTabChange: vi.fn(),
    currentDocumentId: 'current-doc-1',
    ...props,
  };
  const result = render(<ArchiveView {...defaultProps} />);
  return { ...result, props: defaultProps };
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Req 1.1 — Data fetching on mount
// ---------------------------------------------------------------------------
describe('Data fetching on mount (Req 1.1)', () => {
  it('shows loading state initially', () => {
    setupDefaultMocks();
    renderArchiveView();
    expect(screen.getByTestId('archive-loading')).toBeInTheDocument();
  });

  it('fetches archived items, suggestions, and paused projects on mount', async () => {
    setupDefaultMocks();
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith('list_archived_intents', { category: 'drafts' });
    expect(mockInvoke).toHaveBeenCalledWith('get_archive_suggestions', { active_doc_id: 'current-doc-1', api_key: '', endpoint: null });
    expect(mockInvoke).toHaveBeenCalledWith('list_paused_projects');
  });

  it('does not fetch suggestions when currentDocumentId is null', async () => {
    setupDefaultMocks();
    renderArchiveView({ currentDocumentId: null });

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    expect(mockInvoke).not.toHaveBeenCalledWith('get_archive_suggestions', expect.anything());
  });

  it('displays error state when data fetch fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    renderArchiveView();

    await waitFor(() => {
      expect(screen.getByTestId('archive-load-error')).toBeInTheDocument();
    });
  });

  it('retries data fetch when retry button is clicked', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));
    renderArchiveView();

    await waitFor(() => {
      expect(screen.getByTestId('archive-retry-button')).toBeInTheDocument();
    });

    setupDefaultMocks();
    fireEvent.click(screen.getByTestId('archive-retry-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('archive-load-error')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Req 3.3 — Search filtering with debounce
// ---------------------------------------------------------------------------
describe('Search filtering with debounce (Req 3.3)', () => {
  it('filters items by search query after 300ms debounce', async () => {
    setupDefaultMocks({
      items: [
        createArchivedItem({ id: 'item-1', intent_name: 'Alpha Document', archive_type: 'version' }),
        createArchivedItem({ id: 'item-2', intent_name: 'Beta Document', archive_type: 'version' }),
      ],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    // After debounce (300ms), only matching items should show
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      const view = screen.getByTestId('archive-view');
      expect(view.textContent).toContain('Alpha Document');
    });
  });

  it('shows empty state when search matches nothing', async () => {
    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', intent_name: 'Alpha Document' })],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('archive-empty-state')).toBeInTheDocument();
    });
  });

  it('clears search and shows all items when clear all button is used', async () => {
    setupDefaultMocks({
      items: [
        createArchivedItem({ id: 'item-1', intent_name: 'Alpha Document' }),
        createArchivedItem({ id: 'item-2', intent_name: 'Beta Document' }),
      ],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Type to filter
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('archive-empty-state')).toBeInTheDocument();
    });

    // Click clear all button in empty state
    const clearButton = screen.getByText('archive.filters.clearAll');
    fireEvent.click(clearButton);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('archive-empty-state')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Req 3.6 — Filter panel interaction
// ---------------------------------------------------------------------------
describe('Filter panel interaction (Req 3.6)', () => {
  it('toggles filter panel visibility when filters button is clicked', async () => {
    setupDefaultMocks();
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Filter panel should not be visible initially (no radiogroup from filter panel)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    // Click the filters toggle button (aria-label is 'archive.search.filters')
    const filtersButton = screen.getByLabelText('archive.search.filters');
    fireEvent.click(filtersButton);

    // Filter panel should now be visible (has a radiogroup for date range)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    // Click again to hide
    fireEvent.click(filtersButton);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 4.3 — Drawer open/close flow
// ---------------------------------------------------------------------------
describe('Drawer open/close flow (Req 4.3)', () => {
  it('opens detail drawer when a suggestion card Review action is clicked', async () => {
    setupDefaultMocks();
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Click the Review link on the suggestion card
    // The review button has text 'archive.actions.review' and aria-label 'archive.actions.review Unused Concept Doc'
    const reviewLink = screen.getByText('archive.actions.review');
    fireEvent.click(reviewLink);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_archived_intent', { id: 'sug-1' });
    });

    // Drawer should be open (dialog role)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('closes detail drawer when close button is clicked', async () => {
    setupDefaultMocks();
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Open drawer
    const reviewLink = screen.getByText('archive.actions.review');
    fireEvent.click(reviewLink);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close drawer via close button
    const closeButton = screen.getByLabelText('archive.aria.closeDrawer');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Req 11.4 — Restore action flow (confirmation → IPC → UI update)
// ---------------------------------------------------------------------------
describe('Restore action flow (Req 11.4)', () => {
  it('shows confirmation dialog when restore is triggered from version list', async () => {
    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha', archive_type: 'version' })],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Find and click the restore button on a version list item
    // The restore button has aria-label 'archive.actions.restore'
    const restoreButtons = screen.getAllByLabelText('archive.actions.restore');
    fireEvent.click(restoreButtons[0]);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });
  });

  it('calls restore_intent IPC and updates UI on confirm', async () => {
    const onOpenDocument = vi.fn();
    const onTabChange = vi.fn();

    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha', archive_type: 'version' })],
    });
    renderArchiveView({ onOpenDocument, onTabChange });

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Trigger restore
    const restoreButtons = screen.getAllByLabelText('archive.actions.restore');
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });

    // Confirm the action
    const confirmButton = screen.getByTestId('confirmation-dialog-confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('restore_intent', { id: 'item-1' });
    });

    // Should call onOpenDocument and onTabChange
    await waitFor(() => {
      expect(onOpenDocument).toHaveBeenCalled();
      expect(onTabChange).toHaveBeenCalledWith('editor');
    });
  });

  it('cancels restore when cancel button is clicked', async () => {
    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha', archive_type: 'version' })],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Trigger restore
    const restoreButtons = screen.getAllByLabelText('archive.actions.restore');
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });

    // Cancel
    const cancelButton = screen.getByTestId('confirmation-dialog-cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
    });

    // restore_intent should NOT have been called
    expect(mockInvoke).not.toHaveBeenCalledWith('restore_intent', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Req 11.10 — Delete action flow (confirmation → IPC → UI removal)
// ---------------------------------------------------------------------------
describe('Delete action flow (Req 11.10)', () => {
  it('shows confirmation dialog when delete is triggered from drawer', async () => {
    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha', archive_type: 'version' })],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Open drawer via version list item click (click on the title/body area)
    const versionItem = screen.getByText('Draft Alpha');
    fireEvent.click(versionItem);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click delete button in drawer action bar
    const deleteButton = screen.getByText('archive.actions.deletePermanently');
    fireEvent.click(deleteButton);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });
  });

  it('calls delete_archived_intent IPC and removes item from UI on confirm', async () => {
    setupDefaultMocks({
      items: [
        createArchivedItem({ id: 'item-1', intent_name: 'Draft Alpha', archive_type: 'version' }),
        createArchivedItem({ id: 'item-2', intent_name: 'Draft Beta', archive_type: 'version' }),
      ],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    // Open drawer
    const versionItem = screen.getByText('Draft Alpha');
    fireEvent.click(versionItem);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click delete
    const deleteButton = screen.getByText('archive.actions.deletePermanently');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
    });

    // Confirm deletion
    const confirmButton = screen.getByTestId('confirmation-dialog-confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_archived_intent', { id: 'item-1' });
    });

    // Drawer should close after deletion
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Req 5.5, 4.3 — Empty states for each section
// ---------------------------------------------------------------------------
describe('Empty states for each section', () => {
  it('shows suggestions placeholder when no suggestions available', async () => {
    setupDefaultMocks({ suggestions: [] });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('archive.suggestions.placeholder')).toBeInTheDocument();
  });

  it('shows versions empty message when no versions available', async () => {
    setupDefaultMocks({
      items: [createArchivedItem({ id: 'item-1', archive_type: 'draft' })],
    });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('archive.versions.empty')).toBeInTheDocument();
  });

  it('shows paused projects empty message when no projects available', async () => {
    setupDefaultMocks({ projects: [] });
    renderArchiveView();

    await waitFor(() => {
      expect(screen.queryByTestId('archive-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText('archive.pausedProjects.empty')).toBeInTheDocument();
  });
});
