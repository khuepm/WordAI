import { useEffect, useState } from 'react';
import { PreferencesTab, usePreferences, defaultPreferences } from '../services/preferences';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs: { id: PreferencesTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'editor', label: 'Editor' },
];

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const { preferences, updateGeneral, updateEditor, restoreTabDefaults } = usePreferences();
  const [activeTab, setActiveTab] = useState<PreferencesTab>('general');
  const [fontSizeInput, setFontSizeInput] = useState<string>(() => String(preferences.editor.fontSize));

  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      setFontSizeInput(String(preferences.editor.fontSize));
    }
  }, [isOpen]);

  useEffect(() => {
    setFontSizeInput(String(preferences.editor.fontSize));
  }, [preferences.editor.fontSize]);

  if (!isOpen) return null;

  const handleRestore = () => restoreTabDefaults(activeTab);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '1rem',
      }}
      data-testid="preferences-dialog"
    >
      <div
        style={{
          background: 'var(--md-sys-color-surface, #fff)',
          color: 'var(--md-sys-color-on-surface, #1c1b1f)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-ambient, 0 20px 60px rgba(15, 23, 42, 0.25))',
          width: 'min(720px, 100%)',
          maxHeight: '80vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
          fontFamily: 'var(--font-family-ui)',
        }}
      >
        <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--md-sys-color-surface-container)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 id="preferences-title" style={{ margin: 0, fontSize: '1.1rem' }}>Preferences</h2>
            <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.9rem' }}>
              Settings are saved on this device and persist across sessions.
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--md-sys-color-on-surface-variant)' }} aria-label="Close preferences">
            ✕
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 0 }}>
          <aside style={{ borderRight: '1px solid var(--md-sys-color-surface-container)', padding: '1rem 0.5rem', background: 'var(--md-sys-color-surface-container-low)' }}>
            <nav aria-label="Preferences tabs" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: activeTab === tab.id ? 'var(--md-sys-color-surface-container-high)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          <section style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeTab === 'general' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Theme</span>
                  <select
                    data-testid="select-theme"
                    value={preferences.general.theme}
                    onChange={(e) => updateGeneral({ theme: e.target.value as any })}
                    style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--md-sys-color-surface-container-high, #dfe3eb)' }}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Language</span>
                  <select
                    data-testid="select-language"
                    value={preferences.general.language}
                    onChange={(e) => updateGeneral({ language: e.target.value as any })}
                    style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--md-sys-color-surface-container-high, #dfe3eb)' }}
                  >
                    <option value="en">English</option>
                    <option value="vi">Tiếng Việt</option>
                  </select>
                </label>
              </>
            )}

            {activeTab === 'editor' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Font size</span>
                  <input
                    data-testid="input-font-size"
                    type="number"
                    min={12}
                    max={28}
                    value={fontSizeInput}
                    onChange={(e) => {
                      setFontSizeInput(e.target.value);
                    }}
                    onBlur={() => {
                      const parsed = Number(fontSizeInput);
                      const clamped = Math.min(28, Math.max(12, Number.isNaN(parsed) ? defaultPreferences.editor.fontSize : parsed));
                      updateEditor({ fontSize: clamped });
                      setFontSizeInput(String(clamped));
                    }}
                    style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--md-sys-color-surface-container-high, #dfe3eb)' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    data-testid="toggle-spellcheck"
                    type="checkbox"
                    checked={preferences.editor.spellCheck}
                    onChange={(e) => updateEditor({ spellCheck: e.target.checked })}
                  />
                  <span>Enable spell check</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    data-testid="toggle-minimap"
                    type="checkbox"
                    checked={preferences.editor.showMinimap}
                    onChange={(e) => updateEditor({ showMinimap: e.target.checked })}
                  />
                  <span>Show minimap</span>
                </label>
              </>
            )}
          </section>
        </div>

        <footer style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--md-sys-color-surface-container)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.9rem' }}>
            Restore defaults only applies to the currently selected tab.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              data-testid="restore-defaults"
              onClick={handleRestore}
              style={{
                borderRadius: '12px',
                border: '1px solid var(--md-sys-color-surface-container-high)',
                background: 'transparent',
                padding: '0.65rem 1rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Restore defaults
            </button>
            <button
              onClick={onClose}
              style={{
                borderRadius: '12px',
                border: 'none',
                background: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                padding: '0.65rem 1rem',
                cursor: 'pointer',
                fontWeight: 700,
              }}
              data-testid="close-preferences"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default PreferencesDialog;
