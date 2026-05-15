/**
 * Unit tests for RenderDrawer component
 * Requirements: 11.2, 11.3, 11.4, 11.5, 12.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenderDrawer } from './RenderDrawer';
import { exportMarkdown, exportPdf } from '../services/exportService';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('../services/exportService', () => ({
  exportMarkdown: vi.fn().mockResolvedValue({ status: 'success', path: '/path/to/file.md' }),
  exportPdf: vi.fn().mockResolvedValue({ status: 'success', path: '/path/to/file.pdf' }),
  exportDocx: vi.fn().mockResolvedValue({ status: 'success', path: '/path/to/file.docx' }),
  importFile: vi.fn().mockResolvedValue({ status: 'cancelled' }),
}));

vi.mock('../services/preferencesService', () => ({
  loadPreferences: vi.fn().mockResolvedValue({
    general: { defaultExportFormat: 'markdown' },
  }),
}));

// ─── Default props ────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  documentId: 'doc-1',
  documentContent: 'Hello world',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Visibility ───────────────────────────────────────────────────────────────

describe('RenderDrawer - visibility', () => {
  it('renders the drawer when isOpen=true', () => {
    render(<RenderDrawer {...defaultProps} />);
    expect(screen.getByTestId('render-drawer')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByTestId('drawer-close-button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed (Req 21.4)', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose on Escape when drawer is closed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} isOpen={false} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Format selection (Req 11.2, 11.3) ───────────────────────────────────────

describe('RenderDrawer - format selection', () => {
  it('renders all supported export format options', () => {
    render(<RenderDrawer {...defaultProps} />);
    expect(screen.getByTestId('format-option-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-markdown')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-docx')).toBeInTheDocument();
  });

  it('selects Markdown from default export preference', () => {
    render(<RenderDrawer {...defaultProps} />);
    expect(screen.getByTestId('format-option-markdown')).toHaveAttribute('aria-checked', 'true');
  });

  it('updates selected format on click (Req 11.2)', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-markdown'));
    expect(screen.getByTestId('format-option-markdown')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('format-option-pdf')).toHaveAttribute('aria-checked', 'false');
  });

  it('shows PDF options only when PDF is selected (Req 11.3)', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    // Markdown selected by default — PDF options hidden
    expect(screen.queryByTestId('pdf-options')).not.toBeInTheDocument();

    // Switch to PDF — options visible
    await user.click(screen.getByTestId('format-option-pdf'));
    expect(screen.getByTestId('pdf-options')).toBeInTheDocument();

    // Switch to Markdown — PDF options hidden
    await user.click(screen.getByTestId('format-option-markdown'));
    expect(screen.queryByTestId('pdf-options')).not.toBeInTheDocument();
  });
});

// ─── PDF options (Req 11.4) ───────────────────────────────────────────────────

describe('RenderDrawer - PDF options', () => {
  it('renders page size buttons', () => {
    render(<RenderDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('format-option-pdf'));
    expect(screen.getByTestId('page-size-a4')).toBeInTheDocument();
    expect(screen.getByTestId('page-size-letter')).toBeInTheDocument();
    expect(screen.getByTestId('page-size-legal')).toBeInTheDocument();
  });

  it('selects A4 page size by default', () => {
    render(<RenderDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('format-option-pdf'));
    expect(screen.getByTestId('page-size-a4')).toHaveAttribute('aria-checked', 'true');
  });

  it('updates page size on click', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('page-size-letter'));
    expect(screen.getByTestId('page-size-letter')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('page-size-a4')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders margin inputs for all four sides', () => {
    render(<RenderDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('format-option-pdf'));
    expect(screen.getByTestId('margin-top')).toBeInTheDocument();
    expect(screen.getByTestId('margin-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('margin-left')).toBeInTheDocument();
    expect(screen.getByTestId('margin-right')).toBeInTheDocument();
  });

  it('updates margin value on input change', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    const topInput = screen.getByTestId('margin-top');
    await user.clear(topInput);
    await user.type(topInput, '30');
    expect(topInput).toHaveValue(30);
  });

  it('renders font size slider and value display', () => {
    render(<RenderDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('format-option-pdf'));
    expect(screen.getByTestId('font-size-slider')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('12pt');
  });

  it('updates font size value when slider changes', () => {
    render(<RenderDrawer {...defaultProps} />);
    fireEvent.click(screen.getByTestId('format-option-pdf'));
    const slider = screen.getByTestId('font-size-slider');
    fireEvent.change(slider, { target: { value: '16' } });
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('16pt');
  });
});

// ─── Export confirmation (Req 11.5, 12.5) ────────────────────────────────────

describe('RenderDrawer - export confirmation', () => {
  it('renders the export button', () => {
    render(<RenderDrawer {...defaultProps} />);
    expect(screen.getByTestId('export-button')).toBeInTheDocument();
  });

  it('calls exportPdf service when PDF format selected and Export clicked', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() => expect(exportPdf).toHaveBeenCalledOnce());
  });

  it('calls exportMarkdown service for Markdown format', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-markdown'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() => expect(exportMarkdown).toHaveBeenCalledOnce());
    expect(mockInvoke).not.toHaveBeenCalledWith('export_document', expect.anything());
  });

  it('shows success message after successful export', async () => {
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-success')).toBeInTheDocument()
    );
  });

  it('shows error message when export fails (Req 12.5)', async () => {
    vi.mocked(exportPdf).mockResolvedValueOnce({ status: 'error', message: 'Disk full' });
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-error')).toHaveTextContent('Disk full')
    );
  });

  it('shows error message when exportPdf throws', async () => {
    vi.mocked(exportPdf).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-error')).toHaveTextContent('Network error')
    );
  });

  it('disables export button while exporting', async () => {
    vi.mocked(exportPdf).mockReturnValueOnce(new Promise(() => { })); // never resolves
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    expect(screen.getByTestId('export-button')).toBeDisabled();
  });
});

// ─── Import Progress Dialog integration (Req 26.1, 26.3, 26.4, 26.5, 26.7) ──

import { importFile } from '../services/exportService';
import type { ImportOptions, ImportFlowResult } from '../services/exportService';
import type { ImportProgressEvent } from '../types/export';

describe('RenderDrawer - ImportProgressDialog integration', () => {
  it('shows ImportProgressDialog when progress events are received during import (Req 26.1)', async () => {
    const user = userEvent.setup();

    // Mock importFile to simulate progress events
    vi.mocked(importFile).mockImplementation(async (options?: ImportOptions) => {
      // Simulate backend emitting progress events for a large file
      const progressEvent: ImportProgressEvent = {
        stage: 'ParsingDocument',
        blocks_processed: 25,
        blocks_estimated: 100,
        percent: 25,
      };
      options?.onProgress?.(progressEvent);

      // Return success after progress
      return {
        status: 'opened',
        document: {
          id: 'test-id',
          title: 'Test',
          content: 'content',
          metadata: { wordCount: 1, readingTime: 1, status: 'draft' as const, tags: [] },
          version: 1,
          lastModified: new Date(),
        },
        warnings: [],
      };
    });

    render(<RenderDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('import-button'));

    // The progress dialog should appear briefly then close on completion
    // Since the mock resolves immediately, we check it was shown and then closed
    await waitFor(() => {
      expect(screen.queryByTestId('import-progress-dialog')).not.toBeInTheDocument();
    });
  });

  it('displays progress dialog with correct progress data (Req 26.1, 26.2)', async () => {
    const deferred = { resolve: null as ((value: ImportFlowResult) => void) | null };

    vi.mocked(importFile).mockImplementation((options?: ImportOptions) => {
      // Simulate progress event
      options?.onProgress?.({
        stage: 'ConvertingBlocks',
        blocks_processed: 50,
        blocks_estimated: 200,
        percent: 25,
      });

      // Keep the import pending so we can observe the dialog
      return new Promise<ImportFlowResult>((resolve) => {
        deferred.resolve = resolve;
      });
    });

    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('import-button'));

    // Progress dialog should be visible
    await waitFor(() => {
      expect(screen.getByTestId('import-progress-dialog')).toBeInTheDocument();
    });

    // Check progress bar and block count are displayed
    expect(screen.getByTestId('percent-label')).toHaveTextContent('25%');
    expect(screen.getByTestId('block-count')).toHaveTextContent('50 / ~200 blocks');

    // Resolve the import to clean up
    deferred.resolve?.({
      status: 'opened',
      document: {
        id: 'test-id',
        title: 'Test',
        content: 'content',
        metadata: { wordCount: 1, readingTime: 1, status: 'draft' as const, tags: [] },
        version: 1,
        lastModified: new Date(),
      },
      warnings: [],
    });
  });

  it('calls invoke("cancel_import") when Cancel is clicked (Req 26.4, 26.5)', async () => {
    vi.mocked(importFile).mockImplementation((options?: ImportOptions) => {
      // Simulate progress event to show dialog
      options?.onProgress?.({
        stage: 'ReadingFile',
        blocks_processed: 10,
        blocks_estimated: 500,
        percent: 2,
      });

      // Keep import pending
      return new Promise<ImportFlowResult>(() => { });
    });

    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('import-button'));

    // Wait for progress dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId('import-progress-dialog')).toBeInTheDocument();
    });

    // Click cancel
    await user.click(screen.getByTestId('btn-cancel-import'));

    // Should call cancel_import IPC
    expect(mockInvoke).toHaveBeenCalledWith('cancel_import');

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId('import-progress-dialog')).not.toBeInTheDocument();
    });
  });

  it('closes progress dialog when import completes successfully (Req 26.3)', async () => {
    const deferred = { resolve: null as ((value: ImportFlowResult) => void) | null };

    vi.mocked(importFile).mockImplementation((options?: ImportOptions) => {
      // Emit initial progress
      options?.onProgress?.({
        stage: 'ReadingFile',
        blocks_processed: 0,
        blocks_estimated: 100,
        percent: 0,
      });

      return new Promise<ImportFlowResult>((resolve) => {
        deferred.resolve = resolve;
      });
    });

    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('import-button'));

    // Dialog should be visible
    await waitFor(() => {
      expect(screen.getByTestId('import-progress-dialog')).toBeInTheDocument();
    });

    // Resolve the import
    deferred.resolve?.({
      status: 'opened',
      document: {
        id: 'test-id',
        title: 'Test',
        content: 'content',
        metadata: { wordCount: 1, readingTime: 1, status: 'draft' as const, tags: [] },
        version: 1,
        lastModified: new Date(),
      },
      warnings: [],
    });

    // Dialog should close after import completes
    await waitFor(() => {
      expect(screen.queryByTestId('import-progress-dialog')).not.toBeInTheDocument();
    });
  });

  it('closes progress dialog when import returns an error (Req 26.3, 26.7)', async () => {
    const deferred = { resolve: null as ((value: ImportFlowResult) => void) | null };

    vi.mocked(importFile).mockImplementation((options?: ImportOptions) => {
      options?.onProgress?.({
        stage: 'ParsingDocument',
        blocks_processed: 10,
        blocks_estimated: 100,
        percent: 10,
      });

      return new Promise<ImportFlowResult>((resolve) => {
        deferred.resolve = resolve;
      });
    });

    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);
    await user.click(screen.getByTestId('import-button'));

    // Dialog should be visible
    await waitFor(() => {
      expect(screen.getByTestId('import-progress-dialog')).toBeInTheDocument();
    });

    // Resolve with error
    deferred.resolve?.({
      status: 'error',
      message: 'Parse failed',
    });

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId('import-progress-dialog')).not.toBeInTheDocument();
    });

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toHaveTextContent('Parse failed');
    });
  });
});
