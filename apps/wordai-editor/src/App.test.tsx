/**
 * Integration tests for App component
 * Requirements: All requirements (19.4)
 * Task 8.1: Cmd+S keyboard handler, isDirty/isSyncing wired to DocumentTitleBar, error notification
 * Task 8.2: Dirty_Bit tracking on content change, undo restores clean state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AppStateProvider } from './services/stateManager';
import App from './App';
import * as auraBrainManager from './services/auraBrainManager';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRawDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-doc-id',
    title: 'Untitled',
    content: '',
    metadata: {
      word_count: 0,
      reading_time: 0,
      status: 'draft',
      tags: [],
    },
    version: 1,
    last_modified: new Date().toISOString(),
    ...overrides,
  };
}

function renderApp() {
  return render(
    <AppStateProvider>
      <App />
    </AppStateProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    localStorage.clear();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_document') return Promise.resolve(makeRawDocument());
      if (cmd === 'check_ai_health') return Promise.resolve(true);
      return Promise.resolve(null);
    });
  });

  it('shows loading state initially', () => {
    // Use a never-resolving promise so the loading state persists during the assertion
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'check_ai_health') return Promise.resolve(true);
      return new Promise(() => { }); // never resolves → stays in loading
    });

    renderApp();
    expect(screen.getByTestId('app-loading')).toBeInTheDocument();
  });

  it('renders TopNavBar after init', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('top-nav-bar')).toBeInTheDocument();
    });
  });

  it('renders EditorCanvas after init', async () => {
    renderApp();
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /document editor/i })
      ).toBeInTheDocument();
    });
  });

  it('AI service banner not shown when health check passes', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('top-nav-bar')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-service-banner')).not.toBeInTheDocument();
  });
});

// ─── Task 8.1: Cmd+S keyboard handler ─────────────────────────────────────────

describe('Task 8.1 — Cmd+S / Ctrl+S AuraBrain sync', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    localStorage.clear();
    auraBrainManager._resetStateForTesting();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_document') return Promise.resolve(makeRawDocument());
      if (cmd === 'check_ai_health') return Promise.resolve(true);
      if (cmd === 'sync_intent') return Promise.resolve(2);
      return Promise.resolve(null);
    });
  });

  // Req 1.1: Cmd+S calls auraBrainManager.sync — no dialog
  it('Cmd+S triggers auraBrainManager.sync without opening a dialog', async () => {
    const syncSpy = vi.spyOn(auraBrainManager, 'sync');
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true });
    });

    expect(syncSpy).toHaveBeenCalledOnce();
    // No dialog should appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Req 1.1: Ctrl+S also triggers sync (Windows/Linux)
  it('Ctrl+S triggers auraBrainManager.sync', async () => {
    const syncSpy = vi.spyOn(auraBrainManager, 'sync');
    syncSpy.mockClear();
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    });

    expect(syncSpy).toHaveBeenCalledOnce();
  });

  // Req 1.4: error notification shown on sync failure, dirty indicator NOT cleared
  it('shows sync error notification when sync fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_document') return Promise.resolve(makeRawDocument());
      if (cmd === 'check_ai_health') return Promise.resolve(true);
      if (cmd === 'sync_intent') return Promise.reject(new Error('SQLite write failed'));
      return Promise.resolve(null);
    });

    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId('sync-error-notification')).toBeInTheDocument();
    });
    expect(screen.getByTestId('sync-error-notification').textContent).toContain('SQLite write failed');
  });

  // Req 3.3, 3.4: isDirty and isSyncing are passed to DocumentTitleBar via TopNavBar
  it('DocumentTitleBar is rendered inside TopNavBar', async () => {
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    // DocumentTitleBar should be present inside the nav bar
    expect(screen.getByTestId('document-title-bar')).toBeInTheDocument();
    // Initially not dirty (new doc, no lastSyncedHash)
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).not.toContain('●');
  });
});

// ─── Task 8.2: Dirty_Bit tracking ─────────────────────────────────────────────

describe('Task 8.2 — Dirty_Bit tracking on content change', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    localStorage.clear();
    auraBrainManager._resetStateForTesting();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_document') return Promise.resolve(makeRawDocument());
      if (cmd === 'check_ai_health') return Promise.resolve(true);
      if (cmd === 'sync_intent') return Promise.resolve(2);
      return Promise.resolve(null);
    });
  });

  // Req 4.2, 4.3: dirty bit set when content changes after a sync
  it('isDirty becomes true after content changes post-sync', async () => {
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    // First sync to establish lastSyncedHash
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true });
    });
    await waitFor(() => {
      expect(auraBrainManager.getState().lastSyncedHash).not.toBeNull();
    });

    // Simulate content change via the editor
    const editor = screen.getByRole('textbox', { name: /document editor/i });
    await act(async () => {
      fireEvent.input(editor, { target: { innerText: 'new content that differs' } });
    });

    // isDirty should now be true (content differs from synced hash)
    await waitFor(() => {
      const titleText = screen.getByTestId('document-title-text').textContent ?? '';
      expect(titleText).toContain('●');
    });
  });

  // Req 4.4: dirty bit false when no lastSyncedHash (new document)
  it('isDirty is false for a new document with no prior sync', async () => {
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    // No sync has happened, so lastSyncedHash is null → isDirty = false
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).not.toContain('●');
  });

  // Req 1.2, 3.4: dirty indicator cleared after successful sync
  it('dirty indicator clears after successful Cmd+S sync', async () => {
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    // Simulate content change first
    const editor = screen.getByRole('textbox', { name: /document editor/i });
    await act(async () => {
      fireEvent.input(editor, { target: { innerText: 'some content' } });
    });

    // Sync
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true });
    });

    await waitFor(() => {
      const titleText = screen.getByTestId('document-title-text').textContent ?? '';
      expect(titleText).not.toContain('●');
    });
  });

  // Req 4.5: undo to synced state clears dirty bit
  it('isDirty becomes false when content is restored to last synced state (undo)', async () => {
    renderApp();
    await waitFor(() => screen.getByTestId('top-nav-bar'));

    const editor = screen.getByRole('textbox', { name: /document editor/i });

    // Set initial content and sync
    await act(async () => {
      fireEvent.input(editor, { target: { innerText: 'original content' } });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: 's', metaKey: true });
    });
    await waitFor(() => {
      expect(auraBrainManager.getState().lastSyncedHash).not.toBeNull();
    });

    // Modify content (makes it dirty)
    await act(async () => {
      fireEvent.input(editor, { target: { innerText: 'modified content' } });
    });
    await waitFor(() => {
      const titleText = screen.getByTestId('document-title-text').textContent ?? '';
      expect(titleText).toContain('●');
    });

    // "Undo" — restore to original content
    await act(async () => {
      fireEvent.input(editor, { target: { innerText: 'original content' } });
    });

    // isDirty should be false again (hash matches lastSyncedHash)
    await waitFor(() => {
      const titleText = screen.getByTestId('document-title-text').textContent ?? '';
      expect(titleText).not.toContain('●');
    });
  });
});
