/**
 * PreferencesDialog - Modal dialog with 4 tabs: General, AI Engine, Typography, Privacy
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Tab } from '../types/preferences';
import { Tooltip } from './Tooltip';
import { useViewportSize, MODAL_BREAKPOINTS } from '../hooks/useViewportSize';
import { getAuraBrainStoragePath, getFileManagerLabel } from '../services/platformService';
import { AVAILABLE_LANGUAGES, saveLanguagePreference, type LanguageCode } from '../i18n';
import { SETTING_REGISTRY } from '../data/settingRegistry';
import { filterSettings, SETTING_I18N_MAP } from './QuickSearchPopup';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: () => void | Promise<void>;
  initialTab?: Tab;
  targetSettingId?: string;
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ activeTab, onTabChange, isSearching, onClearSearch }: { activeTab: Tab; onTabChange: (t: Tab) => void; isSearching: boolean; onClearSearch: () => void }) {
  const { t } = useTranslation();
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'general', icon: 'settings', label: t('settings.tabs.general') },
    { id: 'ai-engine', icon: 'psychology', label: t('settings.tabs.aiEngine') },
    { id: 'typography', icon: 'format_size', label: t('settings.tabs.typography') },
    { id: 'privacy', icon: 'security', label: t('settings.tabs.privacy') },
    { id: 'about', icon: 'info', label: t('settings.tabs.about') },
  ];

  return (
    <aside className="flex flex-col w-64 py-6 px-4 bg-zinc-50 border-r border-zinc-200/20 rounded-l-lg justify-between">
      <div>
        <div className="mb-8 px-2">
          <h1 className="text-lg font-black tracking-tight text-zinc-900 m-0">{t('settings.title')}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t('settings.sidebar.systemConfiguration')}</p>
        </div>
        <nav className="flex-1 flex flex-col gap-1.5">
          {items.map(({ id, icon, label }) => {
            const active = activeTab === id && !isSearching;
            return (
              <button
                key={id}
                onClick={() => { onTabChange(id); onClearSearch(); }}
                className={[
                  "flex items-center gap-3 py-2.5 px-3 rounded-lg border-0 cursor-pointer",
                  "font-['Manrope'] text-sm font-medium tracking-wide uppercase",
                  "transition-transform duration-200",
                  active
                    ? "bg-white text-indigo-600 shadow-sm border-r-4 border-indigo-500"
                    : "text-zinc-500 hover:bg-zinc-100 hover:translate-x-1",
                ].join(' ')}
                style={{
                  borderRight: active ? '4px solid #6366f1' : '4px solid transparent',
                }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}>{icon}</span>
                {label}
              </button>
            );
          })}
          {isSearching && (
            <div className="mt-4 pt-4">
              <button className={[
                "flex items-center gap-3 py-2.5 px-3 rounded-lg border-0 cursor-pointer w-full",
                "font-['Manrope'] text-sm font-medium tracking-wide uppercase",
                "bg-indigo-50 text-indigo-600 shadow-sm",
              ].join(' ')}
                style={{ borderLeft: '4px solid #4343d5' }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
                {t('settings.search.results')}
              </button>
            </div>
          )}
        </nav>
      </div>
      <div>
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
          <p className="text-xs font-semibold text-primary mb-1">{t('settings.sidebar.proCard.title')}</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('settings.sidebar.proCard.description')}</p>
        </div>
      </div>
    </aside>
  );
}

// ─── CollapsedSidebar ────────────────────────────────────────────────────────

interface CollapsedSidebarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  isSearching: boolean;
  onClearSearch: () => void;
}

export function CollapsedSidebar({ activeTab, onTabChange, isSearching, onClearSearch }: CollapsedSidebarProps) {
  const { t } = useTranslation();
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'general', icon: 'settings', label: t('settings.tabs.general') },
    { id: 'ai-engine', icon: 'psychology', label: t('settings.tabs.aiEngine') },
    { id: 'typography', icon: 'format_size', label: t('settings.tabs.typography') },
    { id: 'privacy', icon: 'security', label: t('settings.tabs.privacy') },
    { id: 'about', icon: 'info', label: t('settings.tabs.about') },
  ];

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 'var(--modal-sidebar-collapsed-width, 64px)',
      height: '100%',
      padding: '1.5rem 0',
      gap: '0.375rem',
      background: '#fafafa',
      boxShadow: '2px 0 8px rgba(0,0,0,0.03)',
      flexShrink: 0,
    }}>
      {/* Header indicator */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#4343d5', fontVariationSettings: "'FILL' 1" }}>
          settings
        </span>
      </div>

      {/* Tab buttons */}
      <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
        {items.map(({ id, icon, label }) => {
          const active = activeTab === id && !isSearching;
          return (
            <Tooltip key={id} text={label} position="right">
              <button
                aria-label={label}
                onClick={() => { onTabChange(id); onClearSearch(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#4f46e5' : '#71717a',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transform: active ? 'scale(1.05)' : 'none',
                  transition: 'all 0.15s',
                  outline: active ? '2px solid rgba(79,70,229,0.2)' : 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: '20px',
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}>{icon}</span>
              </button>
            </Tooltip>
          );
        })}

        {/* Search state */}
        {isSearching && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <Tooltip text={t('settings.search.results')} position="right">
              <button
                aria-label={t('settings.search.results')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'rgba(67,67,213,0.05)',
                  color: '#4343d5',
                  outline: '2px solid rgba(67,67,213,0.2)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>search</span>
              </button>
            </Tooltip>
            <Tooltip text={t('settings.search.clear')} position="right">
              <button
                aria-label={t('settings.search.clear')}
                onClick={onClearSearch}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#a1a1aa',
                  transition: 'all 0.15s',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </Tooltip>
          </div>
        )}
      </nav>
    </aside>
  );
}

