/**
 * AIAccessGate — Unit tests
 *
 * Tests that the AIAccessGate component correctly gates AI features based on
 * the AI access state and displays appropriate messages.
 *
 * Requirements: 13.8, 13.9, 13.10, 13.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AIAccessState } from '../types/auth';

// ---------------------------------------------------------------------------
// Mock authStore so we can control aiAccessState and accessContext per test
// ---------------------------------------------------------------------------

const mockUseAIAccessState = vi.fn<() => AIAccessState>(() => 'guest');
const mockUseAccessContext = vi.fn(() => null);

vi.mock('../services/authStore', () => ({
  useAIAccessState: () => mockUseAIAccessState(),
  useAccessContext: () => mockUseAccessContext(),
}));

// Import AFTER mocks are set up
import { AIAccessGate } from './AIAccessGate';
import type { AccessContext } from '../types/auth';

// ---------------------------------------------------------------------------
// Helper to build test AccessContext
// ---------------------------------------------------------------------------

function buildAccessContext(
  overrides?: Partial<AccessContext['entitlement']>,
  userStatus: AccessContext['user']['status'] = 'active',
): AccessContext {
  return {
    user: {
      id: 'user-1',
      firebase_uid: 'firebase-uid-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      status: userStatus,
      last_login_at: new Date().toISOString(),
    },
    roles: ['user'],
    permissions: ['ai.use'],
    entitlement: {
      ai_enabled: true,
      plan_code: 'free',
      monthly_quota: 100,
      used_quota: 50,
      quota_reset_at: new Date('2026-05-01').toISOString(),
      allowed_models: ['gpt-3.5-turbo'],
      max_requests_per_minute: 10,
      ...overrides,
    },
    session: {
      id: 'session-1',
      device_id: 'device-1',
      session_state: 'active',
      last_seen_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Req 13.9 — "active" state: enable AI features
// ---------------------------------------------------------------------------

describe('AIAccessGate — active state (Req 13.9)', () => {
  beforeEach(() => {
    mockUseAIAccessState.mockReturnValue('active');
    mockUseAccessContext.mockReturnValue(buildAccessContext());
  });

  it('renders children when AI access state is "active"', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByTestId('ai-feature')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-access-gate-blocked')).not.toBeInTheDocument();
  });

  it('does not show any blocked message when active', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.queryByTestId('ai-access-guest-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-access-quota-exceeded-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-access-suspended-message')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 13.8 — "guest" state: disable AI features, show login prompt
// ---------------------------------------------------------------------------

describe('AIAccessGate — guest state (Req 13.8)', () => {
  beforeEach(() => {
    mockUseAIAccessState.mockReturnValue('guest');
    mockUseAccessContext.mockReturnValue(null);
  });

  it('blocks AI features and shows login prompt when context is null', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.queryByTestId('ai-feature')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-access-gate-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('ai-access-guest-message')).toBeInTheDocument();
    expect(screen.getByText(/Sign in to use AI features/i)).toBeInTheDocument();
  });

  it('sets data-access-state="guest" on the blocked container', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByTestId('ai-access-gate-blocked')).toHaveAttribute(
      'data-access-state',
      'guest',
    );
  });

  it('shows sign-in button when onSignInClick is provided', () => {
    const handleSignIn = vi.fn();
    render(
      <AIAccessGate onSignInClick={handleSignIn}>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByTestId('ai-access-sign-in-button')).toBeInTheDocument();
  });

  it('calls onSignInClick when sign-in button is clicked', async () => {
    const user = userEvent.setup();
    const handleSignIn = vi.fn();
    render(
      <AIAccessGate onSignInClick={handleSignIn}>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    await user.click(screen.getByTestId('ai-access-sign-in-button'));
    expect(handleSignIn).toHaveBeenCalledTimes(1);
  });

  it('does not show sign-in button when onSignInClick is not provided', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.queryByTestId('ai-access-sign-in-button')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 13.10 — "quota_exceeded" state: disable AI features, show quota message
// ---------------------------------------------------------------------------

describe('AIAccessGate — quota_exceeded state (Req 13.10)', () => {
  const resetDate = new Date('2026-05-01');

  beforeEach(() => {
    mockUseAIAccessState.mockReturnValue('quota_exceeded');
    mockUseAccessContext.mockReturnValue(
      buildAccessContext({
        monthly_quota: 100,
        used_quota: 100,
        quota_reset_at: resetDate.toISOString(),
      }),
    );
  });

  it('blocks AI features and shows quota exceeded message', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.queryByTestId('ai-feature')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-access-gate-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('ai-access-quota-exceeded-message')).toBeInTheDocument();
    expect(screen.getByText(/AI quota exceeded/i)).toBeInTheDocument();
  });

  it('sets data-access-state="quota_exceeded" on the blocked container', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByTestId('ai-access-gate-blocked')).toHaveAttribute(
      'data-access-state',
      'quota_exceeded',
    );
  });

  it('displays the quota reset date in the message', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    const formattedDate = resetDate.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    expect(screen.getByText(new RegExp(formattedDate, 'i'))).toBeInTheDocument();
  });

  it('shows fallback text when no quota_reset_at is available', () => {
    mockUseAccessContext.mockReturnValue(null);

    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByText(/the next billing cycle/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 13.11 — "suspended" state: disable AI features, show suspended message
// ---------------------------------------------------------------------------

describe('AIAccessGate — suspended state (Req 13.11)', () => {
  beforeEach(() => {
    mockUseAIAccessState.mockReturnValue('suspended');
    mockUseAccessContext.mockReturnValue(buildAccessContext({}, 'suspended'));
  });

  it('blocks AI features and shows suspended message', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.queryByTestId('ai-feature')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-access-gate-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('ai-access-suspended-message')).toBeInTheDocument();
    expect(screen.getByText(/Account suspended/i)).toBeInTheDocument();
  });

  it('sets data-access-state="suspended" on the blocked container', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByTestId('ai-access-gate-blocked')).toHaveAttribute(
      'data-access-state',
      'suspended',
    );
  });

  it('shows contact support hint in suspended message', () => {
    render(
      <AIAccessGate>
        <div data-testid="ai-feature">AI Feature Content</div>
      </AIAccessGate>,
    );

    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
  });
});
