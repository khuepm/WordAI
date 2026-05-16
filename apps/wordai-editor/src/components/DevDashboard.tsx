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
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.12
 */

import { useState, useCallback, useEffect, useSyncExternalStore, useRef } from 'react';
import type { CSSProperties } from 'react';
import { notificationRegistry } from '../services/notificationRegistry';
import { notificationDispatcher } from '../services/notificationDispatcher';
import { loadPreferences } from '../services/preferencesService';
import type { NotificationPolicy, TriggerType, NotificationChannel, NotificationFormat, NotificationPriority, ActiveNotification } from '../types/notification';
import type { Preferences } from '../types/preferences';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DevDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders without overlay/backdrop (used in standalone OS window) */
  isWindowed?: boolean;
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

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.75rem',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--md-sys-color-outline-variant, #c9c5d0)',
  fontWeight: 700,
  color: 'var(--md-sys-color-on-surface, #1c1b1f)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '0.4rem 0.75rem',
  borderBottom: '1px solid var(--md-sys-color-outline-variant, #e8e0e8)',
  color: 'var(--md-sys-color-on-surface, #1c1b1f)',
  verticalAlign: 'middle',
};

const selectStyle: CSSProperties = {
  padding: '0.25rem 0.5rem',
  border: '1px solid var(--md-sys-color-outline-variant, #c9c5d0)',
  borderRadius: '0.25rem',
  fontSize: '0.75rem',
  background: 'var(--md-sys-color-surface, #fefbff)',
  color: 'inherit',
};

const inputStyle: CSSProperties = {
  padding: '0.25rem 0.5rem',
  border: '1px solid var(--md-sys-color-outline-variant, #c9c5d0)',
  borderRadius: '0.25rem',
  fontSize: '0.75rem',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--md-sys-color-surface, #fefbff)',
  color: 'inherit',
};

const btnStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  transition: 'background 0.15s',
};

const btnPrimaryStyle: CSSProperties = {
  ...btnStyle,
  background: 'var(--md-sys-color-primary, #6750a4)',
  color: 'var(--md-sys-color-on-primary, #fff)',
};

const btnDangerStyle: CSSProperties = {
  ...btnStyle,
  background: 'var(--md-sys-color-error, #b3261e)',
  color: 'var(--md-sys-color-on-error, #fff)',
};

const btnSecondaryStyle: CSSProperties = {
  ...btnStyle,
  background: 'var(--md-sys-color-secondary-container, #e8def8)',
  color: 'var(--md-sys-color-on-secondary-container, #1d192b)',
};

const logEntryStyle: CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid var(--md-sys-color-outline-variant, #e8e0e8)',
  fontSize: '0.75rem',
};

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginBottom: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const prefGroupStyle: CSSProperties = {
  marginBottom: '1.5rem',
};

const prefGroupTitleStyle: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  marginBottom: '0.5rem',
  color: 'var(--md-sys-color-primary, #6750a4)',
  textTransform: 'capitalize',
};

const prefRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.35rem 0.75rem',
  borderBottom: '1px solid var(--md-sys-color-outline-variant, #e8e0e8)',
  fontSize: '0.75rem',
  alignItems: 'center',
};

const prefHighlightStyle: CSSProperties = {
  ...prefRowStyle,
  background: 'var(--md-sys-color-tertiary-container, #ffd8e4)',
  transition: 'background 1s ease-out',
};

const dialogOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.5)',
};

const dialogStyle: CSSProperties = {
  background: 'var(--md-sys-color-surface, #fefbff)',
  borderRadius: '1rem',
  padding: '1.5rem',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
};

// ─── Tab Configuration ──────────────────────────────────────────────────────────

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'policies', label: 'Policies', icon: '📋' },
  { id: 'log', label: 'Log', icon: '📜' },
  { id: 'simulator', label: 'Simulator', icon: '🧪' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'actions', label: 'Actions', icon: '💾' },
];

const CHANNELS: NotificationChannel[] = ['statusBar', 'toast', 'titleBar', 'badge', 'none'];
const FORMATS: NotificationFormat[] = ['countdown', 'elapsed', 'message', 'indicator', 'progress'];
const PRIORITIES: NotificationPriority[] = ['low', 'medium', 'high', 'critical'];
const TRIGGERS: TriggerType[] = ['onChange', 'onThreshold', 'onError', 'periodic', 'onEvent'];

