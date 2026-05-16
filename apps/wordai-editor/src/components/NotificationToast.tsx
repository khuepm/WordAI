/**
 * NotificationToast - Toast/snackbar overlay for the toast notification channel.
 *
 * Renders a fixed-position overlay container (top-right by default) that stacks
 * multiple toast notifications. Each toast shows resolved content, a priority
 * indicator, and a dismiss button. Toasts auto-dismiss based on their duration
 * and can be dismissed on click.
 *
 * Uses the `useNotificationChannel('toast')` hook which already handles
 * priority ordering and max visible filtering.
 *
 * Requirements: 2.3, 2.8
 */

import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useNotificationChannel } from '../hooks/useNotificationChannel';
import { notificationDispatcher } from '../services/notificationDispatcher';
import { openPreferencesWindow } from '../services/preferencesWindow';
import type { ActiveNotification, NotificationPriority } from '../types/notification';
import type { Tab } from '../types/preferences';

// ─── Priority Styling ───────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<NotificationPriority, { bg: string; border: string; icon: string }> = {
  critical: {
    bg: 'var(--md-sys-color-error-container, #ffdad6)',
    border: 'var(--md-sys-color-error, #ba1a1a)',
    icon: '🔴',
  },
  high: {
    bg: 'var(--md-sys-color-tertiary-container, #ffddb5)',
    border: 'var(--md-sys-color-tertiary, #7c5800)',
    icon: '🟠',
  },
  medium: {
    bg: 'var(--md-sys-color-primary-container, #e0e0ff)',
    border: 'var(--md-sys-color-primary, #4343d5)',
    icon: '🔵',
  },
  low: {
    bg: 'var(--md-sys-color-surface-container, #f0f0f4)',
    border: 'var(--md-sys-color-outline, #787680)',
    icon: '⚪',
  },
};

// ─── Styles ─────────────────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: '1rem',
  right: '1rem',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  pointerEvents: 'none',
  maxWidth: '380px',
  width: '100%',
};

const toastItemStyle: CSSProperties = {
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-md, 0.625rem)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
  fontSize: '0.8125rem',
  lineHeight: 1.4,
  animation: 'toast-slide-in 0.25s ease-out forwards',
  transition: 'opacity 0.2s ease, transform 0.2s ease',
  borderLeft: '3px solid',
};

const contentStyle: CSSProperties = {
  flex: 1,
  color: 'var(--md-sys-color-on-surface, #191c1d)',
  wordBreak: 'break-word',
};

const priorityIconStyle: CSSProperties = {
  fontSize: '0.75rem',
  lineHeight: 1,
  flexShrink: 0,
  marginTop: '2px',
};

const dismissBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
  fontSize: '1rem',
  lineHeight: 1,
  color: 'var(--md-sys-color-on-surface-variant, #464555)',
  opacity: 0.7,
  flexShrink: 0,
  borderRadius: '4px',
  transition: 'opacity 0.15s',
};

const settingsBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
  fontSize: '0.875rem',
  lineHeight: 1,
  color: 'var(--md-sys-color-primary, #4343d5)',
  opacity: 0.8,
  flexShrink: 0,
  borderRadius: '4px',
  transition: 'opacity 0.15s',
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function NotificationToast() {
  const notifications = useNotificationChannel('toast');

  const handleDismiss = useCallback((notificationId: string) => {
    notificationDispatcher.dismiss(notificationId);
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div
      data-testid="notification-toast-overlay"
      style={overlayStyle}
      aria-live="polite"
      aria-label="Notifications"
      role="region"
    >
      {notifications.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

// ─── Toast Item ─────────────────────────────────────────────────────────────────

interface ToastItemProps {
  notification: ActiveNotification;
  onDismiss: (id: string) => void;
}

function ToastItem({ notification, onDismiss }: ToastItemProps) {
  const priorityConfig = PRIORITY_COLORS[notification.priority];

  const handleOpenSettings = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.settingId) return;
    // Derive tab from settingId (e.g. "general.autoSave" → "general", "ai-engine.model" → "ai-engine")
    const tab = notification.settingId.split('.')[0] as Tab;
    void openPreferencesWindow({ tab, settingId: notification.settingId });
    onDismiss(notification.id);
  }, [notification.settingId, notification.id, onDismiss]);

  const itemStyle: CSSProperties = {
    ...toastItemStyle,
    background: priorityConfig.bg,
    borderLeftColor: priorityConfig.border,
  };

  return (
    <div
      data-testid={`notification-toast-item-${notification.id}`}
      style={itemStyle}
      onClick={() => onDismiss(notification.id)}
      role="alert"
      aria-label={`${notification.priority} priority notification: ${notification.resolvedContent}`}
    >
      {/* Priority indicator */}
      <span style={priorityIconStyle} aria-hidden="true">
        {priorityConfig.icon}
      </span>

      {/* Content */}
      <span style={contentStyle}>
        {notification.resolvedContent}
      </span>

      {/* Settings button — deep-links to relevant preference */}
      {notification.settingId && (
        <button
          data-testid={`notification-toast-settings-${notification.id}`}
          style={settingsBtnStyle}
          onClick={handleOpenSettings}
          aria-label="Open settings"
          title="Open settings"
        >
          ⚙
        </button>
      )}

      {/* Dismiss button */}
      <button
        data-testid={`notification-toast-dismiss-${notification.id}`}
        style={dismissBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
