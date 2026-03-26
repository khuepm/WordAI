/**
 * Integration tests for App component
 * Requirements: All requirements (19.4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppStateProvider } from './services/stateManager';
import App from './App';

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
