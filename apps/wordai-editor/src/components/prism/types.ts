/**
 * Prism Multi-Variant Editor — Type Definitions
 *
 * Core types cho hệ thống quản lý đa biến thể nội dung.
 * Prism hỗ trợ tối đa 3 slot variant cạnh nhau với chế độ Preview/Code.
 */

/** Index hợp lệ cho slot trong PrismState (tối đa 3 slot: 0, 1, 2) */
export type PrismSlotIndex = 0 | 1 | 2;

/** Chế độ xem của một variant pane */
export type PrismViewMode = 'preview' | 'code';

/** Sub-tab trong Code view */
export type PrismCodeSubTab = 'markdown' | 'aura' | 'ooxml' | 'html';

/**
 * Discriminated union mô tả nguồn gốc của variant.
 * - markdown: file .md hoặc nội dung thuần
 * - html: file .html/.htm
 * - docx: file .docx (luôn readonly, bắt buộc có filePath)
 * - aura: variant từ AuraSphere synthesis
 */
export type PrismSourceFormat =
  | { kind: 'markdown'; filePath?: string }
  | { kind: 'html'; filePath?: string }
  | { kind: 'docx'; filePath: string }
  | { kind: 'aura'; bundle: AuraBundle };

/**
 * Đại diện cho một biến thể nội dung trong Prism.
 */
export interface PrismVariant {
  /** UUID ổn định trong session, dùng làm React key */
  id: string;
  /** Tên hiển thị: "Trang trọng" / "Thân mật" / tên do user đặt */
  label: string;
  /** JSON string cho react-block-text */
  blockContent: string;
  /** Nguồn gốc của variant */
  source: PrismSourceFormat;
  /** ID prompt AuraSphere nếu do AI sinh */
  promptRef?: string;
  /** true = không bị ghi đè khi AuraSphere push */
  pinned: boolean;
  /** true = có thay đổi chưa persist */
  dirty: boolean;
}

/**
 * Trạng thái runtime của Prism editor.
 * Mảng slots/modes/codeSubTabs luôn có length === 3.
 */
export interface PrismState {
  /** 3 slot variant, null = slot trống */
  slots: (PrismVariant | null)[];
  /** Chế độ xem song song với slots */
  modes: PrismViewMode[];
  /** Sub-tab Code view song song với slots */
  codeSubTabs: PrismCodeSubTab[];
  /** Slot đang active */
  focusedSlot: PrismSlotIndex;
  /** Đồng bộ scroll giữa các pane */
  syncScroll: boolean;
}

/**
 * File JSON lưu trữ các variant của một Intent, theo schema v1.
 */
export interface AuraBundle {
  $schema: 'https://wordai.app/schemas/aura/v1.json';
  version: 1;
  intentId: string;
  canonical: 'markdown';
  markdown: string;
  variants: AuraVariantEntry[];
  promotedVariantId: string | null;
  /** ISO 8601 */
  lastModified: string;
}

/**
 * Một entry variant trong AuraBundle.
 */
export interface AuraVariantEntry {
  id: string;
  label: string;
  markdown: string;
  createdBy: 'user' | 'aurasphere';
  promptRef?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601, undefined = active */
  archivedAt?: string;
}

/**
 * Suggestion từ AuraSphere chứa 1-3 variant gợi ý.
 */
export interface AuraSphereSuggestion {
  variants: {
    label: string;
    markdown: string;
    promptRef: string;
  }[];
}
