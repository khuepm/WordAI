/**
 * aiAccessState — Derives the client-side AI access state from an Access Context.
 *
 * This is a pure function with no side effects. It is the single source of
 * truth for translating server-side authorization data into the four UI states
 * that gate AI features in the Client App.
 *
 * Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import type { AccessContext, AIAccessState } from '../types/auth';

/**
 * Derive the AI access state from an Access Context.
 *
 * Decision table (evaluated top-to-bottom, first match wins):
 *
 * | context | user.status   | used_quota vs monthly_quota | ai_enabled | result          |
 * |---------|---------------|-----------------------------|------------|-----------------|
 * | null    | —             | —                           | —          | "guest"         |
 * | present | "suspended"   | —                           | —          | "suspended"     |
 * | present | "deleted"     | —                           | —          | "suspended"     |
 * | present | "active"      | used >= monthly             | —          | "quota_exceeded"|
 * | present | "active"      | used < monthly              | false      | "suspended"     |
 * | present | "active"      | used < monthly              | true       | "active"        |
 * | present | "pending"     | —                           | —          | "guest"         |
 *
 * Requirements: 13.4 → "guest" when no active session (null context)
 * Requirements: 13.5 → "active" when status=active, used_quota < monthly_quota, ai_enabled=true
 * Requirements: 13.6 → "quota_exceeded" when status=active and used_quota >= monthly_quota
 * Requirements: 13.7 → "suspended" when status=suspended
 *
 * @param context - The current Access Context, or null when no session is active.
 * @returns The derived AI access state.
 */
export function deriveAIAccessState(
  context: AccessContext | null,
): AIAccessState {
  // Req 13.4 — no active session → guest
  if (context === null) {
    return 'guest';
  }

  const { status } = context.user;
  const { ai_enabled, used_quota, monthly_quota } = context.entitlement;

  // Req 13.7 — suspended or deleted accounts
  if (status === 'suspended' || status === 'deleted') {
    return 'suspended';
  }

  // Pending users have not been activated yet — treat as guest
  if (status === 'pending') {
    return 'guest';
  }

  // status === 'active' from here on

  // Req 13.6 — quota exhausted takes priority over ai_enabled check
  if (used_quota >= monthly_quota) {
    return 'quota_exceeded';
  }

  // Req 13.5 — ai_enabled must be true for full access
  if (!ai_enabled) {
    return 'suspended';
  }

  // Req 13.5 — all conditions met
  return 'active';
}
