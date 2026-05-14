/**
 * Converts a Unix timestamp (milliseconds) to a human-readable relative string.
 *
 * - < 1 min  → 'Just now'
 * - < 60 min → '{n}m ago'
 * - < 24 h   → '{n}h ago'
 * - < 7 d    → '{n}d ago'
 * - else     → toLocaleDateString()
 */
export function formatRelativeTime(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}
