/**
 * Email normalization utilities.
 *
 * Requirements: 2.9
 */

/**
 * Normalize an email address by converting to lowercase and trimming
 * leading/trailing whitespace.
 *
 * This operation is idempotent: normalizeEmail(normalizeEmail(email)) === normalizeEmail(email)
 *
 * @param email - Raw email address string.
 * @returns Normalized email address.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
