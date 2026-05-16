/**
 * Export-related types for WordAI Text Editor
 * Requirements: 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 28.1, 28.2
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

/**
 * Export progress types — mirrors Rust ExportStage and ExportProgressEvent.
 * Requirements: 28.1, 28.2
 */

/** Stage of a DOCX export operation, emitted as part of ExportProgressEvent. */
export type ExportStage = 'BuildingStructure' | 'WritingFile';

/** Progress event emitted during a large document export via Tauri event `export-progress`. */
export interface ExportProgressEvent {
  stage: ExportStage;
  blocks_processed: number;
  blocks_total: number;
  /** Percentage complete (0–100) */
  percent: number;
}

/**
 * Options for exportDocx — allows the caller to inject progress and cancel callbacks.
 * Requirements: 28.1, 28.2, 28.3
 */
export interface ExportDocxOptions {
  /** Called when export progress events are received from the Rust backend. */
  onProgress?: (progress: ExportProgressEvent) => void;
  /** Called to register a cancel function that the caller can invoke to abort export. */
  onCancel?: () => void;
}
