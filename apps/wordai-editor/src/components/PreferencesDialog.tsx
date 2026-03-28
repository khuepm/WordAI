/**
 * PreferencesDialog - Modal dialog with 4 tabs: General, AI Engine, Typography, Privacy
 */

import { useState } from 'react';

type Tab = 'general' | 'ai-engine' | 'typography' | 'privacy';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'general', icon: 'settings', label: 'General' },
    { id: 'ai-engine', icon: 'psychology', label: 'AI Engine' },
    { id: 'typography', icon: 'format_size', label: 'Typography' },
    { id: 'privacy', icon: 'security', label: 'Privacy' },
  ];

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column', width: '256px', height: '100%',
      padding: '1.5rem 1rem', gap: '0.375rem',
      background: '#fafafa', borderRight: '1px solid rgba(226,232,240,0.5)',
    }}>
      <div style={{ marginBottom: '2rem', padding: '0 0.5rem' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#18181b', letterSpacing: '-0.02em', margin: 0 }}>Preferences</h1>
        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', fontWeight: 700, marginTop: '4px' }}>SYSTEM CONFIGURATION</p>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map(({ id, icon, label }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => onTabChange(id)} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              border: active ? 'none' : 'none',
              borderRight: active ? '4px solid #4f46e5' : '4px solid transparent',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#4f46e5' : '#71717a',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transform: active ? 'scale(1.02)' : 'none',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '20px',
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: '0 0.5rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(67,67,213,0.05)', borderRadius: '0.75rem', border: '1px solid rgba(67,67,213,0.1)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4343d5', marginBottom: '4px' }}>AuraSphere Pro</p>
          <p style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.5 }}>Unlock larger context windows and exclusive models.</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: '40px', height: '20px', borderRadius: '9999px',
      background: checked ? '#4343d5' : '#d4d4d8', position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '2px',
        left: checked ? 'calc(100% - 18px)' : '2px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#ffffff', transition: 'left 0.15s',
      }} />
    </div>
  );
}

function SectionHeader({ label, description }: { label: string; description?: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#18181b', margin: 0 }}>{label}</h3>
      {description && <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>{description}</p>}
    </div>
  );
}

function SettingRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1.25rem', background: 'rgba(243,244,245,0.5)',
      borderRadius: '1rem', border: '1px solid rgba(199,196,215,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: '24px' }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#18181b' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Tab: General ────────────────────────────────────────────────────────────

