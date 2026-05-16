/**
 * auraBundleService — Load/save .aura bundle files
 *
 * Stub implementation — sẽ được implement đầy đủ trong task 7.2.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 */

import type { AuraBundle } from '../components/prism/types';

/**
 * Load AuraBundle cho intentId từ app data dir.
 * Trả về null nếu không tìm thấy hoặc file invalid.
 */
function loadBundle(_intentId: string): AuraBundle | null {
  // TODO: Implement trong task 7.2
  return null;
}

/**
 * Save AuraBundle vào app data dir.
 * Validate trước khi ghi, throw nếu validation thất bại.
 */
async function saveBundle(_bundle: AuraBundle): Promise<void> {
  // TODO: Implement trong task 7.2
}

export const auraBundleService = {
  loadBundle,
  saveBundle,
};
