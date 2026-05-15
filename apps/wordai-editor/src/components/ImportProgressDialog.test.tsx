/**
 * Unit tests for ImportProgressDialog
 * Requirements: 26.1, 26.2, 26.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportProgressDialog } from './ImportProgressDialog';
import type { ImportProgressEvent, ImportStage } from '../types/export';

describe('ImportProgressDialog', () => {
  const defaultProgress: ImportProgressEvent = {
    stage: 'ReadingFile',
    blocks_processed: 10,
    blocks_estimated: 50,
    percent: 20,
  };

  const defaultProps = {
    isOpen: true,
    progress: defaultProgress,
    onCancel: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImportProgressDialog {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the dialog when isOpen is true', () => {
    render(<ImportProgressDialog {...defaultProps} />);
    expect(screen.getByTestId('import-progress-dialog')).toBeInTheDocument();
  });

  describe('stage labels (Req 26.1)', () => {
    const stageLabelMap: Record<ImportStage, string> = {
      ReadingFile: 'Reading file...',
      ParsingDocument: 'Parsing document...',
      ConvertingBlocks: 'Converting blocks...',
      SavingToAuraBrain: 'Saving to AuraBrain...',
    };

    it.each(Object.entries(stageLabelMap))(
      'displays correct label for stage "%s"',
      (stage, expectedLabel) => {
        const progress: ImportProgressEvent = {
          ...defaultProgress,
          stage: stage as ImportStage,
        };
        render(
          <ImportProgressDialog {...defaultProps} progress={progress} />
        );
        expect(screen.getByTestId('import-stage-label')).toHaveTextContent(
          expectedLabel
        );
      }
    );
  });

  describe('progress bar (Req 26.2)', () => {
    it('sets progress bar width based on percent value', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{ ...defaultProgress, percent: 45 }}
        />
      );
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '45%' });
    });

    it('clamps progress bar width to 0% minimum', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{ ...defaultProgress, percent: -5 }}
        />
      );
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
    });

    it('clamps progress bar width to 100% maximum', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{ ...defaultProgress, percent: 120 }}
        />
      );
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });

    it('displays percent label', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{ ...defaultProgress, percent: 73 }}
        />
      );
      expect(screen.getByTestId('percent-label')).toHaveTextContent('73%');
    });
  });

  describe('block count (Req 26.4)', () => {
    it('displays block count in "{processed} / ~{estimated} blocks" format', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{
            ...defaultProgress,
            blocks_processed: 25,
            blocks_estimated: 100,
          }}
        />
      );
      expect(screen.getByTestId('block-count')).toHaveTextContent(
        '25 / ~100 blocks'
      );
    });

    it('displays zero counts when progress has zero values', () => {
      render(
        <ImportProgressDialog
          {...defaultProps}
          progress={{
            ...defaultProgress,
            blocks_processed: 0,
            blocks_estimated: 0,
          }}
        />
      );
      expect(screen.getByTestId('block-count')).toHaveTextContent(
        '0 / ~0 blocks'
      );
    });
  });

  describe('cancel button', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<ImportProgressDialog {...defaultProps} onCancel={onCancel} />);
      const cancelBtn = screen.getByTestId('btn-cancel-import');
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('default state when progress is null', () => {
    it('shows default stage label when progress is null', () => {
      render(
        <ImportProgressDialog isOpen={true} progress={null} onCancel={vi.fn()} />
      );
      expect(screen.getByTestId('import-stage-label')).toHaveTextContent(
        'Reading file...'
      );
    });

    it('shows 0% progress when progress is null', () => {
      render(
        <ImportProgressDialog isOpen={true} progress={null} onCancel={vi.fn()} />
      );
      const fill = screen.getByTestId('progress-bar-fill');
      expect(fill).toHaveStyle({ width: '0%' });
      expect(screen.getByTestId('percent-label')).toHaveTextContent('0%');
    });

    it('shows "0 / ~0 blocks" when progress is null', () => {
      render(
        <ImportProgressDialog isOpen={true} progress={null} onCancel={vi.fn()} />
      );
      expect(screen.getByTestId('block-count')).toHaveTextContent(
        '0 / ~0 blocks'
      );
    });
  });
});
