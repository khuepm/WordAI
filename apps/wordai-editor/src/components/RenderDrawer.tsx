import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';
import type { ExportFormat, ExportOptions, PDFExportOptions, PageSize } from '../types/export';
import type { IPCResponse } from '../types/ipc';
import { defaultPreferences } from '../types/preferences';
import { exportDocx, exportMarkdown, importFile, type ConflictResolutionCallback } from '../services/exportService';
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
  { id: 'html', label: 'HTML', description: 'Web-ready document' },
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

    const options: ExportOptions = {
      format: selectedFormat,
      ...(selectedFormat === 'pdf' ? { pdfOptions } : {}),
    };

    try {
      if (selectedFormat === 'markdown') {
        const result = await exportMarkdown(currentDocument);
        if (result.status === 'cancelled') return;
        if (result.status === 'error') {
          setExportStatus('error');
          setExportError(result.message);
          return;
        }
        setStatusText(`Export complete: ${result.path}`);
        setExportStatus('success');
        return;
      }

      if (selectedFormat === 'docx') {
        const result = await exportDocx(currentDocument);
        if (result.status === 'cancelled') return;
        if (result.status === 'error') {
          setExportStatus('error');
          setExportError(result.message);
          return;
        }
        setStatusText(`Export complete: ${result.path}`);
        setExportStatus('success');
        return;
      }

      const res = await invoke<IPCResponse<string>>('export_to_pdf', {
        content: currentDocument.content,
        outputPath: '',
        options,
      });

      if (res.success) {
        setStatusText(res.data ? `Export complete: ${res.data}` : 'Export complete');
        setExportStatus('success');
      } else {
        setExportStatus('error');
        setExportError(res.error?.message ?? 'Export failed.');
      }
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
            x
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
    background: 'rgba(254, 247, 255, 0.85)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    borderBottom: 'none',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    boxShadow: 'var(--shadow-ambient-strong)',
    transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease',
  },
  drawerOpen: { transform: 'translateY(0)', opacity: 1 },
  drawerClosed: { transform: 'translateY(100%)', opacity: 0 },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--md-sys-color-outline-variant)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-base)',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-lg)',
  },
  footer: {
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderTop: '1px solid var(--md-sys-color-outline-variant)',
    flexShrink: 0,
    display: 'flex',
    gap: 'var(--spacing-sm)',
  },
  exportBtn: {
    flex: 1,
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    background: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  secondaryBtn: {
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    background: 'rgba(255,255,255,0.7)',
    color: 'var(--md-sys-color-primary)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 500,
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
    background: '#d4edda',
    color: '#155724',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
  },
  errorMsg: {
    background: 'var(--md-sys-color-error-container)',
    color: 'var(--md-sys-color-on-error-container)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
  },
  warningMsg: {
    background: 'rgba(180,120,0,0.1)',
    color: '#7a4d00',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
  },
};

const subStyles: Record<string, React.CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' },
  sectionLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--font-family-ui)',
  },
  formatGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--spacing-sm)',
  },
  formatBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: 'var(--spacing-sm)',
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
  },
  formatBtnSelected: {
    background: 'var(--md-sys-color-primary-container)',
    borderColor: 'var(--md-sys-color-primary)',
  },
  formatLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
  },
  formatDesc: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    textAlign: 'center',
  },
  pageSizeRow: { display: 'flex', gap: 'var(--spacing-sm)' },
  pageSizeBtn: {
    padding: 'var(--spacing-xs) var(--spacing-md)',
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
  },
  pageSizeBtnSelected: {
    background: 'var(--md-sys-color-primary-container)',
    borderColor: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary-container)',
  },
  marginsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--spacing-sm)',
  },
  marginLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
  marginSideLabel: { textTransform: 'capitalize' },
  marginInput: {
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'var(--font-family-ui)',
  },
  fontSizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
  },
  fontSizeSlider: { flex: 1 },
  fontSizeValue: {
    minWidth: '48px',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
  },
};

export default RenderDrawer;
