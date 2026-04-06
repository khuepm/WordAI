/**
 * Unit tests for EditorStatusBar
 * Requirements: 13.2, 13.3, 13.4, 13.5, 13.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EditorStatusBar } from './EditorStatusBar';

describe('EditorStatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Req 13.3 — shows "Syncing..." when isSyncing=true
  it('displays "Syncing..." when isSyncing is true', () => {
    render(
      <EditorStatusBar
        isSyncing={true}
        isDirty={false}
        lastSyncedAt={Date.now()}
        storagePath="/some/path"
      />
    );
    expect(screen.getByTestId('status-text')).toHaveTextContent('Syncing...');
  });

  // Req 13.4 — shows "Unsaved changes" when isDirty=true and isSyncing=false
  it('displays "Unsaved changes" when isDirty=true and isSyncing=false', () => {
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={true}
        lastSyncedAt={Date.now()}
        storagePath="/some/path"
      />
    );
    expect(screen.getByTestId('status-text')).toHaveTextContent('Unsaved changes');
  });

  // Req 13.8 — shows "Unsaved changes" when no sync has happened yet (lastSyncedAt=null)
  it('displays "Unsaved changes" when lastSyncedAt is null and isSyncing=false', () => {
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={false}
        lastSyncedAt={null}
        storagePath="/some/path"
      />
    );
    expect(screen.getByTestId('status-text')).toHaveTextContent('Unsaved changes');
  });

  // Req 13.2 — shows "Synced · Ns ago" when isDirty=false and isSyncing=false
  it('displays "Synced · Ns ago" when isDirty=false and isSyncing=false', () => {
    const now = Date.now();
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={false}
        lastSyncedAt={now - 5000}
        storagePath="/some/path"
      />
    );
    expect(screen.getByTestId('status-text')).toHaveTextContent('Synced · 5s ago');
  });

  // Req 13.7 — updates "Ns ago" every second
  it('updates the elapsed seconds every second', () => {
    const now = Date.now();
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={false}
        lastSyncedAt={now}
        storagePath="/some/path"
      />
    );

    expect(screen.getByTestId('status-text')).toHaveTextContent('Synced · 0s ago');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('status-text')).toHaveTextContent('Synced · 3s ago');
  });

  // Req 13.5 — storage path is NOT displayed directly in the status bar
  it('does not display the storage path as visible text', () => {
    const storagePath = '/Users/user/Library/Application Support/WordAI/AuraBrain/';
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={false}
        lastSyncedAt={Date.now()}
        storagePath={storagePath}
      />
    );
    expect(screen.queryByText(storagePath)).not.toBeInTheDocument();
    expect(screen.getByTestId('status-text').textContent).not.toContain(storagePath);
  });

  // Req 13.6 — tooltip contains the storage path on hover
  it('exposes storage path via tooltip (title attribute) on the bar', () => {
    const storagePath = '/Users/user/Library/Application Support/WordAI/AuraBrain/';
    render(
      <EditorStatusBar
        isSyncing={false}
        isDirty={false}
        lastSyncedAt={Date.now()}
        storagePath={storagePath}
      />
    );
    const bar = screen.getByTestId('editor-status-bar');
    expect(bar).toHaveAttribute('title', storagePath);
  });

  // isSyncing=true takes priority over isDirty=true
  it('shows "Syncing..." even when isDirty=true if isSyncing=true', () => {
    render(
      <EditorStatusBar
        isSyncing={true}
        isDirty={true}
        lastSyncedAt={null}
        storagePath=""
      />
    );
    expect(screen.getByTestId('status-text')).toHaveTextContent('Syncing...');
  });
});
