/**
 * Unit tests for RenderDrawer component
 * Requirements: 11.2, 11.3, 11.4, 11.5, 12.5
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenderDrawer } from './RenderDrawer';
import type { IPCResponse } from '../types/ipc';
import { exportMarkdown } from '../services/exportService';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('../services/exportService', () => ({
  exportMarkdown: vi.fn().mockResolvedValue({ status: 'success', path: '/path/to/file.md' }),
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
  it('renders all four export format options', () => {
    render(<RenderDrawer {...defaultProps} />);
    expect(screen.getByTestId('format-option-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-markdown')).toBeInTheDocument();
    expect(screen.getByTestId('format-option-html')).toBeInTheDocument();
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

  it('calls export_to_pdf Tauri command when PDF format selected and Export clicked', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: '/path/to/file.pdf' } satisfies IPCResponse<string>);
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledOnce());
    expect((mockInvoke as Mock).mock.calls[0][0]).toBe('export_to_pdf');
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
    mockInvoke.mockResolvedValue({ success: true, data: '/path/to/file.pdf' } satisfies IPCResponse<string>);
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-success')).toBeInTheDocument()
    );
  });

  it('shows error message when export fails (Req 12.5)', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Disk full' },
    } satisfies IPCResponse<string>);
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-error')).toHaveTextContent('Disk full')
    );
  });

  it('shows error message when invoke throws', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    await waitFor(() =>
      expect(screen.getByTestId('export-error')).toHaveTextContent('Network error')
    );
  });

  it('disables export button while exporting', async () => {
    mockInvoke.mockReturnValue(new Promise(() => { })); // never resolves
    const user = userEvent.setup();
    render(<RenderDrawer {...defaultProps} />);

    await user.click(screen.getByTestId('format-option-pdf'));
    await user.click(screen.getByTestId('export-button'));

    expect(screen.getByTestId('export-button')).toBeDisabled();
  });
});
