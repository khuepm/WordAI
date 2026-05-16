/**
 * DevDashboard - Dev-only notification system dashboard.
 *
 * Full-screen overlay providing visibility into the notification system:
 * - Policy table (all policies with inline editing)
 * - Notification log (timeline of dispatched notifications)
 * - Event simulator (trigger events manually)
 * - Live preferences (realtime preference values)
 * - Save/Reset actions
 *
 * This component is lazy-loaded and tree-shaken from production builds.
 * It is only rendered when `import.meta.env.DEV === true`.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.12
 */

import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DevDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type DashboardTab = 'policies' | 'log' | 'simulator' | 'preferences' | 'actions';

// ─── Styles ─────────────────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
};

const panelStyle: CSSProperties = {
  width: '90vw',
  maxWidth: '1200px',
  height: '85vh',
  background: 'var(--md-sys-color-surface, #fefbff)',
  borderRadius: '1rem',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid var(--md-sys-color-outline-variant, #c9c5d0)',
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: 'var(--md-sys-color-on-surface, #1c1b1f)',
  margin: 0,
};

const closeBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.5rem',
  borderRadius: '0.5rem',
  fontSize: '1.25rem',
  lineHeight: 1,
  color: 'var(--md-sys-color-on-surface-variant, #49454f)',
  transition: 'background 0.15s',
};

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  padding: '0.5rem 1.5rem',
  borderBottom: '1px solid var(--md-sys-color-outline-variant, #c9c5d0)',
  flexShrink: 0,
  overflowX: 'auto',
};

const tabBtnBaseStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  transition: 'background 0.15s, color 0.15s',
  whiteSpace: 'nowrap',
};

const contentAreaStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '1.5rem',
};

const placeholderStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: '0.75rem',
  color: 'var(--md-sys-color-on-surface-variant, #49454f)',
  fontSize: '0.875rem',
};

const placeholderIconStyle: CSSProperties = {
  fontSize: '2.5rem',
  opacity: 0.5,
};

// ─── Tab Configuration ──────────────────────────────────────────────────────────

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'policies', label: 'Policies', icon: '📋' },
  { id: 'log', label: 'Log', icon: '📜' },
  { id: 'simulator', label: 'Simulator', icon: '🧪' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'actions', label: 'Actions', icon: '💾' },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export function DevDashboard({ isOpen, onClose }: DevDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('policies');

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="dev-dashboard-overlay"
      style={overlayStyle}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Notification Dev Dashboard"
    >
      <div data-testid="dev-dashboard-panel" style={panelStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <h2 style={titleStyle}>Notification Dev Dashboard</h2>
          <button
            data-testid="dev-dashboard-close"
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Close Dev Dashboard"
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>

        {/* Tab Navigation */}
        <nav style={tabBarStyle} aria-label="Dashboard sections">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const tabStyle: CSSProperties = {
              ...tabBtnBaseStyle,
              background: isActive
                ? 'var(--md-sys-color-primary-container, #e8def8)'
                : 'transparent',
              color: isActive
                ? 'var(--md-sys-color-on-primary-container, #21005d)'
                : 'var(--md-sys-color-on-surface-variant, #49454f)',
            };

            return (
              <button
                key={tab.id}
                data-testid={`dev-dashboard-tab-${tab.id}`}
                style={tabStyle}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                role="tab"
              >
                <span aria-hidden="true">{tab.icon}</span> {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div style={contentAreaStyle} role="tabpanel" aria-label={`${activeTab} panel`}>
          <TabContent tab={activeTab} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab Content (Placeholders) ─────────────────────────────────────────────────

function TabContent({ tab }: { tab: DashboardTab }) {
  switch (tab) {
    case 'policies':
      return (
        <div data-testid="dev-dashboard-content-policies" style={placeholderStyle}>
          <span style={placeholderIconStyle}>📋</span>
          <p>Policy Table</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            All notification policies with inline editing will appear here.
          </p>
        </div>
      );
    case 'log':
      return (
        <div data-testid="dev-dashboard-content-log" style={placeholderStyle}>
          <span style={placeholderIconStyle}>📜</span>
          <p>Notification Log</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Timeline of dispatched notifications with timestamps and payloads.
          </p>
        </div>
      );
    case 'simulator':
      return (
        <div data-testid="dev-dashboard-content-simulator" style={placeholderStyle}>
          <span style={placeholderIconStyle}>🧪</span>
          <p>Event Simulator</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Trigger notification events manually for testing.
          </p>
        </div>
      );
    case 'preferences':
      return (
        <div data-testid="dev-dashboard-content-preferences" style={placeholderStyle}>
          <span style={placeholderIconStyle}>⚙️</span>
          <p>Live Preferences</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Realtime preference values grouped by tab.
          </p>
        </div>
      );
    case 'actions':
      return (
        <div data-testid="dev-dashboard-content-actions" style={placeholderStyle}>
          <span style={placeholderIconStyle}>💾</span>
          <p>Save / Reset Actions</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Persist overrides to config file or reset to defaults.
          </p>
        </div>
      );
    default:
      return null;
  }
}

export default DevDashboard;
