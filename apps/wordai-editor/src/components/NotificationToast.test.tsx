/**
 * Unit tests for NotificationToast component
 * Requirements: 2.3, 2.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationToast } from './NotificationToast';
import type { ActiveNotification } from '../types/notification';

// Mock the useNotificationChannel hook
vi.mock('../hooks/useNotificationChannel', () => ({
  useNotificationChannel: vi.fn(() => []),
}));

// Mock the notificationDispatcher
vi.mock('../services/notificationDispatcher', () => ({
  notificationDispatcher: {
    dismiss: vi.fn(),
  },
}));

import { useNotificationChannel } from '../hooks/useNotificationChannel';
import { notificationDispatcher } from '../services/notificationDispatcher';

const mockedUseNotificationChannel = vi.mocked(useNotificationChannel);
const mockedDismiss = vi.mocked(notificationDispatcher.dismiss);

function createNotification(overrides: Partial<ActiveNotification> = {}): ActiveNotification {
  return {
    id: 'test-notification-1',
    policyId: 'test-policy',
    channel: 'toast',
    format: 'message',
    priority: 'medium',
    duration: 3000,
    resolvedContent: 'Test notification message',
    data: {},
    state: 'active',
    createdAt: Date.now(),
    dismissAt: Date.now() + 3000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseNotificationChannel.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Renders nothing when no notifications
// ---------------------------------------------------------------------------
describe('Renders nothing when no notifications', () => {
  it('returns null when notification list is empty', () => {
    const { container } = render(<NotificationToast />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render the overlay container', () => {
    render(<NotificationToast />);
    expect(screen.queryByTestId('notification-toast-overlay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Renders toast overlay with notifications (Req 2.3)
// ---------------------------------------------------------------------------
describe('Renders toast overlay with notifications (Req 2.3)', () => {
  it('renders the overlay container when notifications exist', () => {
    mockedUseNotificationChannel.mockReturnValue([createNotification()]);
    render(<NotificationToast />);

    expect(screen.getByTestId('notification-toast-overlay')).toBeInTheDocument();
  });

  it('renders the overlay with fixed positioning', () => {
    mockedUseNotificationChannel.mockReturnValue([createNotification()]);
    render(<NotificationToast />);

    const overlay = screen.getByTestId('notification-toast-overlay');
    expect(overlay).toHaveStyle({ position: 'fixed' });
  });

  it('renders each notification as a toast item', () => {
    const notifications = [
      createNotification({ id: 'n1', resolvedContent: 'First toast' }),
      createNotification({ id: 'n2', resolvedContent: 'Second toast' }),
    ];
    mockedUseNotificationChannel.mockReturnValue(notifications);
    render(<NotificationToast />);

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('renders notification resolved content', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ resolvedContent: 'Sync failed: timeout' }),
    ]);
    render(<NotificationToast />);

    expect(screen.getByText('Sync failed: timeout')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Priority-based styling (Req 2.3)
// ---------------------------------------------------------------------------
describe('Priority-based styling (Req 2.3)', () => {
  it('renders critical priority with error border color', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'critical-1', priority: 'critical' }),
    ]);
    render(<NotificationToast />);

    const item = screen.getByTestId('notification-toast-item-critical-1');
    expect(item).toHaveStyle({ borderLeftColor: 'var(--md-sys-color-error, #ba1a1a)' });
  });

  it('renders high priority with tertiary border color', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'high-1', priority: 'high' }),
    ]);
    render(<NotificationToast />);

    const item = screen.getByTestId('notification-toast-item-high-1');
    expect(item).toHaveStyle({ borderLeftColor: 'var(--md-sys-color-tertiary, #7c5800)' });
  });

  it('renders medium priority with primary border color', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'med-1', priority: 'medium' }),
    ]);
    render(<NotificationToast />);

    const item = screen.getByTestId('notification-toast-item-med-1');
    expect(item).toHaveStyle({ borderLeftColor: 'var(--md-sys-color-primary, #4343d5)' });
  });

  it('renders low priority with outline border color', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'low-1', priority: 'low' }),
    ]);
    render(<NotificationToast />);

    const item = screen.getByTestId('notification-toast-item-low-1');
    expect(item).toHaveStyle({ borderLeftColor: 'var(--md-sys-color-outline, #787680)' });
  });
});

// ---------------------------------------------------------------------------
// Dismiss on click (Req 2.8)
// ---------------------------------------------------------------------------
describe('Dismiss on click (Req 2.8)', () => {
  it('calls dismiss when clicking on a toast item', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'dismiss-test' }),
    ]);
    render(<NotificationToast />);

    fireEvent.click(screen.getByTestId('notification-toast-item-dismiss-test'));
    expect(mockedDismiss).toHaveBeenCalledWith('dismiss-test');
  });

  it('calls dismiss when clicking the dismiss button', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'btn-dismiss-test' }),
    ]);
    render(<NotificationToast />);

    fireEvent.click(screen.getByTestId('notification-toast-dismiss-btn-dismiss-test'));
    expect(mockedDismiss).toHaveBeenCalledWith('btn-dismiss-test');
  });

  it('dismiss button click does not trigger parent click handler twice', () => {
    mockedUseNotificationChannel.mockReturnValue([
      createNotification({ id: 'no-double' }),
    ]);
    render(<NotificationToast />);

    fireEvent.click(screen.getByTestId('notification-toast-dismiss-no-double'));
    expect(mockedDismiss).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Stacks multiple toasts (Req 2.3)
// ---------------------------------------------------------------------------
describe('Stacks multiple toasts (Req 2.3)', () => {
  it('renders multiple toasts in order', () => {
    const notifications = [
      createNotification({ id: 'stack-1', priority: 'critical', resolvedContent: 'Critical alert' }),
      createNotification({ id: 'stack-2', priority: 'high', resolvedContent: 'High alert' }),
      createNotification({ id: 'stack-3', priority: 'medium', resolvedContent: 'Medium info' }),
    ];
    mockedUseNotificationChannel.mockReturnValue(notifications);
    render(<NotificationToast />);

    const items = screen.getAllByRole('alert');
    expect(items).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------
describe('Accessibility', () => {
  it('renders overlay with aria-live="polite"', () => {
    mockedUseNotificationChannel.mockReturnValue([createNotification()]);
    render(<NotificationToast />);

    const overlay = screen.getByTestId('notification-toast-overlay');
    expect(overlay).toHaveAttribute('aria-live', 'polite');
  });

  it('renders each toast with role="alert"', () => {
    mockedUseNotificationChannel.mockReturnValue([createNotification()]);
    render(<NotificationToast />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('dismiss button has accessible label', () => {
    mockedUseNotificationChannel.mockReturnValue([createNotification({ id: 'a11y-test' })]);
    render(<NotificationToast />);

    const btn = screen.getByTestId('notification-toast-dismiss-a11y-test');
    expect(btn).toHaveAttribute('aria-label', 'Dismiss notification');
  });
});
