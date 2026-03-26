/**
 * Unit tests for VersionHistory component
 * Requirements: 22.4, 22.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionHistory } from './VersionHistory';
import type { DocumentSnapshot } from '../types/document';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(version: number, content: string): DocumentSnapshot {
  return {
    version,
    content,
    timestamp: `2024-01-${String(version).padStart(2, '0')}T10:00:00Z`,
  };
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  documentId: 'doc-1',
  onRestore: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Visibility ───────────────────────────────────────────────────────────────

describe('VersionHistory - visibility', () => {
  it('renders the panel when isOpen=true', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<VersionHistory {...defaultProps} />);
    expect(screen.getByTestId('version-history-panel')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    mockInvoke.mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByTestId('version-history-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    mockInvoke.mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose on Escape when panel is closed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} isOpen={false} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('VersionHistory - loading', () => {
  it('shows loading indicator while fetching', () => {
    // Never resolves
    mockInvoke.mockReturnValue(new Promise(() => { }));
    render(<VersionHistory {...defaultProps} />);
    expect(screen.getByTestId('version-history-loading')).toBeInTheDocument();
  });

  it('calls get_version_history with the correct doc id', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<VersionHistory {...defaultProps} documentId="my-doc-42" />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get_version_history', { docId: 'my-doc-42' }));
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('VersionHistory - empty state', () => {
  it('shows empty message when no versions exist (Req 22.4)', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('version-history-empty')).toBeInTheDocument()
    );
  });
});

// ─── Version list (Req 22.4, 22.5) ───────────────────────────────────────────

describe('VersionHistory - version list', () => {
  it('renders a list item for each snapshot', async () => {
    mockInvoke.mockResolvedValue([
      makeSnapshot(1, 'first'),
      makeSnapshot(2, 'second'),
      makeSnapshot(3, 'third'),
    ]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('version-item-3')).toBeInTheDocument());
    expect(screen.getByTestId('version-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('version-item-1')).toBeInTheDocument();
  });

  it('displays version numbers in the list', async () => {
    mockInvoke.mockResolvedValue([makeSnapshot(5, 'content')]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('v5')).toBeInTheDocument());
  });

  it('shows newest version first (reversed order)', async () => {
    mockInvoke.mockResolvedValue([
      makeSnapshot(1, 'old'),
      makeSnapshot(2, 'new'),
    ]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => {
      const items = screen.getAllByRole('button', { name: /v\d/ });
      // First rendered item should be v2 (newest)
      expect(items[0]).toHaveTextContent('v2');
      expect(items[1]).toHaveTextContent('v1');
    });
  });
});

// ─── Preview (Req 22.5) ───────────────────────────────────────────────────────

describe('VersionHistory - preview', () => {
  it('shows hint when no version is selected', async () => {
    mockInvoke.mockResolvedValue([makeSnapshot(1, 'hello')]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('version-preview-hint')).toBeInTheDocument()
    );
  });

  it('shows content preview when a version is clicked', async () => {
    mockInvoke.mockResolvedValue([makeSnapshot(1, 'preview content here')]);
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => screen.getByTestId('version-item-1'));
    await user.click(screen.getByTestId('version-item-1'));
    expect(screen.getByTestId('version-preview')).toHaveTextContent('preview content here');
  });
});

// ─── Restore (Req 22.5) ───────────────────────────────────────────────────────

describe('VersionHistory - restore', () => {
  it('restore button is disabled when no version is selected', async () => {
    mockInvoke.mockResolvedValue([makeSnapshot(1, 'content')]);
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => screen.getByTestId('version-restore-button'));
    expect(screen.getByTestId('version-restore-button')).toBeDisabled();
  });

  it('restore button is enabled after selecting a version', async () => {
    mockInvoke.mockResolvedValue([makeSnapshot(2, 'restored content')]);
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() => screen.getByTestId('version-item-2'));
    await user.click(screen.getByTestId('version-item-2'));
    expect(screen.getByTestId('version-restore-button')).not.toBeDisabled();
  });

  it('calls onRestore with the selected version content', async () => {
    const onRestore = vi.fn();
    mockInvoke.mockResolvedValue([makeSnapshot(3, 'the restored text')]);
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} onRestore={onRestore} />);
    await waitFor(() => screen.getByTestId('version-item-3'));
    await user.click(screen.getByTestId('version-item-3'));
    await user.click(screen.getByTestId('version-restore-button'));
    expect(onRestore).toHaveBeenCalledWith('the restored text');
  });

  it('calls onClose after restoring', async () => {
    const onClose = vi.fn();
    mockInvoke.mockResolvedValue([makeSnapshot(1, 'content')]);
    const user = userEvent.setup();
    render(<VersionHistory {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByTestId('version-item-1'));
    await user.click(screen.getByTestId('version-item-1'));
    await user.click(screen.getByTestId('version-restore-button'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('VersionHistory - error state', () => {
  it('shows error message when invoke fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    render(<VersionHistory {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('version-history-error')).toHaveTextContent('Network error')
    );
  });
});
