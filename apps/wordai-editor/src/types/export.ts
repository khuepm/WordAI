/**
 * Export-related types for WordAI Text Editor
 * Requirements: 11.2, 11.3, 11.4, 12.1, 12.2, 12.3
 */

export type ExportFormat = 'pdf' | 'markdown' | 'html' | 'docx';

export type PageSize = 'A4' | 'Letter' | 'Legal';

export interface PDFExportOptions {
  pageSize: PageSize;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  fontSize: number;
}

export interface ExportOptions {
  format: ExportFormat;
  outputPath?: string;
  pdfOptions?: PDFExportOptions;
}

/**
 * Import progress types — mirrors Rust ImportStage and ImportProgressEvent.
 * Requirements: 26.1, 26.2, 26.4, 26.6
 */

/** Stage of an import operation, emitted as part of ImportProgressEvent. */
export type ImportStage =
  | 'ReadingFile'
  | 'ParsingDocument'
  | 'ConvertingBlocks'
  | 'SavingToAuraBrain';

/** Progress event emitted during a large file import via Tauri event `import-progress`. */
export interface ImportProgressEvent {
  stage: ImportStage;
  blocks_processed: number;
  blocks_estimated: number;
  /** Percentage complete (0–100) */
  percent: number;
}
