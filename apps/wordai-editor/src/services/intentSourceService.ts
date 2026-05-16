/**
 * intentSourceService — Phát hiện định dạng nguồn của Intent
 *
 * Kiểm tra sourcePath extension (case-insensitive) trước, rồi kiểm tra bundle.
 * Không bao giờ throw — luôn fallback sang kind 'markdown'.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import type { PrismSourceFormat } from '../components/prism/types';
import { auraBundleService } from './auraBundleService';

/**
 * Intent-like interface cho detectSource.
 * Chấp nhận bất kỳ object nào có id và metadata tùy chọn.
 */
export interface IntentLike {
  id: string;
  metadata?: {
    sourcePath?: string | null;
    [key: string]: unknown;
  } | null;
}

/**
 * Phát hiện PrismSourceFormat từ intent.
 *
 * Algorithm:
 * 1. Kiểm tra intent.metadata?.sourcePath extension (case-insensitive):
 *    - .docx → { kind: 'docx', filePath: sourcePath }
 *    - .md hoặc .markdown → { kind: 'markdown', filePath: sourcePath }
 *    - .html hoặc .htm → { kind: 'html', filePath: sourcePath }
 * 2. Nếu không match extension, kiểm tra auraBundleService.loadBundle(intent.id)
 *    - Nếu bundle tồn tại → { kind: 'aura', bundle }
 * 3. Fallback → { kind: 'markdown' }
 *
 * CRITICAL: Không bao giờ throw — wrap mọi thứ trong try/catch.
 */
export function detectSource(intent: IntentLike | null | undefined): PrismSourceFormat {
  try {
    if (!intent) {
      return { kind: 'markdown' };
    }

    const sourcePath = intent.metadata?.sourcePath;

    if (sourcePath && typeof sourcePath === 'string' && sourcePath.trim().length > 0) {
      const lowerPath = sourcePath.toLowerCase();

      if (lowerPath.endsWith('.docx')) {
        return { kind: 'docx', filePath: sourcePath };
      }

      if (lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown')) {
        return { kind: 'markdown', filePath: sourcePath };
      }

      if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) {
        return { kind: 'html', filePath: sourcePath };
      }
    }

    // Kiểm tra .aura bundle trong store
    try {
      const bundle = auraBundleService.loadBundle(intent.id);
      if (bundle) {
        return { kind: 'aura', bundle };
      }
    } catch {
      // auraBundleService lỗi → fallback
    }

    // Fallback: coi như Markdown thuần
    return { kind: 'markdown' };
  } catch {
    // Không bao giờ throw — fallback sang markdown
    return { kind: 'markdown' };
  }
}

export const intentSourceService = {
  detectSource,
};