// ─── HorizontalTabBar ───────────────────────────────────────────────────────

export interface HorizontalTabBarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}

export function HorizontalTabBar({ activeTab, onTabChange }: HorizontalTabBarProps) {
  const { t } = useTranslation();
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'general', icon: 'settings', label: t('settings.tabs.general') },
    { id: 'ai-engine', icon: 'psychology', label: t('settings.tabs.aiEngine') },
    { id: 'typography', icon: 'format_size', label: t('settings.tabs.typography') },
    { id: 'privacy', icon: 'security', label: t('settings.tabs.privacy') },
    { id: 'about', icon: 'info', label: t('settings.tabs.about') },
  ];

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '4px',
        padding: '8px 16px',
        borderBottom: '1px solid rgba(199,196,215,0.15)',
        background: '#fafafa',
        overflowX: 'auto',
      }}
    >
      {items.map(({ id, icon, label }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#4f46e5' : '#71717a',
              borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '18px',
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {icon}
            </span>
            {label}
          </button>
        );
      })}
    </div>
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
      borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
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

interface GeneralTabProps {
  pendingLang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

function GeneralTab({ pendingLang, onLanguageChange }: GeneralTabProps) {
  const { t } = useTranslation();
  const themes = [
    { key: 'system', label: t('settings.general.interfaceMode.themes.system') },
    { key: 'light', label: t('settings.general.interfaceMode.themes.light') },
    { key: 'dark', label: t('settings.general.interfaceMode.themes.dark') },
    { key: 'glass', label: t('settings.general.interfaceMode.themes.glass') },
  ];
  const themePreviews = [
    { from: '#f4f4f5', to: '#d4d4d8' },
    { from: '#ffffff', to: '#ffffff' },
    { from: '#18181b', to: '#18181b' },
    { from: '#6366f1', to: '#a855f7' },
  ];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as LanguageCode;
    onLanguageChange(newLang);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>{t('settings.tabs.general')}</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>{t('settings.title')}</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8 }}>
          {t('app.tagline')}
        </p>
      </div>

      {/* Interface Mode */}
      <div data-setting-id="general.theme">
        <SectionHeader label={t('settings.general.interfaceMode.label')} description={t('settings.general.interfaceMode.description')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
          {themes.map((theme, i) => (
            <label key={theme.key} style={{ cursor: 'pointer' }}>
              <input type="radio" name="pref-theme" defaultChecked={i === 0} style={{ display: 'none' }} />
              <div style={{
                padding: '1rem', borderRadius: '0.75rem', background: '#f3f4f5',
                border: i === 0 ? '2px solid #4343d5' : '2px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{
                  height: '80px', width: '100%', borderRadius: '4px', marginBottom: '0.75rem',
                  background: `linear-gradient(135deg, ${themePreviews[i].from}, ${themePreviews[i].to})`,
                  opacity: theme.key === 'glass' ? 0.6 : 1,
                }} />
                <p style={{ fontSize: '11px', fontWeight: 700, textAlign: 'center', margin: 0 }}>{theme.label}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Auto-Save */}
      <div data-setting-id="general.autoSave">
        <SectionHeader label={t('settings.general.autoSave.label')} description={t('settings.general.autoSave.description')} />
        <SettingRow icon="cloud_sync" label="">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{t('settings.general.autoSave.every')}</span>
            <input type="number" defaultValue={5} min={1} max={60} step={1} style={{
              width: '64px', height: '32px', borderRadius: '0.75rem',
              border: 'none', padding: '0 0.75rem',
              fontSize: '0.75rem', background: '#f4f4f5',
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{t('settings.general.autoSave.minutes')}</span>
          </div>
          <Toggle checked={true} />
        </SettingRow>
      </div>

      {/* Focus Mode */}
      <div data-setting-id="general.focusMode">
        <SectionHeader label={t('settings.general.focusMode.label')} description={t('settings.general.focusMode.description')} />
        <SettingRow icon="visibility_off" label={t('settings.general.focusMode.enable')}>
          <Toggle checked={false} />
        </SettingRow>
      </div>

      {/* Interface Language */}
      <div data-setting-id="general.language">
        <SectionHeader label={t('settings.general.language.label')} description={t('settings.general.language.description')} />
        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
          <select
            value={pendingLang}
            onChange={handleLanguageChange}
            style={{
              width: '100%',
              background: 'rgba(243,244,245,0.5)',
              border: 'none',
              borderRadius: '1rem',
              padding: '1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              appearance: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            }}
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined" style={{
            position: 'absolute',
            right: '1.25rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#4343d5',
            pointerEvents: 'none',
            fontSize: '20px'
          }}>unfold_more</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: AI Engine ──────────────────────────────────────────────────────────

function AgentIconBox({ icon, active, fill }: { icon: string; active: boolean; fill?: boolean }) {
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '0.5rem', flexShrink: 0,
      background: active ? 'rgba(67,67,213,0.1)' : 'rgba(212,212,216,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.15s',
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: '20px', color: active ? '#4343d5' : '#a1a1aa',
        fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0",
      }}>{icon}</span>
    </div>
  );
}

function AIEngineTab() {
  const { t } = useTranslation();
  const [selectedAgent, setSelectedAgent] = useState<string>('claude');
  const [selectedModel, setSelectedModel] = useState<string>('aura-turbo');

  const agents = [
    { id: 'codex', icon: 'terminal', label: t('settings.aiEngine.agent.codex.label'), desc: t('settings.aiEngine.agent.codex.description') },
    { id: 'claude', icon: 'neurology', label: t('settings.aiEngine.agent.claude.label'), desc: t('settings.aiEngine.agent.claude.description'), fill: true },
    { id: 'gemini', icon: 'token', label: t('settings.aiEngine.agent.gemini.label'), desc: t('settings.aiEngine.agent.gemini.description') },
  ];

  const models = [
    { id: 'aura-turbo', icon: 'auto_awesome', label: t('settings.aiEngine.models.turbo.label'), desc: t('settings.aiEngine.models.turbo.description'), status: t('settings.aiEngine.models.turbo.status'), statusColor: '#10b981', pro: false },
    { id: 'aura-pro', icon: 'diamond', label: t('settings.aiEngine.models.proModel.label'), desc: t('settings.aiEngine.models.proModel.description'), status: t('settings.aiEngine.models.proModel.status'), statusColor: '#a1a1aa', pro: true },
  ];

  const sliders = [
    { label: t('settings.aiEngine.creativity.label'), desc: t('settings.aiEngine.creativity.description'), badge: t('settings.aiEngine.creativity.badge'), min: 0, max: 100, value: 75, marks: [t('settings.aiEngine.creativity.marks.precise'), t('settings.aiEngine.creativity.marks.balanced'), t('settings.aiEngine.creativity.marks.creative')], settingId: 'ai-engine.creativity' },
    { label: t('settings.aiEngine.contextWindow.label'), desc: t('settings.aiEngine.contextWindow.description'), badge: t('settings.aiEngine.contextWindow.badge'), min: 2000, max: 32000, step: 2000, value: 16000, marks: ['2k', '16k', '32k'], settingId: 'ai-engine.contextWindowTokens' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

      {/* Intro */}
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>{t('settings.aiEngine.intro.eyebrow')}</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>{t('settings.aiEngine.intro.title')}</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8, margin: '1rem 0 0' }}>
          "{t('settings.aiEngine.intro.quote')}"
        </p>
      </div>

      {/* Connect Agent */}
      <div data-setting-id="ai-engine.agent">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#18181b', margin: 0 }}>{t('settings.aiEngine.agent.title')}</h3>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>{t('settings.aiEngine.agent.description')}</p>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(93,95,239,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{t('settings.aiEngine.agent.activeBadge')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {agents.map(a => {
            const active = selectedAgent === a.id;
            return (
              <label key={a.id} style={{ cursor: 'pointer' }}>
                <input type="radio" name="pref-agent" checked={active} onChange={() => setSelectedAgent(a.id)} style={{ display: 'none' }} />
                <div style={{
                  padding: '1rem', borderRadius: '0.75rem', height: '100%', boxSizing: 'border-box',
                  background: active ? 'rgba(67,67,213,0.05)' : '#f3f4f5',
                  border: active ? '2px solid rgba(67,67,213,0.4)' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <AgentIconBox icon={a.icon} active={active} fill={a.fill} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4343d5', opacity: active ? 1 : 0, transition: 'opacity 0.15s', marginTop: '4px' }} />
                  </div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px', color: '#18181b' }}>{a.label}</h4>
                  <p style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.5, margin: 0 }}>{a.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Aura Models */}
      <div data-setting-id="ai-engine.model">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#18181b', margin: 0 }}>{t('settings.aiEngine.models.title')}</h3>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa', background: '#f4f4f5', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.aiEngine.models.proBadge')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {models.map(m => {
            const active = selectedModel === m.id;
            return (
              <label key={m.id} style={{ cursor: m.pro ? 'not-allowed' : 'pointer' }}>
                <input type="radio" name="pref-model" checked={active} onChange={() => !m.pro && setSelectedModel(m.id)} style={{ display: 'none' }} />
                <div style={{
                  padding: '1.25rem', borderRadius: '0.75rem',
                  background: active ? 'rgba(67,67,213,0.05)' : '#f3f4f5',
                  border: active ? '2px solid rgba(67,67,213,0.4)' : '2px solid transparent',
                  opacity: m.pro ? 0.6 : 1, transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <AgentIconBox icon={m.icon} active={active && !m.pro} fill={!m.pro} />
                    {m.pro
                      ? <span style={{ fontSize: '9px', fontWeight: 900, color: '#904400', background: 'rgba(144,68,0,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.aiEngine.models.pro')}</span>
                      : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4343d5', opacity: active ? 1 : 0, transition: 'opacity 0.15s', marginTop: '4px' }} />
                    }
                  </div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px', color: '#18181b' }}>{m.label}</h4>
                  <p style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.5, margin: '0 0 0.75rem' }}>{m.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.statusColor }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: m.statusColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.status}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ background: 'rgba(243,244,245,0.5)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(199,196,215,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sliders.map((s) => (
          <div key={s.label} data-setting-id={s.settingId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div data-setting-id="ai-engine.responseLanguage">
          <label style={{ fontSize: '0.875rem', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>{t('settings.aiEngine.responseLanguage.label')}</label>
          <div style={{ position: 'relative' }}>
            <select style={{ width: '100%', background: '#f3f4f5', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.875rem', appearance: 'none', fontFamily: 'inherit' }}>
              <option>{t('settings.aiEngine.responseLanguage.auto')}</option>
              <option>{t('settings.aiEngine.responseLanguage.english')}</option>
              <option>{t('settings.aiEngine.responseLanguage.vietnamese')}</option>
            </select>
            <span className="material-symbols-outlined" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', pointerEvents: 'none', fontSize: '18px' }}>unfold_more</span>
          </div>
          <p style={{ fontSize: '10px', color: '#a1a1aa', fontStyle: 'italic', marginTop: '0.5rem' }}>{t('settings.aiEngine.responseLanguage.description')}</p>
        </div>
        <div data-setting-id="ai-engine.webAccess">
          <label style={{ fontSize: '0.875rem', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>{t('settings.aiEngine.knowledge.label')}</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem', background: '#f3f4f5', borderRadius: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>cloud_sync</span>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#18181b', display: 'block' }}>{t('settings.aiEngine.knowledge.webAccess')}</span>
                <span style={{ fontSize: '10px', color: '#a1a1aa' }}>{t('settings.aiEngine.knowledge.liveData')}</span>
              </div>
            </div>
            <Toggle checked={true} />
          </div>
          <p style={{ fontSize: '10px', color: '#a1a1aa', fontStyle: 'italic', marginTop: '0.5rem' }}>{t('settings.aiEngine.knowledge.description')}</p>
        </div>
      </div>

    </div>
  );
}

// ─── Tab: Typography ─────────────────────────────────────────────────────────

function TypographyTab() {
  const { t } = useTranslation();
  const fonts = [
    { label: t('settings.typography.font.inter'), sample: 'Aa', style: { fontFamily: 'Inter, sans-serif' } },
    { label: t('settings.typography.font.newsreader'), sample: 'Aa', style: { fontFamily: 'Newsreader, serif' } },
    { label: t('settings.typography.font.robotoMono'), sample: 'Aa', style: { fontFamily: 'monospace' } },
    { label: t('settings.typography.font.helvetica'), sample: 'Aa', style: { fontFamily: 'Helvetica Neue, sans-serif' } },
  ];

  const smartFeatures = [
    { icon: 'format_quote', label: t('settings.typography.smart.quotes.label'), desc: t('settings.typography.smart.quotes.description'), on: true, settingId: 'typography.smartQuotes' },
    { icon: 'match_case', label: t('settings.typography.smart.autoCapitalize.label'), desc: t('settings.typography.smart.autoCapitalize.description'), on: false, settingId: 'typography.autoCapitalize' },
    { icon: 'join_inner', label: t('settings.typography.smart.ligatures.label'), desc: t('settings.typography.smart.ligatures.description'), on: true, settingId: 'typography.ligatures' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>{t('settings.typography.sectionTitle')}</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '0.5rem' }}>{t('settings.typography.sectionDescription')}</p>
      </div>

      {/* Font Family */}
      <div data-setting-id="typography.fontFamily">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: 0 }}>{t('settings.typography.font.standardFont')}</h3>
            <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '2px' }}>{t('settings.typography.font.standardFontDescription')}</p>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(67,67,213,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{t('settings.typography.font.premiumBadge')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem' }}>
        {[
          { label: t('settings.typography.fontSize.label'), options: [t('settings.typography.fontSize.small'), t('settings.typography.fontSize.medium'), t('settings.typography.fontSize.large'), t('settings.typography.fontSize.xl')], active: 1, note: t('settings.typography.fontSize.note'), settingId: 'typography.fontSize' },
          { label: t('settings.typography.lineSpacing.label'), options: ['1.15', '1.50', '2.00'], active: 0, note: t('settings.typography.lineSpacing.note'), settingId: 'typography.lineSpacing' },
        ].map(group => (
          <div key={group.label} data-setting-id={group.settingId}>
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
        <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', marginBottom: '1rem' }}>{t('settings.typography.smart.title')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {smartFeatures.map(f => (
            <div key={f.label} data-setting-id={f.settingId} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1rem', background: '#f3f4f5', borderRadius: '0.75rem' }}>
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
      <div style={{ padding: '1.5rem', background: 'rgba(243,244,245,0.5)', borderRadius: '1rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a1a1aa', margin: 0 }}>{t('settings.typography.preview.label')}</h4>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa', background: '#ffffff', padding: '2px 8px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>{t('settings.typography.preview.badge')}</span>
        </div>
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f4f4f5' }}>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.25rem', marginBottom: '1rem', color: '#18181b' }}>{t('settings.typography.preview.title')}</h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', lineHeight: 1.15, color: '#3f3f46', margin: 0 }}>
            {t('settings.typography.preview.body')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Privacy ────────────────────────────────────────────────────────────

function PrivacyTab() {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>{t('settings.privacy.intro.eyebrow')}</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>{t('settings.privacy.intro.title')}</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8 }}>
          "{t('settings.privacy.intro.quote')}"
        </p>
      </div>

      {/* AI Training */}
      <div data-setting-id="privacy.allowAITraining">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <SectionHeader label={t('settings.privacy.aiTraining.label')} description={t('settings.privacy.aiTraining.description')} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'rgba(93,95,239,0.1)', padding: '4px 8px', borderRadius: '4px', flexShrink: 0, marginLeft: '1rem' }}>{t('settings.privacy.aiTraining.recommended')}</span>
        </div>
        <SettingRow icon="neurology" label={t('settings.privacy.aiTraining.liquidIntelligence')}>
          <Toggle checked={true} />
        </SettingRow>
      </div>

      {/* Regional Infrastructure */}
      <div data-setting-id="privacy.analyticsEnabled">
        <SectionHeader label={t('settings.privacy.regionalInfrastructure.label')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Singapore - active */}
          <div style={{ padding: '1.25rem', borderRadius: '1rem', background: 'rgba(67,67,213,0.08)', position: 'relative', overflow: 'hidden' }}>
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
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#4343d5', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>{t('settings.privacy.regionalInfrastructure.primary')}</p>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{t('settings.privacy.regionalInfrastructure.singapore')}</h4>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#4343d5', fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>check_circle</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#4343d5' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4343d5', animation: 'pulse 2s infinite' }} />
              {t('settings.privacy.regionalInfrastructure.active')}
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
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>{t('settings.privacy.regionalInfrastructure.redundancy')}</p>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>{t('settings.privacy.regionalInfrastructure.unitedStates')}</h4>
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#d4d4d8', fontSize: '20px' }}>schedule</span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#a1a1aa' }}>{t('settings.privacy.regionalInfrastructure.standby')}</div>
          </div>
        </div>
      </div>

      {/* Encryption Banner */}
      <div data-setting-id="privacy.crashReports" style={{ borderRadius: '1rem', overflow: 'hidden', position: 'relative', height: '144px' }}>
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
              {t('settings.privacy.encryptionEnabled')}
            </h4>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0 }}>
              {t('settings.privacy.encryptionDescription')}
            </p>
          </div>
          <button style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}>{t('settings.privacy.auditSecurity')}</button>
        </div>
      </div>
      <div data-setting-id="privacy.localProcessingOnly" style={{ padding: '1.25rem 1.5rem', borderRadius: '1rem', border: '1px solid #e0e0e0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{t('settings.privacy.localProcessing.label')}</h3>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#555' }}>
            {t('settings.privacy.localProcessing.description')}
          </p>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#333', cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: '14px', height: '14px' }} />
          <span>{t('settings.privacy.localProcessing.prefer')}</span>
        </label>
      </div>
    </div>
  );
}

// ─── Tab: About ──────────────────────────────────────────────────────────────

function AboutTab() {
  const { t } = useTranslation();
  const [storagePath, setStoragePath] = useState('');
  const [revealError, setRevealError] = useState<string | null>(null);

  // Get platform-specific reveal label using translations
  const platformKey = (() => {
    const label = getFileManagerLabel();
    if (label.includes('Finder')) return 'mac';
    if (label.includes('Explorer')) return 'win';
    return 'linux';
  })();
  const revealLabel = t(`settings.about.revealButton.${platformKey}`);

  useEffect(() => {
    getAuraBrainStoragePath()
      .then(setStoragePath)
      .catch(() => setStoragePath(''));
  }, []);

  async function handleReveal() {
    try {
      setRevealError(null);
      await invoke('reveal_in_file_manager', { path: storagePath });
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#4343d5', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>{t('settings.tabs.about')}</span>
        <h3 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>{t('settings.about.title')}</h3>
        <p style={{ fontFamily: 'Newsreader, serif', fontSize: '1.125rem', fontStyle: 'italic', color: '#71717a', marginTop: '1rem', opacity: 0.8 }}>
          "{t('app.tagline')}"
        </p>
      </div>

      {/* AuraBrain Storage Path */}
      <div data-setting-id="about.auraBrainStoragePath">
        <SectionHeader label={t('settings.about.storagePath.label')} description={t('settings.about.storagePath.description')} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1.25rem', background: 'rgba(243,244,245,0.5)',
          borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}>
          <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: '24px', flexShrink: 0 }}>folder</span>
          <code style={{
            flex: 1, fontSize: '0.8125rem', fontFamily: 'monospace',
            color: '#18181b', wordBreak: 'break-all',
          }}>{storagePath}</code>
          <button
            onClick={handleReveal}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              fontSize: '0.75rem', fontWeight: 700,
              background: '#4343d5', color: '#ffffff',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              fontFamily: 'inherit',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
            {revealLabel}
          </button>
        </div>
        {revealError && (
          <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
            {revealError}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Search Results ─────────────────────────────────────────────────────

function SearchResultsTab({ query, onNavigate }: { query: string; onNavigate: (tab: Tab, settingId: string) => void }) {
  const { t } = useTranslation();

  // Build translated entries for bilingual matching
  const translatedEntries = SETTING_REGISTRY.map((entry) => {
    const keys = SETTING_I18N_MAP[entry.id];
    return {
      id: entry.id,
      label: keys ? t(keys.label) : entry.label,
      description: keys ? t(keys.description) : entry.description,
    };
  });

  const results = filterSettings(query, translatedEntries);

  const tabLabels: Record<Tab, string> = {
    'general': t('settings.tabs.general'),
    'ai-engine': t('settings.tabs.aiEngine'),
    'typography': t('settings.tabs.typography'),
    'privacy': t('settings.tabs.privacy'),
    'about': t('settings.tabs.about'),
  };

  const tabIcons: Record<Tab, string> = {
    'general': 'settings',
    'ai-engine': 'psychology',
    'typography': 'format_size',
    'privacy': 'security',
    'about': 'info',
  };

  const tabColors: Record<Tab, { bg: string; color: string }> = {
    'general': { bg: '#f4f4f5', color: '#52525b' },
    'ai-engine': { bg: '#eef2ff', color: '#4343d5' },
    'typography': { bg: '#f0fdf4', color: '#16a34a' },
    'privacy': { bg: '#fff7ed', color: '#ea580c' },
    'about': { bg: '#f0f9ff', color: '#0284c7' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>
          {t('settings.search.showingFor', { query })}
        </h3>
        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '4px' }}>
          {t('settings.search.itemsFound', { count: results.length })}
        </p>
      </div>

      {results.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.75rem', color: '#a1a1aa', paddingTop: '3rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', opacity: 0.4 }}>search_off</span>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>{t('settings.search.noResults', 'Không tìm thấy cài đặt nào.')}</p>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid #f4f4f5', display: 'flex', flexDirection: 'column' }}>
          {results.map((entry) => {
            const colors = tabColors[entry.tab];
            const translated = translatedEntries.find((te) => te.id === entry.id);
            const displayLabel = translated?.label ?? entry.label;
            const displayDesc = translated?.description ?? entry.description;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1.5rem',
                  padding: '1.25rem 0.5rem', borderBottom: '1px solid #f4f4f5',
                  cursor: 'pointer', transition: 'background 0.15s',
                  margin: '0 -0.5rem', borderRadius: '0.5rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => onNavigate(entry.tab, entry.id)}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '0.5rem',
                  background: colors.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: colors.color, flexShrink: 0,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
                    {tabIcons[entry.tab]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#18181b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayLabel}
                    </h4>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, color: colors.color,
                      background: colors.bg, padding: '2px 8px', borderRadius: '9999px',
                      textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                    }}>
                      {tabLabels[entry.tab]}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayDesc}
                  </p>
                </div>
                <button
                  tabIndex={-1}
                  style={{
                    fontSize: '10px', fontWeight: 700, color: '#4343d5', background: 'none',
                    border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                    letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px',
                    flexShrink: 0, fontFamily: 'inherit', pointerEvents: 'none',
                  }}>
                  {t('common.configure')} <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─── Footer ──────────────────────────────────────────────────────────────────

function DialogFooter({ onClose, onApply }: { onClose: () => void; onApply?: () => void | Promise<void> }) {
  const { t } = useTranslation();

  async function handleApply() {
    await onApply?.();
    onClose();
  }

  return (
    <footer style={{
      height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', background: '#fafafa', borderTop: '1px solid rgba(199,196,215,0.1)',
      flexShrink: 0,
    }}>
      <button style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
        {t('common.restoreDefaults')}
      </button>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onClose} style={{
          padding: '0.625rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#52525b',
          background: 'none', border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {t('common.cancel')}
        </button>
        <button onClick={handleApply} style={{
          padding: '0.625rem 2rem', fontSize: '0.75rem', fontWeight: 700,
          background: '#4343d5', color: '#ffffff', border: 'none', borderRadius: '0.75rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 4px 12px rgba(67,67,213,0.2)', transition: 'all 0.2s', fontFamily: 'inherit',
        }}>
          {t('common.apply')}
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_right_alt</span>
        </button>
      </div>
    </footer>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function PreferencesDialog({ isOpen, onClose, onApply, initialTab, targetSettingId }: PreferencesDialogProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  // Language state management for cancel/apply behavior
  const [pendingLang, setPendingLang] = useState<LanguageCode>(i18n.language as LanguageCode || 'en');
  const originalLangRef = useRef<LanguageCode>(i18n.language as LanguageCode || 'en');

  const { width } = useViewportSize();
  const isCollapsed = width < MODAL_BREAKPOINTS.COLLAPSE_SIDEBAR;
  const isStacked = width < MODAL_BREAKPOINTS.STACK_LAYOUT;

  // Sync to initialTab and capture original language when dialog opens
  const prevIsOpen = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpen.current;
    prevIsOpen.current = isOpen;
    if (justOpened) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      // Capture current language as original when dialog opens
      const currentLang = i18n.language as LanguageCode || 'en';
      originalLangRef.current = currentLang;
      setPendingLang(currentLang);
    }
  }, [isOpen, initialTab, i18n.language]);

  // Handle language change from GeneralTab
  const handleLanguageChange = useCallback((newLang: LanguageCode) => {
    setPendingLang(newLang);
    // Apply immediately for preview, will be reverted on cancel if needed
    i18n.changeLanguage(newLang);
  }, [i18n]);

  // Handle close with cancel - revert language if changed
  const handleClose = useCallback(() => {
    // Revert to original language if user cancelled
    if (pendingLang !== originalLangRef.current) {
      i18n.changeLanguage(originalLangRef.current);
    }
    onClose();
  }, [onClose, pendingLang, i18n]);

  // Handle apply - save language preference
  // Note: DialogFooter.handleApply calls onClose after this, so we don't call it here
  const handleApply = useCallback(async () => {
    // Save language preference
    if (pendingLang !== originalLangRef.current) {
      saveLanguagePreference(pendingLang);
      originalLangRef.current = pendingLang;
    }
    await onApply?.();
    // onClose is called by DialogFooter.handleApply after this function completes
  }, [onApply, pendingLang]);

  // Navigate from search result to the actual setting: switch tab, clear search, then scroll
  const handleNavigateToSetting = useCallback((tab: Tab, settingId: string) => {
    setActiveTab(tab);
    setSearchQuery('');
    setPendingScrollId(settingId);
  }, []);

  // After tab content renders, scroll to the pending setting and highlight it
  useEffect(() => {
    if (!pendingScrollId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-setting-id="${pendingScrollId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight animation
        el.style.transition = 'background 0.2s';
        el.style.background = 'rgba(67,67,213,0.08)';
        setTimeout(() => {
          el.style.background = '';
        }, 1200);
      }
      setPendingScrollId(null);
    }, 80);
    return () => clearTimeout(timer);
  }, [pendingScrollId]);

  useEffect(() => {
    if (!targetSettingId || !isOpen) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-setting-id="${targetSettingId}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [targetSettingId, isOpen]);

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus first element when dialog opens
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [isOpen]);

  // Focus trap: handle Tab/Shift+Tab
  const handleFocusTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!isOpen) return null;

  const tabContent: Record<Tab, React.ReactNode> = {
    'general': <GeneralTab
      pendingLang={pendingLang}
      onLanguageChange={handleLanguageChange}
    />,
    'ai-engine': <AIEngineTab />,
    'typography': <TypographyTab />,
    'privacy': <PrivacyTab />,
    'about': <AboutTab />,
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
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
        <div
          ref={modalRef}
          onKeyDown={handleFocusTrap}
          style={{
            width: '100%', maxWidth: 'var(--modal-max-width-preferences, min(900px, calc(100vw - 48px)))', maxHeight: 'var(--modal-max-height-preferences, min(680px, calc(100vh - 80px)))',
            background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(20px)', borderRadius: '0.75rem',
            display: 'flex', flexDirection: isStacked ? 'column' : 'row', overflow: 'hidden',
            boxShadow: '0 0 40px -5px rgba(67,67,213,0.08), 0 20px 60px rgba(0,0,0,0.12)',
            pointerEvents: 'all',
          }}>
          {isStacked ? (
            <HorizontalTabBar activeTab={activeTab} onTabChange={setActiveTab} />
          ) : isCollapsed ? (
            <CollapsedSidebar activeTab={activeTab} onTabChange={setActiveTab} isSearching={isSearching} onClearSearch={() => setSearchQuery('')} />
          ) : (
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isSearching={isSearching} onClearSearch={() => setSearchQuery('')} />
          )}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', minWidth: 0 }}>
            {/* Content header */}
            <header style={{
              height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 2rem', borderBottom: '1px solid rgba(199,196,215,0.08)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                  {isSearching ? t('settings.search.results') : {
                    general: t('settings.general.sectionTitle'),
                    'ai-engine': t('settings.aiEngine.sectionTitle'),
                    typography: t('settings.tabs.typography'),
                    privacy: t('settings.privacy.sectionTitle'),
                    about: t('settings.about.title')
                  }[activeTab]}
                </h2>
                {!isSearching && activeTab === 'ai-engine' && (
                  <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>{t('settings.aiEngine.active')}</span>
                )}
                {!isSearching && activeTab === 'privacy' && (
                  <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>{t('common.shieldActive')}</span>
                )}
                {isSearching && (
                  <span style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 500 }}>{t('settings.search.itemsFound', { count: 4 })}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#4343d5', fontSize: '14px', fontWeight: 700 }}>search</span>
                  <input
                    type="text"
                    placeholder={t('settings.search.placeholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      fontSize: '0.75rem', background: '#f3f4f5', border: 'none', borderRadius: '9999px',
                      padding: '0.5rem 1rem 0.5rem 2.25rem', width: '256px', fontWeight: 500, outline: 'none',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', display: 'flex', padding: '4px' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </header>
            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', height: '100%', minWidth: 0 }}>
              {isSearching ? <SearchResultsTab query={searchQuery} onNavigate={handleNavigateToSetting} /> : tabContent[activeTab]}
            </div>
            <DialogFooter onClose={handleClose} onApply={handleApply} />
          </section>
        </div>
      </div>
    </>
  );
}

export default PreferencesDialog;

// ─── PreferencesDialogContent (for standalone OS window) ─────────────────────

interface PreferencesDialogContentProps {
  initialTab?: Tab;
  targetSettingId?: string;
  onClose: () => void;
  onApply?: () => void | Promise<void>;
  isWindowed?: boolean;
}

/**
 * Standalone content component for the Preferences window.
 * Renders the same UI as PreferencesDialog but without the modal overlay/backdrop,
 * suitable for rendering inside a separate OS window.
 */
export function PreferencesDialogContent({ initialTab, targetSettingId, onClose, onApply, isWindowed }: PreferencesDialogContentProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const [pendingLang, setPendingLang] = useState<LanguageCode>(i18n.language as LanguageCode || 'en');
  const originalLangRef = useRef<LanguageCode>(i18n.language as LanguageCode || 'en');

  const { width } = useViewportSize();
  const isCollapsed = width < MODAL_BREAKPOINTS.COLLAPSE_SIDEBAR;
  const isStacked = width < MODAL_BREAKPOINTS.STACK_LAYOUT;

  const handleLanguageChange = useCallback((newLang: LanguageCode) => {
    setPendingLang(newLang);
    i18n.changeLanguage(newLang);
  }, [i18n]);

  const handleClose = useCallback(() => {
    if (pendingLang !== originalLangRef.current) {
      i18n.changeLanguage(originalLangRef.current);
    }
    onClose();
  }, [onClose, pendingLang, i18n]);

  const handleApply = useCallback(async () => {
    if (pendingLang !== originalLangRef.current) {
      saveLanguagePreference(pendingLang);
      originalLangRef.current = pendingLang;
    }
    await onApply?.();
  }, [onApply, pendingLang]);

  const handleNavigateToSetting = useCallback((tab: Tab, settingId: string) => {
    setActiveTab(tab);
    setSearchQuery('');
    setPendingScrollId(settingId);
  }, []);

  useEffect(() => {
    if (!pendingScrollId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-setting-id="${pendingScrollId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 0.2s';
        el.style.background = 'rgba(67,67,213,0.08)';
        setTimeout(() => { el.style.background = ''; }, 1200);
      }
      setPendingScrollId(null);
    }, 80);
    return () => clearTimeout(timer);
  }, [pendingScrollId]);

  useEffect(() => {
    if (!targetSettingId) return;
    // Derive the correct tab from settingId (e.g. "general.autoSave" → "general", "ai-engine.model" → "ai-engine")
    const dotIndex = targetSettingId.indexOf('.');
    const tabFromId = dotIndex > 0 ? targetSettingId.slice(0, dotIndex) : undefined;
    if (tabFromId && tabFromId !== activeTab) {
      setActiveTab(tabFromId as Tab);
    }
    // Scroll after tab switch renders
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-setting-id="${targetSettingId}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight briefly
        (el as HTMLElement).style.transition = 'background 0.2s';
        (el as HTMLElement).style.background = 'rgba(67,67,213,0.08)';
        setTimeout(() => { (el as HTMLElement).style.background = ''; }, 1200);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSettingId]);

  const tabContent: Record<Tab, React.ReactNode> = {
    'general': <GeneralTab pendingLang={pendingLang} onLanguageChange={handleLanguageChange} />,
    'ai-engine': <AIEngineTab />,
    'typography': <TypographyTab />,
    'privacy': <PrivacyTab />,
    'about': <AboutTab />,
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: isStacked ? 'column' : 'row',
      overflow: 'hidden',
      background: '#ffffff',
      borderRadius: isWindowed ? 0 : '0.75rem',
    }}>
      {isStacked ? (
        <HorizontalTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      ) : isCollapsed ? (
        <CollapsedSidebar activeTab={activeTab} onTabChange={setActiveTab} isSearching={isSearching} onClearSearch={() => setSearchQuery('')} />
      ) : (
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isSearching={isSearching} onClearSearch={() => setSearchQuery('')} />
      )}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', minWidth: 0 }}>
        {/* Content header */}
        <header
          data-tauri-drag-region={isWindowed ? true : undefined}
          style={{
            height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 2rem', borderBottom: '1px solid rgba(199,196,215,0.08)', flexShrink: 0,
            cursor: isWindowed ? 'default' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              {isSearching ? t('settings.search.results') : {
                general: t('settings.general.sectionTitle'),
                'ai-engine': t('settings.aiEngine.sectionTitle'),
                typography: t('settings.tabs.typography'),
                privacy: t('settings.privacy.sectionTitle'),
                about: t('settings.about.title')
              }[activeTab]}
            </h2>
            {!isSearching && activeTab === 'ai-engine' && (
              <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>{t('settings.aiEngine.active')}</span>
            )}
            {!isSearching && activeTab === 'privacy' && (
              <span style={{ background: 'rgba(67,67,213,0.1)', color: '#4343d5', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', textTransform: 'uppercase' }}>{t('settings.privacy.sectionTitle')}</span>
            )}
            {isSearching && (
              <span style={{ color: '#a1a1aa', fontSize: '0.75rem', fontWeight: 500 }}>{t('settings.search.itemsFound', { count: 4 })}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#4343d5', fontSize: '14px', fontWeight: 700 }}>search</span>
              <input
                type="text"
                placeholder={t('settings.search.placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  fontSize: '0.75rem', background: '#f3f4f5', border: 'none', borderRadius: '9999px',
                  padding: '0.5rem 1rem 0.5rem 2.25rem', width: '256px', fontWeight: 500, outline: 'none',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                }}
              />
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', display: 'flex', padding: '4px' }}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>
        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', height: '100%', minWidth: 0 }}>
          {isSearching ? <SearchResultsTab query={searchQuery} onNavigate={handleNavigateToSetting} /> : tabContent[activeTab]}
        </div>
        <DialogFooter onClose={handleClose} onApply={handleApply} />
      </section>
    </div>
  );
}
