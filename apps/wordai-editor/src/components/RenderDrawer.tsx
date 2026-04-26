import { useCallback, useEffect, useState } from 'react';
import type { Document } from '../types/document';
import type { ExportFormat, PDFExportOptions, PageSize } from '../types/export';
import { defaultPreferences } from '../types/preferences';
import { exportDocx, exportMarkdown, exportPdf, importFile, type ConflictResolutionCallback } from '../services/exportService';
import { loadPreferences } from '../services/preferencesService';
import { ReplaceConfirmationDialog } from './ReplaceConfirmationDialog';

export interface RenderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  document?: Document;
  documentId?: string;
  documentContent?: string;
  onImportDocument?: (document: Document) => void;
}

const FORMATS: { id: ExportFormat; label: string; description: string }[] = [
  { id: 'pdf', label: 'PDF', description: 'Portable Document Format' },
  { id: 'markdown', label: 'Markdown', description: 'Plain-text with formatting' },
  { id: 'docx', label: 'DOCX', description: 'Microsoft Word document' },
];

const PAGE_SIZES: PageSize[] = ['A4', 'Letter', 'Legal'];

const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
  pageSize: 'A4',
  margins: { top: 25, bottom: 25, left: 25, right: 25 },
  fontSize: 12,
};

export function RenderDrawer({ isOpen, onClose, document: documentProp, documentId, documentContent, onImportDocument }: RenderDrawerProps) {
  const currentDocument: Document = documentProp ?? {
    id: documentId ?? 'unsaved-document',
    title: 'Untitled Intent',
    content: documentContent ?? '',
    metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
    version: 1,
    lastModified: new Date(),
  };
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultPreferences.general.defaultExportFormat);
  const [pdfOptions, setPdfOptions] = useState<PDFExportOptions>(DEFAULT_PDF_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [conflict, setConflict] = useState<{
    intentName: string;
    auraIntentId: string;
    resolve: (choice: 'update' | 'create_new' | 'cancel') => void;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setExportStatus('idle');
      setExportError(null);
      setStatusText(null);
      setImportWarnings([]);
      setConflict(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    loadPreferences('default')
      .then((preferences) => {
        const format = preferences?.general?.defaultExportFormat;
        if (!cancelled && (format === 'markdown' || format === 'docx')) {
          setSelectedFormat(format);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedFormat(defaultPreferences.general.defaultExportFormat);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleFormatSelect = useCallback((format: ExportFormat) => {
    setSelectedFormat(format);
    setExportStatus('idle');
    setExportError(null);
    setStatusText(null);
  }, []);

  const handlePdfOptionChange = useCallback(
    <K extends keyof PDFExportOptions>(key: K, value: PDFExportOptions[K]) => {
      setPdfOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleMarginChange = useCallback((side: keyof PDFExportOptions['margins'], value: number) => {
    setPdfOptions((prev) => ({
      ...prev,
      margins: { ...prev.margins, [side]: value },
    }));
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setExportError(null);
    setStatusText(null);

    try {
      let result;
      if (selectedFormat === 'markdown') {
        result = await exportMarkdown(currentDocument);
      } else if (selectedFormat === 'docx') {
        result = await exportDocx(currentDocument);
      } else if (selectedFormat === 'pdf') {
        result = await exportPdf(currentDocument, pdfOptions);
      } else {
        setExportStatus('error');
        setExportError(`Export format "${selectedFormat}" is not supported.`);
        return;
      }

      if (result.status === 'cancelled') return;
      if (result.status === 'error') {
        setExportStatus('error');
        setExportError(result.message);
        return;
      }
      setStatusText(`Export complete: ${result.path}`);
      setExportStatus('success');
    } catch (err: unknown) {
      setExportStatus('error');
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }, [selectedFormat, pdfOptions, currentDocument]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setExportStatus('idle');
    setExportError(null);
    setStatusText(null);
    setImportWarnings([]);

    const onConflict: ConflictResolutionCallback = (intentName, auraIntentId) =>
      new Promise((resolve) => setConflict({ intentName, auraIntentId, resolve }));

    try {
      const result = await importFile({ onConflict, onOpenIntent: onImportDocument });
      if (result.status === 'cancelled') return;
      if (result.status === 'error') {
        setExportStatus('error');
        setExportError(result.message);
        return;
      }
      setImportWarnings(result.warnings);
      onImportDocument?.(result.document);
      setStatusText('Import complete');
      setExportStatus('success');
    } finally {
      setIsImporting(false);
    }
  }, [onImportDocument]);

  return (
    <div
      style={{
        ...styles.backdrop,
        ...(isOpen ? styles.backdropVisible : styles.backdropHidden),
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden={!isOpen}
    >
      <div
        role="dialog"
        aria-label="Export document"
        aria-modal="true"
        data-testid="render-drawer"
        style={{
          ...styles.drawer,
          ...(isOpen ? styles.drawerOpen : styles.drawerClosed),
        }}
      >
        <div style={styles.header}>
          <span style={styles.title}>Export Document</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close export drawer" data-testid="drawer-close-button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={styles.body}>
          <FormatSelector formats={FORMATS} selected={selectedFormat} onSelect={handleFormatSelect} />

          {selectedFormat === 'pdf' && (
            <PDFOptions
              options={pdfOptions}
              onOptionChange={handlePdfOptionChange}
              onMarginChange={handleMarginChange}
            />
          )}

          {exportStatus === 'success' && (
            <div style={styles.successMsg} role="status" data-testid="export-success">
              {statusText ?? 'Export complete'}
            </div>
          )}
          {exportStatus === 'error' && exportError && (
            <div style={styles.errorMsg} role="alert" data-testid="export-error">
              {exportError}
            </div>
          )}
          {importWarnings.length > 0 && (
            <div style={styles.warningMsg} role="status" data-testid="import-warnings">
              Unsupported elements: {importWarnings.join(', ')}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.secondaryBtn, ...(isImporting ? styles.exportBtnDisabled : {}) }}
            onClick={handleImport}
            disabled={isImporting}
            data-testid="import-button"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button
            style={{ ...styles.exportBtn, ...(isExporting ? styles.exportBtnDisabled : {}) }}
            onClick={handleExport}
            disabled={isExporting}
            aria-label={`Export as ${selectedFormat.toUpperCase()}`}
            data-testid="export-button"
          >
            {isExporting ? (
              <span style={styles.exportingRow}>
                <span style={styles.spinner} aria-hidden="true" />
                Exporting...
              </span>
            ) : (
              `Export as ${selectedFormat.toUpperCase()}`
            )}
          </button>
        </div>
      </div>

      <ReplaceConfirmationDialog
        isOpen={conflict !== null}
        intentName={conflict?.intentName ?? ''}
        auraIntentId={conflict?.auraIntentId ?? ''}
        onUpdateIntent={() => {
          conflict?.resolve('update');
          setConflict(null);
        }}
        onCreateNew={() => {
          conflict?.resolve('create_new');
          setConflict(null);
        }}
        onCancel={() => {
          conflict?.resolve('cancel');
          setConflict(null);
        }}
      />
    </div>
  );
}

interface FormatSelectorProps {
  formats: typeof FORMATS;
  selected: ExportFormat;
  onSelect: (f: ExportFormat) => void;
}

function FormatSelector({ formats, selected, onSelect }: FormatSelectorProps) {
  return (
    <div style={subStyles.section}>
      <div style={subStyles.sectionLabel}>Format</div>
      <div style={subStyles.formatGrid} role="radiogroup" aria-label="Export format">
        {formats.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={selected === f.id}
            data-testid={`format-option-${f.id}`}
            style={{ ...subStyles.formatBtn, ...(selected === f.id ? subStyles.formatBtnSelected : {}) }}
            onClick={() => onSelect(f.id)}
          >
            <span style={subStyles.formatLabel}>{f.label}</span>
            <span style={subStyles.formatDesc}>{f.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PDFOptionsProps {
  options: PDFExportOptions;
  onOptionChange: <K extends keyof PDFExportOptions>(key: K, value: PDFExportOptions[K]) => void;
  onMarginChange: (side: keyof PDFExportOptions['margins'], value: number) => void;
}

function PDFOptions({ options, onOptionChange, onMarginChange }: PDFOptionsProps) {
  return (
    <div style={subStyles.section} data-testid="pdf-options">
      <div style={subStyles.sectionLabel}>Page Size</div>
      <div style={subStyles.pageSizeRow} role="radiogroup" aria-label="Page size">
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            role="radio"
            aria-checked={options.pageSize === size}
            data-testid={`page-size-${size.toLowerCase()}`}
            style={{ ...subStyles.pageSizeBtn, ...(options.pageSize === size ? subStyles.pageSizeBtnSelected : {}) }}
            onClick={() => onOptionChange('pageSize', size)}
          >
            {size}
          </button>
        ))}
      </div>

      <div style={subStyles.sectionLabel}>Margins (mm)</div>
      <div style={subStyles.marginsGrid}>
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <label key={side} style={subStyles.marginLabel}>
            <span style={subStyles.marginSideLabel}>{side.charAt(0).toUpperCase() + side.slice(1)}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={options.margins[side]}
              onChange={(e) => onMarginChange(side, Number(e.target.value))}
              style={subStyles.marginInput}
              aria-label={`${side} margin`}
              data-testid={`margin-${side}`}
            />
          </label>
        ))}
      </div>

      <div style={subStyles.sectionLabel}>Font Size (pt)</div>
      <div style={subStyles.fontSizeRow}>
        <input
          type="range"
          min={8}
          max={24}
          step={1}
          value={options.fontSize}
          onChange={(e) => onOptionChange('fontSize', Number(e.target.value))}
          style={subStyles.fontSizeSlider}
          aria-label="Font size"
          data-testid="font-size-slider"
        />
        <span style={subStyles.fontSizeValue} data-testid="font-size-value">{options.fontSize}pt</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 150,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    transition: 'background var(--transition-normal)',
  },
  backdropVisible: {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    pointerEvents: 'auto',
  },
  backdropHidden: {
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    pointerEvents: 'none',
  },
  drawer: {
    width: '100%',
    maxWidth: '720px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-family-ui)',
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: 'none',
    borderBottom: 'none',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    boxShadow: '0 0 40px -5px rgba(67,67,213,0.08), 0 -20px 60px rgba(0,0,0,0.08)',
    transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease',
  },
  drawerOpen: { transform: 'translateY(0)', opacity: 1 },
  drawerClosed: { transform: 'translateY(100%)', opacity: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px',
    padding: '0 2rem',
    borderBottom: '1px solid rgba(199,196,215,0.12)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#18181b',
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#a1a1aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '0.5rem',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  footer: {
    height: '80px',
    padding: '0 2rem',
    borderTop: '1px solid rgba(199,196,215,0.1)',
    background: '#fafafa',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  exportBtn: {
    padding: '0.625rem 2rem',
    background: '#4343d5',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 4px 12px rgba(67,67,213,0.2)',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    padding: '0.625rem 1.5rem',
    background: 'none',
    color: '#52525b',
    border: 'none',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  exportBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  exportingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  successMsg: {
    background: 'rgba(16,185,129,0.08)',
    color: '#065f46',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  errorMsg: {
    background: 'rgba(239,68,68,0.08)',
    color: '#991b1b',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  warningMsg: {
    background: 'rgba(245,158,11,0.08)',
    color: '#92400e',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
};

const subStyles: Record<string, React.CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-family-ui)',
  },
  formatGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
  },
  formatBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '1rem',
    background: '#f3f4f5',
    border: '2px solid transparent',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    transition: 'all 0.2s',
  },
  formatBtnSelected: {
    background: 'rgba(67,67,213,0.05)',
    borderColor: 'rgba(67,67,213,0.4)',
  },
  formatLabel: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#18181b',
  },
  formatDesc: {
    fontSize: '11px',
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  pageSizeRow: { display: 'flex', gap: '0.75rem' },
  pageSizeBtn: {
    padding: '0.5rem 1rem',
    background: '#f3f4f5',
    border: '2px solid transparent',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#18181b',
    transition: 'all 0.2s',
  },
  pageSizeBtnSelected: {
    background: 'rgba(67,67,213,0.05)',
    borderColor: 'rgba(67,67,213,0.4)',
    color: '#4343d5',
  },
  marginsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
  },
  marginLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#71717a',
  },
  marginSideLabel: { textTransform: 'capitalize', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' },
  marginInput: {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#f3f4f5',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  fontSizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  fontSizeSlider: { flex: 1, accentColor: '#4343d5' },
  fontSizeValue: {
    minWidth: '48px',
    fontFamily: 'var(--font-family-ui)',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#4343d5',
    background: 'rgba(67,67,213,0.08)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
};

export default RenderDrawer;
