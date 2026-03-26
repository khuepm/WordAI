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
