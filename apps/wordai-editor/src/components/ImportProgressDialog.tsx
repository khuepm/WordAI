/**
 * ImportProgressDialog - Shown during large file imports (>5MB) to display
 * real-time progress including stage, percentage, and block count.
 *
 * Requirements: 26.1, 26.2, 26.4
 */

import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import type { ImportProgressEvent, ImportStage } from '../types/export';

export interface ImportProgressDialogProps {
  isOpen: boolean;
  /** Current import progress event, null before first event arrives */
  progress: ImportProgressEvent | null;
  /** Called when user clicks Cancel to abort the import */
  onCancel: () => void;
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
};

const card: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
  padding: '2rem',
  width: '100%',
  maxWidth: '440px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  fontFamily: 'var(--font-family-ui, Inter, sans-serif)',
};

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  borderRadius: '0.625rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};

const progressBarContainer: CSSProperties = {
  width: '100%',
  height: '8px',
  borderRadius: '4px',
  background: 'rgba(67,67,213,0.1)',
  overflow: 'hidden',
};

/** Maps ImportStage to i18n translation key */
function getStageTranslationKey(stage: ImportStage): string {
  switch (stage) {
    case 'ReadingFile':
      return 'import.progress.stage.readingFile';
    case 'ParsingDocument':
      return 'import.progress.stage.parsingDocument';
    case 'ConvertingBlocks':
      return 'import.progress.stage.convertingBlocks';
    case 'SavingToAuraBrain':
      return 'import.progress.stage.savingToAuraBrain';
    default:
      return 'import.progress.stage.readingFile';
  }
}

export function ImportProgressDialog({
  isOpen,
  progress,
  onCancel,
}: ImportProgressDialogProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const percent = progress?.percent ?? 0;
  const blocksProcessed = progress?.blocks_processed ?? 0;
  const blocksEstimated = progress?.blocks_estimated ?? 0;
  const stageLabel = progress
    ? t(getStageTranslationKey(progress.stage))
    : t('import.progress.stage.readingFile');

  const blockCountText = `${blocksProcessed} / ~${blocksEstimated} blocks`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ipd-title"
      data-testid="import-progress-dialog"
      style={overlay}
    >
      <div style={card}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '0.75rem', flexShrink: 0,
            background: 'rgba(67,67,213,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span
              className="material-symbols-outlined"
              style={{ color: '#4343d5', fontSize: 24, fontVariationSettings: "'FILL' 1" }}
            >
              download
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <h2
              id="ipd-title"
              style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#18181b', lineHeight: 1.3 }}
            >
              {t('import.progress.title')}
            </h2>
            <p
              data-testid="import-stage-label"
              style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}
            >
              {stageLabel}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={progressBarContainer} data-testid="progress-bar-container">
            <div
              data-testid="progress-bar-fill"
              style={{
                width: `${Math.min(Math.max(percent, 0), 100)}%`,
                height: '100%',
                borderRadius: '4px',
                background: '#4343d5',
                transition: 'width 0.3s ease',
              }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a' }}>
            <span data-testid="block-count">{blockCountText}</span>
            <span data-testid="percent-label">{percent}%</span>
          </div>
        </div>

        {/* Cancel button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <button
            data-testid="btn-cancel-import"
            onClick={onCancel}
            style={{
              ...btnBase,
              background: 'transparent',
              color: '#71717a',
              justifyContent: 'center',
              border: '1px solid #e4e4e7',
            }}
          >
            {t('import.progress.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