const EVENT_TYPES = [
  'sync.start',
  'sync.success',
  'sync.error',
  'document.dirty',
  'preference.changed',
  'autoSync.tick',
  'autoSync.skip',
  'export.start',
  'export.complete',
  'export.error',
  'ai.response',
  'ai.error',
];

const PREF_TABS = ['general', 'aiEngine', 'typography', 'privacy'] as const;

// ─── Main Component ─────────────────────────────────────────────────────────────

export function DevDashboard({ isOpen, onClose, isWindowed }: DevDashboardProps) {
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

  // In windowed mode, render without overlay — fills the entire window
  if (isWindowed) {
    return (
      <div
        data-testid="dev-dashboard-panel"
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--md-sys-color-surface, #fefbff)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header data-tauri-drag-region style={headerStyle}>
          <h2 style={titleStyle}>Notification Dev Dashboard</h2>
          <button
            data-testid="dev-dashboard-close"
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Close Dev Dashboard"
            title="Close"
          >
            ✕
          </button>
        </header>

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

        <div style={contentAreaStyle} role="tabpanel" aria-label={`${activeTab} panel`}>
          <TabContent tab={activeTab} />
        </div>
      </div>
    );
  }

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

        <div style={contentAreaStyle} role="tabpanel" aria-label={`${activeTab} panel`}>
          <TabContent tab={activeTab} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab Content Router ─────────────────────────────────────────────────────────

function TabContent({ tab }: { tab: DashboardTab }) {
  switch (tab) {
    case 'policies':
      return <PolicyTable />;
    case 'log':
      return <NotificationLog />;
    case 'simulator':
      return <EventSimulator />;
    case 'preferences':
      return <LivePreferences />;
    case 'actions':
      return <SaveResetActions />;
    default:
      return null;
  }
}


// ─── 8.2: Policy Table ──────────────────────────────────────────────────────────

function PolicyTable() {
  const policies = useSyncExternalStore(
    (cb) => notificationRegistry.subscribe(cb),
    () => notificationRegistry.getSnapshot()
  );

  const handleFieldChange = useCallback(
    (policyId: string, field: keyof NotificationPolicy, value: unknown) => {
      notificationRegistry.overridePolicy(policyId, { [field]: value });
    },
    []
  );

  const handleSilentToggle = useCallback((policyId: string, currentSilent: boolean) => {
    notificationRegistry.overridePolicy(policyId, { silent: !currentSilent });
  }, []);

  return (
    <div data-testid="dev-dashboard-content-policies">
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Source Key</th>
            <th style={thStyle}>Channel</th>
            <th style={thStyle}>Format</th>
            <th style={thStyle}>Priority</th>
            <th style={thStyle}>Silent</th>
            <th style={thStyle}>Trigger</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td style={tdStyle}>
                <code style={{ fontSize: '0.7rem' }}>{policy.id}</code>
              </td>
              <td style={tdStyle}>
                <input
                  style={{ ...inputStyle, width: '140px' }}
                  value={policy.sourceKey}
                  onChange={(e) => handleFieldChange(policy.id, 'sourceKey', e.target.value)}
                  data-testid={`policy-sourceKey-${policy.id}`}
                />
              </td>
              <td style={tdStyle}>
                <select
                  style={selectStyle}
                  value={policy.channel}
                  onChange={(e) => handleFieldChange(policy.id, 'channel', e.target.value)}
                  data-testid={`policy-channel-${policy.id}`}
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </td>
              <td style={tdStyle}>
                <select
                  style={selectStyle}
                  value={policy.format}
                  onChange={(e) => handleFieldChange(policy.id, 'format', e.target.value)}
                  data-testid={`policy-format-${policy.id}`}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </td>
              <td style={tdStyle}>
                <select
                  style={selectStyle}
                  value={policy.priority}
                  onChange={(e) => handleFieldChange(policy.id, 'priority', e.target.value)}
                  data-testid={`policy-priority-${policy.id}`}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td style={tdStyle}>
                <button
                  style={{
                    ...btnStyle,
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.7rem',
                    background: policy.silent
                      ? 'var(--md-sys-color-error-container, #f9dedc)'
                      : 'var(--md-sys-color-primary-container, #e8def8)',
                  }}
                  onClick={() => handleSilentToggle(policy.id, policy.silent)}
                  data-testid={`policy-silent-${policy.id}`}
                >
                  {policy.silent ? '🔇 Silent' : '🔊 Active'}
                </button>
              </td>
              <td style={tdStyle}>
                <select
                  style={selectStyle}
                  value={policy.trigger}
                  onChange={(e) => handleFieldChange(policy.id, 'trigger', e.target.value)}
                  data-testid={`policy-trigger-${policy.id}`}
                >
                  {TRIGGERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ─── 8.3: Notification Log ──────────────────────────────────────────────────────

function NotificationLog() {
  const [log, setLog] = useState<ActiveNotification[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Poll log every second for updates
  useEffect(() => {
    const refresh = () => setLog(notificationDispatcher.getLog());
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredLog = log.filter((entry) => {
    if (channelFilter !== 'all' && entry.channel !== channelFilter) return false;
    if (priorityFilter !== 'all' && entry.priority !== priorityFilter) return false;
    return true;
  }).reverse(); // Most recent first

  return (
    <div data-testid="dev-dashboard-content-log">
      <div style={filterBarStyle}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Channel:</label>
        <select
          style={selectStyle}
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          data-testid="log-filter-channel"
        >
          <option value="all">All</option>
          {CHANNELS.map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Priority:</label>
        <select
          style={selectStyle}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          data-testid="log-filter-priority"
        >
          <option value="all">All</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
          {filteredLog.length} entries
        </span>
      </div>

      <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {filteredLog.length === 0 ? (
          <p style={{ fontSize: '0.8rem', opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No notifications dispatched yet.
          </p>
        ) : (
          filteredLog.map((entry) => (
            <div key={entry.id} style={logEntryStyle} data-testid={`log-entry-${entry.id}`}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--md-sys-color-primary, #6750a4)' }}>
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
                <span style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.25rem',
                  background: 'var(--md-sys-color-secondary-container, #e8def8)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}>
                  {entry.channel}
                </span>
                <span style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.25rem',
                  background: 'var(--md-sys-color-tertiary-container, #ffd8e4)',
                  fontSize: '0.65rem',
                }}>
                  {entry.format}
                </span>
                <span style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: entry.state === 'active' ? '#c8e6c9' : '#e0e0e0',
                }}>
                  {entry.state}
                </span>
              </div>
              <div style={{ color: 'var(--md-sys-color-on-surface, #1c1b1f)' }}>
                {entry.resolvedContent || <em style={{ opacity: 0.5 }}>No content</em>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


// ─── 8.4: Event Simulator ───────────────────────────────────────────────────────

function EventSimulator() {
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [dataPayload, setDataPayload] = useState('{}');
  const [lastResult, setLastResult] = useState<string | null>(null);

  const triggerForEvent = (sourceKey: string): TriggerType => {
    if (sourceKey.includes('error')) return 'onError';
    if (sourceKey.includes('changed')) return 'onChange';
    return 'onEvent';
  };

  const handleSimulate = useCallback(() => {
    try {
      const data = JSON.parse(dataPayload);
      const trigger = triggerForEvent(eventType);
      notificationDispatcher.simulate({
        sourceKey: eventType,
        trigger,
        data,
        timestamp: Date.now(),
      });
      setLastResult(`✓ Dispatched "${eventType}" at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setLastResult(`✗ Error: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
  }, [eventType, dataPayload]);

  return (
    <div data-testid="dev-dashboard-content-simulator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Event Type
          </label>
          <select
            style={{ ...selectStyle, width: '100%', padding: '0.5rem' }}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            data-testid="simulator-event-type"
          >
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Data Payload (JSON)
          </label>
          <textarea
            style={{
              ...inputStyle,
              minHeight: '100px',
              resize: 'vertical',
              fontFamily: 'monospace',
            }}
            value={dataPayload}
            onChange={(e) => setDataPayload(e.target.value)}
            placeholder='{"error": "Connection timeout", "seconds": 15}'
            data-testid="simulator-data-payload"
          />
        </div>

        <button
          style={btnPrimaryStyle}
          onClick={handleSimulate}
          data-testid="simulator-dispatch-btn"
        >
          🚀 Simulate
        </button>

        {lastResult && (
          <p
            style={{
              fontSize: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.25rem',
              background: lastResult.startsWith('✓')
                ? 'var(--md-sys-color-primary-container, #e8def8)'
                : 'var(--md-sys-color-error-container, #f9dedc)',
            }}
            data-testid="simulator-result"
          >
            {lastResult}
          </p>
        )}
      </div>
    </div>
  );
}


// ─── 8.5: Live Preferences ──────────────────────────────────────────────────────

function LivePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const prevPrefsRef = useRef<string>('');

  // Load preferences and poll for changes
  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const prefs = await loadPreferences('default');
        if (!active) return;

        const serialized = JSON.stringify(prefs);
        if (prevPrefsRef.current && prevPrefsRef.current !== serialized) {
          // Detect which keys changed
          const oldPrefs = JSON.parse(prevPrefsRef.current) as Preferences;
          const newChanged = new Set<string>();
          for (const tab of PREF_TABS) {
            const oldTab = oldPrefs[tab] as Record<string, unknown>;
            const newTab = prefs[tab] as Record<string, unknown>;
            for (const key of Object.keys(newTab)) {
              if (JSON.stringify(oldTab?.[key]) !== JSON.stringify(newTab[key])) {
                newChanged.add(`${tab}.${key}`);
              }
            }
          }
          setChangedKeys(newChanged);
          // Clear highlights after 2 seconds
          setTimeout(() => { if (active) setChangedKeys(new Set()); }, 2000);
        }
        prevPrefsRef.current = serialized;
        setPreferences(prefs);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load');
      }
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div data-testid="dev-dashboard-content-preferences">
        <p style={{ color: 'var(--md-sys-color-error, #b3261e)', fontSize: '0.8rem' }}>
          Error loading preferences: {error}
        </p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div data-testid="dev-dashboard-content-preferences">
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading preferences...</p>
      </div>
    );
  }

  const tabLabels: Record<string, string> = {
    general: 'General',
    aiEngine: 'AI Engine',
    typography: 'Typography',
    privacy: 'Privacy',
  };

  return (
    <div data-testid="dev-dashboard-content-preferences">
      {PREF_TABS.map((tab) => {
        const tabData = preferences[tab] as Record<string, unknown>;
        return (
          <div key={tab} style={prefGroupStyle}>
            <h3 style={prefGroupTitleStyle}>{tabLabels[tab]}</h3>
            {Object.entries(tabData).map(([key, value]) => {
              const fullKey = `${tab}.${key}`;
              const isChanged = changedKeys.has(fullKey);
              return (
                <div
                  key={fullKey}
                  style={isChanged ? prefHighlightStyle : prefRowStyle}
                  data-testid={`pref-${fullKey}`}
                >
                  <span style={{ fontWeight: 600 }}>{key}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}


// ─── 8.6: Save/Reset Actions ────────────────────────────────────────────────────

function SaveResetActions() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    try {
      await notificationRegistry.saveToConfig();
      setStatus('✓ Policies saved to config file.');
    } catch (err) {
      setStatus(`✗ Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const handleReset = useCallback(async () => {
    try {
      await notificationRegistry.resetToDefaults();
      setShowResetDialog(false);
      setStatus('✓ Policies reset to defaults.');
    } catch (err) {
      setStatus(`✗ Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <div data-testid="dev-dashboard-content-actions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Save to Config
          </h3>
          <p style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem' }}>
            Persist current policy overrides to the notification config file.
          </p>
          <button
            style={btnPrimaryStyle}
            onClick={handleSave}
            data-testid="actions-save-btn"
          >
            💾 Save to Config
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Reset to Defaults
          </h3>
          <p style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem' }}>
            Clear all overrides and reload bundled default policies.
          </p>
          <button
            style={btnDangerStyle}
            onClick={() => setShowResetDialog(true)}
            data-testid="actions-reset-btn"
          >
            🔄 Reset to Defaults
          </button>
        </div>

        {status && (
          <p
            style={{
              fontSize: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.25rem',
              background: status.startsWith('✓')
                ? 'var(--md-sys-color-primary-container, #e8def8)'
                : 'var(--md-sys-color-error-container, #f9dedc)',
            }}
            data-testid="actions-status"
          >
            {status}
          </p>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div style={dialogOverlayStyle} data-testid="reset-confirm-dialog">
          <div style={dialogStyle}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Confirm Reset
            </h3>
            <p style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.8 }}>
              This will clear all policy overrides and reload the bundled defaults.
              Any unsaved changes will be lost.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                style={btnSecondaryStyle}
                onClick={() => setShowResetDialog(false)}
                data-testid="reset-cancel-btn"
              >
                Cancel
              </button>
              <button
                style={btnDangerStyle}
                onClick={handleReset}
                data-testid="reset-confirm-btn"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DevDashboard;