function GeneralTab() {
  const themes = ['System', 'Light', 'Dark', 'Glass'];
  const themePreviews = [
    { from: '#f4f4f5', to: '#d4d4d8' },
    { from: '#ffffff', to: '#ffffff' },
    { from: '#18181b', to: '#18181b' },
    { from: '#6366f1', to: '#a855f7' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Environment Workspace</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>General Settings</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8 }}>
          "Configure your core workspace environment and interaction patterns."
        </p>
      </div>

      {/* Interface Mode */}
      <div>
        <SectionHeader label="Interface Mode" description="Adjust the visual appearance of the editor shell." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {themes.map((theme, i) => (
            <label key={theme} style={{ cursor: 'pointer' }}>
              <input type="radio" name="pref-theme" defaultChecked={i === 0} style={{ display: 'none' }} />
              <div style={{
                padding: '1rem', borderRadius: '0.75rem', background: '#f3f4f5',
                border: i === 0 ? '2px solid #4343d5' : '2px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{
                  height: '80px', width: '100%', borderRadius: '4px', marginBottom: '0.75rem',
                  background: `linear-gradient(135deg, ${themePreviews[i].from}, ${themePreviews[i].to})`,
                  opacity: theme === 'Glass' ? 0.6 : 1,
                }} />
                <p style={{ fontSize: '11px', fontWeight: 700, textAlign: 'center', margin: 0 }}>{theme}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Auto-Save */}
      <div>
        <SectionHeader label="Auto-Save" description="Automatically backup your progress to the cloud library as you write." />
        <SettingRow icon="cloud_sync" label="">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Every</span>
            <input type="number" defaultValue={5} style={{
              width: '64px', height: '32px', borderRadius: '0.5rem',
              border: '1px solid rgba(199,196,215,0.3)', padding: '0 0.75rem',
              fontSize: '0.75rem', background: '#ffffff',
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>minutes</span>
          </div>
          <Toggle checked={true} />
        </SettingRow>
      </div>

      {/* Focus Mode */}
      <div>
        <SectionHeader label="Focus Mode" description="Automatically hide toolbars and secondary panels when you begin typing." />
        <SettingRow icon="visibility_off" label="Enable distraction-free shell">
          <Toggle checked={false} />
        </SettingRow>
      </div>
    </div>
  );
}

// ─── Tab: AI Engine ──────────────────────────────────────────────────────────

function AIEngineTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Default Model */}
      <div>
        <SectionHeader label="Default Model" description="The primary intelligence engine for your document generation." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { name: 'Aura-4-Turbo', icon: 'auto_awesome', desc: 'Optimized for speed and efficiency. Best for daily drafting.', active: true },
            { name: 'Aura-Pro', icon: 'diamond', desc: 'Maximum reasoning power. Ideal for complex research.', active: false },
          ].map(m => (
            <label key={m.name} style={{ cursor: 'pointer' }}>
              <input type="radio" name="pref-model" defaultChecked={m.active} style={{ display: 'none' }} />
              <div style={{
                padding: '1rem', borderRadius: '0.75rem',
                background: m.active ? 'rgba(67,67,213,0.05)' : '#f3f4f5',
                border: m.active ? '2px solid rgba(67,67,213,0.4)' : '2px solid transparent',
              }}>
                <span className="material-symbols-outlined" style={{ color: m.active ? '#4343d5' : '#a1a1aa', fontSize: '24px' }}>{m.icon}</span>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' }}>{m.name}</h4>
                <p style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.5, margin: 0 }}>{m.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ background: 'rgba(243,244,245,0.5)', padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {[
          { label: 'AI Creativity Level', desc: "Adjust the variance of the model's output.", badge: 'Medium-High', min: 0, max: 100, value: 75, marks: ['Precise', 'Balanced', 'Creative'] },
          { label: 'Context Window', desc: 'Maximum history the AI considers per interaction.', badge: '16k Tokens', min: 2000, max: 32000, step: 2000, value: 16000, marks: ['2k', '16k', '32k'] },
        ].map(s => (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{s.label}</h3>
                <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>{s.desc}</p>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(93,95,239,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{s.badge}</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step ?? 1} defaultValue={s.value}
              style={{ width: '100%', accentColor: '#4343d5' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              {s.marks.map(m => <span key={m} style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Language + Knowledge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>Response Language</label>
          <div style={{ position: 'relative' }}>
            <select style={{ width: '100%', background: '#f3f4f5', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.875rem', appearance: 'none' }}>
              <option>Auto (Detect Language)</option>
              <option>English (Global)</option>
              <option>Vietnamese (Tiếng Việt)</option>
            </select>
            <span className="material-symbols-outlined" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', pointerEvents: 'none', fontSize: '20px' }}>unfold_more</span>
          </div>
          <p style={{ fontSize: '10px', color: '#a1a1aa', fontStyle: 'italic', marginTop: '0.5rem' }}>Overrides document language settings for AI responses.</p>
        </div>
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 700, display: 'block', marginBottom: '1rem' }}>Knowledge Integration</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f3f4f5', borderRadius: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: '20px' }}>cloud_sync</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Real-time Web Access</span>
            </div>
            <Toggle checked={true} />
          </div>
        </div>
      </div>

      {/* Banner */}
      <div style={{ borderRadius: '1rem', overflow: 'hidden', background: 'linear-gradient(to right, #4343d5, #5d5fef)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>Optimizing AuraSphere</h4>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 }}>The AI Engine adapts its reasoning based on your typography choices and document structure.</p>
        </div>
        <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}>View Analytics</button>
      </div>
    </div>
  );
}

// ─── Tab: Typography ─────────────────────────────────────────────────────────

function TypographyTab() {
  const fonts = [
    { label: 'Inter (Sans)', sample: 'Aa', style: { fontFamily: 'Inter, sans-serif' } },
    { label: 'Newsreader (Serif)', sample: 'Aa', style: { fontFamily: 'Newsreader, serif' } },
    { label: 'Roboto Mono', sample: 'Aa', style: { fontFamily: 'monospace' } },
    { label: 'Helvetica Neue', sample: 'Aa', style: { fontFamily: 'Helvetica Neue, sans-serif' } },
  ];

  const smartFeatures = [
    { icon: 'format_quote', label: 'Smart Quotes', desc: 'Convert to curly quotes.', on: true },
    { icon: 'match_case', label: 'Auto-Capitalize', desc: 'Sentences start with caps.', on: false },
    { icon: 'join_inner', label: 'Ligatures', desc: 'Advanced glyph pairing.', on: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>Typography &amp; Formatting</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '0.5rem' }}>Refine the rhythm of your reading and writing experience.</p>
      </div>

      {/* Font Family */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: 0 }}>Standard Font</h3>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>Editorial grade typefaces optimized for readability.</p>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(67,67,213,0.05)', padding: '2px 8px', borderRadius: '4px' }}>PREMIUM TYPE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {fonts.map((f, i) => (
            <label key={f.label} style={{ cursor: 'pointer' }}>
              <input type="radio" name="pref-font" defaultChecked={i === 0} style={{ display: 'none' }} />
              <div style={{
                padding: '1rem', borderRadius: '0.75rem', background: '#f3f4f5',
                border: i === 0 ? '2px solid #4343d5' : '2px solid transparent',
              }}>
                <span style={{ display: 'block', fontSize: '1.5rem', marginBottom: '4px', ...f.style }}>{f.sample}</span>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>{f.label}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Font Size + Line Spacing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        {[
          { label: 'Font Size', options: ['Small', 'Medium', 'Large', 'XL'], active: 1, note: 'Base size currently set to 16px.' },
          { label: 'Line Spacing', options: ['1.15', '1.50', '2.00'], active: 0, note: 'Recommended for long-form editorial.' },
        ].map(group => (
          <div key={group.label}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', marginBottom: '1rem' }}>{group.label}</h3>
            <div style={{ display: 'flex', background: '#f3f4f5', padding: '6px', borderRadius: '0.75rem', gap: '4px' }}>
              {group.options.map((opt, i) => (
                <button key={opt} style={{
                  flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '10px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: i === group.active ? '#ffffff' : 'transparent',
                  color: i === group.active ? '#4343d5' : '#71717a',
                  boxShadow: i === group.active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: 'inherit',
                }}>{opt}</button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#a1a1aa', fontStyle: 'italic', marginTop: '0.75rem' }}>{group.note}</p>
          </div>
        ))}
      </div>

      {/* Smart Formatting */}
      <div>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', marginBottom: '1rem' }}>Smart Formatting</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {smartFeatures.map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1rem', background: '#f3f4f5', borderRadius: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <span className="material-symbols-outlined" style={{ color: f.on ? '#4343d5' : '#a1a1aa', fontSize: '20px' }}>{f.icon}</span>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>{f.label}</p>
                  <p style={{ fontSize: '10px', color: '#71717a', margin: 0, lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              </div>
              <Toggle checked={f.on} />
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{ padding: '1.5rem', background: 'rgba(243,244,245,0.5)', borderRadius: '1rem', border: '1px dashed rgba(199,196,215,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: 0 }}>Real-time Preview</h4>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa', background: '#ffffff', padding: '2px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>16pt / 1.15 LH / INTER</span>
        </div>
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f4f4f5' }}>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.25rem', marginBottom: '1rem', color: '#18181b' }}>The Modern Editorial Ethos</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', lineHeight: 1.15, color: '#3f3f46', margin: 0 }}>
            Typography is the voice of the written word. By selecting editorial grade typefaces and refining the rhythm of line spacing, you ensure that every character flows with purpose.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Privacy ────────────────────────────────────────────────────────────

function PrivacyTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Security Workspace</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>Data Sovereignty</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8 }}>
          "Your thoughts are private by design. Manage how your data interacts with our curator intelligence."
        </p>
      </div>

      {/* AI Training */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <SectionHeader label="AI Model Training" description="Anonymized snippets help improve the engine. We never store personal identifiers." />
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(93,95,239,0.1)', padding: '4px 8px', borderRadius: '4px', flexShrink: 0, marginLeft: '1rem' }}>Recommended</span>
        </div>
        <SettingRow icon="neurology" label="Liquid Intelligence Contribution">
          <Toggle checked={true} />
        </SettingRow>
      </div>

      {/* Regional Infrastructure */}
      <div>
        <SectionHeader label="Regional Data Infrastructure" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Singapore - active */}
          <div style={{ padding: '1.25rem', borderRadius: '1rem', background: '#f3f4f5', border: '1px solid rgba(67,67,213,0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '0.5rem', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.5)' }}>
                  <img
                    src="/singapore.png"
                    alt="Singapore skyline"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Primary Node</p>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Singapore Central</h4>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#4343d5', fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>check_circle</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#4343d5' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4343d5', animation: 'pulse 2s infinite' }} />
              ACTIVE CONNECTION
            </div>
          </div>
          {/* US - standby */}
          <div style={{ padding: '1.25rem', borderRadius: '1rem', background: '#f3f4f5', border: '1px solid transparent', opacity: 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '0.5rem', overflow: 'hidden', flexShrink: 0, filter: 'grayscale(1)' }}>
                  <img
                    src="/usa.png"
                    alt="United States"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Redundancy Node</p>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>United States East</h4>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#d4d4d8', fontSize: '20px' }}>schedule</span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa' }}>STANDBY MODE</div>
          </div>
        </div>
      </div>

      {/* Encryption Banner */}
      <div style={{ borderRadius: '1rem', overflow: 'hidden', position: 'relative', height: '144px' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #4849da, #5d5fef)', opacity: 0.9 }} />
        <img
          src="/gradient-banner.png"
          alt="Abstract gradient"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'overlay' }}
        />
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
          <div style={{ maxWidth: '70%' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
              End-to-End Encryption Enabled
            </h4>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 }}>
              Your drafts are never readable by humans. AI processing occurs in a volatile memory environment that wipes upon session termination.
            </p>
          </div>
          <button style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}>Audit Security</button>
        </div>
      </div>
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function DialogFooter({ onClose }: { onClose: () => void }) {
  return (
    <footer style={{
      height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', background: '#fafafa', borderTop: '1px solid rgba(199,196,215,0.1)',
      flexShrink: 0,
    }}>
      <button style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
        RESTORE DEFAULTS
      </button>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onClose} style={{
          padding: '0.625rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#52525b',
          background: 'none', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          Cancel
        </button>
        <button onClick={onClose} style={{
          padding: '0.625rem 2rem', fontSize: '0.75rem', fontWeight: 700,
          background: '#4343d5', color: '#ffffff', border: 'none', borderRadius: '0.5rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 4px 12px rgba(67,67,213,0.2)', fontFamily: 'inherit',
        }}>
          Apply Changes
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_right_alt</span>
        </button>
      </div>
    </footer>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  if (!isOpen) return null;

  const tabContent: Record<Tab, React.ReactNode> = {
    'general': <GeneralTab />,
    'ai-engine': <AIEngineTab />,
    'typography': <TypographyTab />,
    'privacy': <PrivacyTab />,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(25,28,29,0.05)', backdropFilter: 'blur(4px)',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 901,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: '900px', height: '870px',
          background: '#ffffff', borderRadius: '0.75rem',
          display: 'flex', overflow: 'hidden',
          boxShadow: '0 0 40px -5px rgba(67,67,213,0.08), 0 20px 60px rgba(0,0,0,0.12)',
          outline: '1px solid rgba(199,196,215,0.1)',
          pointerEvents: 'all',
        }}>
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
            {/* Content header */}
            <header style={{
              height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 2rem', borderBottom: '1px solid rgba(199,196,215,0.08)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                  {{ general: 'General Settings', 'ai-engine': 'AI Engine Settings', typography: 'Typography & Formatting', privacy: 'Privacy & Security' }[activeTab]}
                </h2>
                {activeTab === 'ai-engine' && (
                  <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>Active</span>
                )}
                {activeTab === 'privacy' && (
                  <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>Shield Active</span>
                )}
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', display: 'flex', padding: '4px' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
              {tabContent[activeTab]}
            </div>
            <DialogFooter onClose={onClose} />
          </section>
        </div>
      </div>
    </>
  );
}

export default PreferencesDialog;
