/**
 * Unit tests for keyboard shortcut activation of QuickSearchPopup
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState, useEffect } from 'react';
import { QuickSearchPopup } from './QuickSearchPopup';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// ─── Minimal test component that mirrors App's keyboard shortcut logic ────────

function ShortcutTestHarness() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <QuickSearchPopup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSelect={() => setIsOpen(false)}
    />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuickSearch keyboard shortcut activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Cmd+Shift+P opens the QuickSearchPopup', async () => {
    render(<ShortcutTestHarness />);

    // Popup should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Fire Cmd+Shift+P (macOS)
    fireEvent.keyDown(document, { key: 'P', shiftKey: true, metaKey: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('Ctrl+Shift+P opens the QuickSearchPopup', async () => {
    render(<ShortcutTestHarness />);

    // Popup should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Fire Ctrl+Shift+P (Windows/Linux)
    fireEvent.keyDown(document, { key: 'P', shiftKey: true, ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('popup closes when onClose is called (Escape key)', async () => {
    render(<ShortcutTestHarness />);

    // Open the popup
    fireEvent.keyDown(document, { key: 'P', shiftKey: true, metaKey: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Press Escape inside the dialog
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('popup closes when backdrop is clicked', async () => {
    render(<ShortcutTestHarness />);

    // Open the popup
    fireEvent.keyDown(document, { key: 'P', shiftKey: true, ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('quick-search-backdrop')).toBeInTheDocument();
    });

    // Click the backdrop
    fireEvent.click(screen.getByTestId('quick-search-backdrop'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
