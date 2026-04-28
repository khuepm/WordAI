/**
 * AIAccessGate — Component that gates AI features based on AI access state.
 *
 * Wraps AI-related UI and displays appropriate messages when AI features
 * are unavailable due to guest status, quota exhaustion, or account suspension.
 *
 * Requirements: 13.8, 13.9, 13.10, 13.11
 */

import { type ReactNode } from 'react';
import { useAIAccessState, useAccessContext } from '../services/authStore';
import type { AIAccessState } from '../types/auth';

export interface AIAccessGateProps {
  /** Content to render when AI access is "active". */
  children: ReactNode;
  /** Optional callback when user clicks "Sign In" in guest state. */
  onSignInClick?: () => void;
}

/**
 * Gate AI features based on the current AI access state.
 *
 * - "guest": Disable AI features, show login prompt (Req 13.8)
 * - "active": Enable AI features (Req 13.9)
 * - "quota_exceeded": Disable AI features, show quota exceeded message with reset date (Req 13.10)
 * - "suspended": Disable AI features, show account suspended message (Req 13.11)
 */
export function AIAccessGate({ children, onSignInClick }: AIAccessGateProps) {
  const aiAccessState = useAIAccessState();
  const accessContext = useAccessContext();

  // Req 13.9 — "active" state: enable AI features
  if (aiAccessState === 'active') {
    return <>{children}</>;
  }

  // For all other states, show a blocking message instead of the AI features
  return (
    <div
      data-testid="ai-access-gate-blocked"
      data-access-state={aiAccessState}
      style={styles.container}
    >
      <AIAccessBlockedMessage
        state={aiAccessState}
        quotaResetAt={accessContext?.entitlement.quota_reset_at}
        onSignInClick={onSignInClick}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocked state messages
// ---------------------------------------------------------------------------

interface AIAccessBlockedMessageProps {
  state: AIAccessState;
  quotaResetAt?: string;
  onSignInClick?: () => void;
}

function AIAccessBlockedMessage({
  state,
  quotaResetAt,
  onSignInClick,
}: AIAccessBlockedMessageProps) {
  switch (state) {
    case 'guest':
      return <GuestMessage onSignInClick={onSignInClick} />;
    case 'quota_exceeded':
      return <QuotaExceededMessage quotaResetAt={quotaResetAt} />;
    case 'suspended':
      return <SuspendedMessage />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Guest state message (Req 13.8)
// ---------------------------------------------------------------------------

function GuestMessage({ onSignInClick }: { onSignInClick?: () => void }) {
  return (
    <div style={styles.messageCard} data-testid="ai-access-guest-message">
      <div style={styles.iconContainer}>
        <span
          className="material-symbols-outlined"
          style={{ ...styles.icon, color: '#5d5fef' }}
        >
          auto_awesome
        </span>
      </div>
      <h3 style={styles.title}>Sign in to use AI features</h3>
      <p style={styles.description}>
        AuraSphere AI is available to authenticated users. Sign in to access AI
        writing assistance, suggestions, and more.
      </p>
      {onSignInClick && (
        <button
          data-testid="ai-access-sign-in-button"
          onClick={onSignInClick}
          style={styles.primaryButton}
        >
          Sign In
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quota exceeded message (Req 13.10)
// ---------------------------------------------------------------------------

function QuotaExceededMessage({ quotaResetAt }: { quotaResetAt?: string }) {
  const resetDate = quotaResetAt ? new Date(quotaResetAt) : null;
  const formattedResetDate = resetDate
    ? resetDate.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    : 'the next billing cycle';

  return (
    <div
      style={styles.messageCard}
      data-testid="ai-access-quota-exceeded-message"
    >
      <div style={styles.iconContainer}>
        <span
          className="material-symbols-outlined"
          style={{ ...styles.icon, color: '#f59e0b' }}
        >
          hourglass_empty
        </span>
      </div>
      <h3 style={styles.title}>AI quota exceeded</h3>
      <p style={styles.description}>
        You've reached your monthly AI usage limit. Your quota will reset on{' '}
        <strong>{formattedResetDate}</strong>.
      </p>
      <p style={styles.hint}>
        Upgrade your plan for higher limits and priority access.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspended account message (Req 13.11)
// ---------------------------------------------------------------------------

function SuspendedMessage() {
  return (
    <div style={styles.messageCard} data-testid="ai-access-suspended-message">
      <div style={styles.iconContainer}>
        <span
          className="material-symbols-outlined"
          style={{ ...styles.icon, color: '#dc2626' }}
        >
          block
        </span>
      </div>
      <h3 style={styles.title}>Account suspended</h3>
      <p style={styles.description}>
        Your account has been suspended. AI features are currently unavailable.
      </p>
      <p style={styles.hint}>
        Please contact support for assistance with your account.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '2rem',
  },
  messageCard: {
    maxWidth: '400px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem',
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '16px',
    border: '1px solid rgba(199, 196, 215, 0.2)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  iconContainer: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(93, 95, 239, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: '32px',
    fontVariationSettings: "'FILL' 1",
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#191c1d',
    fontFamily: 'var(--font-family-ui)',
  },
  description: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    color: '#464555',
    fontFamily: 'var(--font-family-ui)',
  },
  hint: {
    margin: 0,
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: '#767586',
    fontFamily: 'var(--font-family-ui)',
  },
  primaryButton: {
    marginTop: '0.5rem',
    padding: '0.75rem 2rem',
    background: '#5d5fef',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'var(--font-family-ui)',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
};
