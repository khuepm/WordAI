/**
 * RenderDrawer - Render-on-Demand export panel (slide-up from bottom)
 * Requirements: 11.1–11.5, 12.5, 18.1, 19.2, 20.4, 21.3, 21.4
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ExportFormat, ExportOptions, PDFExportOptions, PageSize } from '../types/export';
import type { IPCResponse } from '../types/ipc';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RenderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentContent: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── RenderDrawer ─────────────────────────────────────────────────────────────

export function RenderDrawer({ isOpen, onClose, documentId, documentContent }: RenderDrawerProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [pdfOptions, setPdfOptions] = useState<PDFExportOptions>(DEFAULT_PDF_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState<string | null>(null);

  // Reset status when drawer opens/closes
  useEffect(() => {
    if (!isOpen) {
      setExportStatus('idle');
      setExportError(null);
    }
  }, [isOpen]);

  // Escape key closes the drawer (Req 21.4)
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
  }, []);

  const handlePdfOptionChange = useCallback(
    <K extends keyof PDFExportOptions>(key: K, value: PDFExportOptions[K]) => {
      setPdfOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleMarginChange = useCallback(
    (side: keyof PDFExportOptions['margins'], value: number) => {
      setPdfOptions((prev) => ({
        ...prev,
        margins: { ...prev.margins, [side]: value },
      }));
    },
    []
  );

  // Trigger export (Req 11.5, 12.5)
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportStatus('idle');
    setExportError(null);

    const options: ExportOptions = {
      format: selectedFormat,
      ...(selectedFormat === 'pdf' ? { pdfOptions } : {}),
    };

    try {
      const command = selectedFormat === 'pdf' ? 'export_to_pdf' : 'export_document';
      const res = await invoke<IPCResponse<string>>(command, {
        documentId,
        content: documentContent,
        options,
      });

      if (res.success) {
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
  }, [selectedFormat, pdfOptions, documentId, documentContent]);

  return (
    // Backdrop
    <div
      style={{
        ...styles.backdrop,
        ...(isOpen ? styles.backdropVisible : styles.backdropHidden),
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden={!isOpen}
    >
      {/* Drawer panel */}
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
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Export Document</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close export drawer"
            data-testid="drawer-close-button"
          >
            ✕
          </button>
        </div>

        <div style={styles.body}>
          {/* Format selection (Req 11.2, 11.3) */}
          <FormatSelector
            formats={FORMATS}
            selected={selectedFormat}
            onSelect={handleFormatSelect}
          />

          {/* PDF-specific options (Req 11.4) */}
          {selectedFormat === 'pdf' && (
            <PDFOptions
              options={pdfOptions}
              onOptionChange={handlePdfOptionChange}
              onMarginChange={handleMarginChange}
            />
          )}

          {/* Export status feedback */}
          {exportStatus === 'success' && (
            <div style={styles.successMsg} role="status" data-testid="export-success">
              ✓ Export complete
            </div>
          )}
          {exportStatus === 'error' && exportError && (
            <div style={styles.errorMsg} role="alert" data-testid="export-error">
              {exportError}
            </div>
          )}
        </div>

        {/* Footer with Export button */}
        <div style={styles.footer}>
          <button
            style={{
              ...styles.exportBtn,
              ...(isExporting ? styles.exportBtnDisabled : {}),
            }}
            onClick={handleExport}
            disabled={isExporting}
            aria-label={`Export as ${selectedFormat.toUpperCase()}`}
            data-testid="export-button"
          >
            {isExporting ? (
              <span style={styles.exportingRow}>
                <span style={styles.spinner} aria-hidden="true" />
                Exporting…
              </span>
            ) : (
              `Export as ${selectedFormat.toUpperCase()}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FormatSelector sub-component ────────────────────────────────────────────

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
            style={{
              ...subStyles.formatBtn,
              ...(selected === f.id ? subStyles.formatBtnSelected : {}),
            }}
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

// ─── PDFOptions sub-component ─────────────────────────────────────────────────

interface PDFOptionsProps {
  options: PDFExportOptions;
  onOptionChange: <K extends keyof PDFExportOptions>(key: K, value: PDFExportOptions[K]) => void;
  onMarginChange: (side: keyof PDFExportOptions['margins'], value: number) => void;
}

function PDFOptions({ options, onOptionChange, onMarginChange }: PDFOptionsProps) {
  return (
    <div style={subStyles.section} data-testid="pdf-options">
      {/* Page size */}
      <div style={subStyles.sectionLabel}>Page Size</div>
      <div style={subStyles.pageSizeRow} role="radiogroup" aria-label="Page size">
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            role="radio"
            aria-checked={options.pageSize === size}
            data-testid={`page-size-${size.toLowerCase()}`}
            style={{
              ...subStyles.pageSizeBtn,
              ...(options.pageSize === size ? subStyles.pageSizeBtnSelected : {}),
            }}
            onClick={() => onOptionChange('pageSize', size)}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Margins */}
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

      {/* Font size */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    // Glassmorphism (Req 18.1, 18.2, 18.3, 18.4)
    background: 'rgba(254, 247, 255, 0.85)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    borderBottom: 'none',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    boxShadow: 'var(--shadow-ambient-strong)',
    // Slide-up animation (Req 20.4)
    transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease',
  },
  drawerOpen: {
    transform: 'translateY(0)',
    opacity: 1,
  },
  drawerClosed: {
    transform: 'translateY(100%)',
    opacity: 0,
  },
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
    letterSpacing: '0.02em',
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
  },
  exportBtn: {
    width: '100%',
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
  exportBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
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
};

const subStyles: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
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
    transition: 'border-color var(--transition-fast), background var(--transition-fast)',
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
  pageSizeRow: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
  },
  pageSizeBtn: {
    padding: 'var(--spacing-xs) var(--spacing-md)',
    background: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    transition: 'border-color var(--transition-fast), background var(--transition-fast)',
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
  },
  marginSideLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
  marginInput: {
    width: '100%',
    padding: 'var(--spacing-xs)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--md-sys-color-on-surface)',
    boxSizing: 'border-box',
  },
  fontSizeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
  },
  fontSizeSlider: {
    flex: 1,
    accentColor: 'var(--md-sys-color-primary)',
  },
  fontSizeValue: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'var(--font-family-ui)',
    minWidth: '32px',
    textAlign: 'right',
  },
};

export default RenderDrawer;
