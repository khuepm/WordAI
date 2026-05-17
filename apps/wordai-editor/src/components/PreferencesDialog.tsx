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
import { useAccessContext } from '../services/authStore';

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

/** Cloud sync icon shown next to section titles when user is authenticated (Req 16.6) */
function CloudSyncIndicator({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated) return null;
  return (
    <span
      className="material-symbols-outlined text-primary text-[18px]"
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      cloud_sync
    </span>
  );
}

/** Refined toggle switch per Req 16.3 */
function RefinedToggle({ checked, onChange }: { checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={`h-6 w-11 rounded-full relative transition-colors duration-200 ${checked ? 'bg-primary shadow-[0_0_8px_-1px_rgba(67,67,213,0.5)]' : 'bg-outline-variant'
        }`}
      style={{ border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <span
        className="h-5 w-5 rounded-full bg-surface-container-lowest shadow block absolute top-0.5 transition-[left] duration-150"
        style={{ left: checked ? 'calc(100% - 22px)' : '2px' }}
      />
    </button>
  );
}

function GeneralTab({ pendingLang, onLanguageChange }: GeneralTabProps) {
  const { t } = useTranslation();
  const accessContext = useAccessContext();
  const isAuthenticated = accessContext !== null;

  const [activeTheme, setActiveTheme] = useState(0);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [exportFormat, setExportFormat] = useState('markdown');
  const [exportPath, setExportPath] = useState('~/Documents/WordAI');

  const themes = [
    { key: 'system', label: t('settings.general.interfaceMode.themes.system') },
    { key: 'light', label: t('settings.general.interfaceMode.themes.light') },
    { key: 'dark', label: t('settings.general.interfaceMode.themes.dark') },
  ];
  const themePreviews = [
    { from: '#f4f4f5', to: '#d4d4d8' },
    { from: '#ffffff', to: '#f8f9fa' },
    { from: '#18181b', to: '#27272a' },
  ];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as LanguageCode;
    onLanguageChange(newLang);
  };

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setExportPath(selected);
      }
    } catch {
      // Ignore if dialog plugin is unavailable (browser dev mode)
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Guest Info Banner (Req 16.7) */}
      {!isAuthenticated && (
        <div className="p-6 bg-primary/5 rounded-xl border border-outline-variant/10 mb-8 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span
              className="material-symbols-outlined text-primary text-[1.125rem]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[0.9rem] font-medium leading-[1.6] text-on-surface-variant m-0 mb-3">
              {t('settings.general.guestBanner.description', 'Sign in to sync your theme, language, and preferences across all your devices.')}
            </p>
            <button
              className="bg-primary text-on-primary py-2 px-4 rounded-lg font-headline font-semibold text-sm border-0 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                // Trigger sign-in modal via custom event
                window.dispatchEvent(new CustomEvent('open-auth-modal'));
              }}
            >
              {t('settings.general.guestBanner.signIn', 'Sign In')}
            </button>
          </div>
        </div>
      )}

      {/* Header (Req 16.1) */}
      <div>
        <h3 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface m-0">
          {t('settings.general.sectionTitle')}
        </h3>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          {t('settings.general.sectionDescription')}
        </p>
      </div>

      {/* Appearance — Theme Selection (Req 16.2) */}
      <div data-setting-id="general.theme">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.interfaceMode.label')}</h4>
          <CloudSyncIndicator isAuthenticated={isAuthenticated} />
        </div>
        <p className="text-xs text-on-surface-variant mb-4 mt-0">{t('settings.general.interfaceMode.description')}</p>
        <div className="grid grid-cols-3 gap-4">
          {themes.map((theme, i) => {
            const isActive = activeTheme === i;
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => setActiveTheme(i)}
                className={`p-3 rounded-xl border-0 cursor-pointer flex flex-col items-center bg-surface-container-low transition-all duration-200 ${isActive
                  ? 'ring-1 ring-outline-variant/30 shadow-[0_8px_30px_-5px_rgba(67,67,213,0.12)]'
                  : 'hover:bg-surface-container-high'
                  }`}
              >
                <div
                  className="w-20 h-14 rounded-lg mb-2"
                  style={{
                    background: `linear-gradient(135deg, ${themePreviews[i].from}, ${themePreviews[i].to})`,
                  }}
                />
                <span className={`font-label text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-on-surface-variant'
                  }`}>
                  {theme.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Save Toggle (Req 16.3) */}
      <div data-setting-id="general.autoSave">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.autoSave.label')}</h4>
          <CloudSyncIndicator isAuthenticated={isAuthenticated} />
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.autoSave.description')}</p>
        <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_sync</span>
            <span className="text-sm font-medium text-on-surface">{t('settings.general.autoSave.label')}</span>
          </div>
          <RefinedToggle checked={autoSaveEnabled} onChange={setAutoSaveEnabled} />
        </div>
      </div>

      {/* Focus Mode Toggle (Req 16.3) */}
      <div data-setting-id="general.focusMode">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.focusMode.label')}</h4>
          <CloudSyncIndicator isAuthenticated={isAuthenticated} />
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.focusMode.description')}</p>
        <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">visibility_off</span>
            <span className="text-sm font-medium text-on-surface">{t('settings.general.focusMode.enable')}</span>
          </div>
          <RefinedToggle checked={focusModeEnabled} onChange={setFocusModeEnabled} />
        </div>
      </div>

      {/* Interface Language */}
      <div data-setting-id="general.language">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.language.label')}</h4>
          <CloudSyncIndicator isAuthenticated={isAuthenticated} />
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.language.description')}</p>
        <div className="relative">
          <select
            value={pendingLang}
            onChange={handleLanguageChange}
            className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 text-sm font-medium appearance-none font-headline cursor-pointer ring-1 ring-outline-variant/10 border-0 outline-none"
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[20px]">unfold_more</span>
        </div>
      </div>

      {/* Synchronization — AuraBrain Card (Req 16.4) */}
      <div data-setting-id="general.autoSyncEnabled">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.autoSync.label')}</h4>
          <CloudSyncIndicator isAuthenticated={isAuthenticated} />
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.autoSync.description')}</p>
        <div className="bg-surface-container rounded-2xl p-6 relative overflow-hidden">
          {/* Aura gradient blob */}
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-[50px] pointer-events-none" />

          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>sync</span>
              <div>
                <span className="text-sm font-bold text-on-surface block">{t('settings.general.autoSync.label')} (AuraBrain)</span>
                <span className="text-xs text-on-surface-variant">{t('settings.general.autoSync.description')}</span>
              </div>
            </div>
            <RefinedToggle checked={autoSyncEnabled} onChange={setAutoSyncEnabled} />
          </div>

          {/* Sync Interval Slider (Req 16.4) */}
          {autoSyncEnabled && (
            <div className="relative z-10" data-setting-id="general.autoSyncInterval">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-on-surface-variant">{t('settings.general.autoSyncInterval.label')}</span>
                <span className="text-xs font-bold text-primary">{syncInterval}s</span>
              </div>
              <div className="relative h-2 bg-surface-container-high rounded-full">
                {/* Gradient fill track */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_8px_rgba(67,67,213,0.4)]"
                  style={{ width: `${((syncInterval - 5) / 55) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
                className="w-full mt-1 cursor-pointer"
                style={{ accentColor: '#4343d5' }}
              />
              <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                <span>5s</span>
                <span>60s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Local Environment (Req 16.5) */}
      <div data-setting-id="general.defaultExportFormat">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.defaultExportFormat.label')}</h4>
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.defaultExportFormat.description')}</p>
        <div className="relative">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="w-full bg-surface-container-low rounded-xl py-3.5 px-4 text-sm font-medium appearance-none font-headline cursor-pointer ring-1 ring-outline-variant/10 border-0 outline-none"
          >
            <option value="markdown">Markdown (.md)</option>
            <option value="docx">Word Document (.docx)</option>
          </select>
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[20px]">unfold_more</span>
        </div>
      </div>

      <div data-setting-id="general.defaultExportPath">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="text-sm font-bold text-on-surface m-0">{t('settings.general.defaultExportPath.label')}</h4>
        </div>
        <p className="text-xs text-on-surface-variant mb-3 mt-0">{t('settings.general.defaultExportPath.description')}</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            readOnly
            value={exportPath}
            className="flex-1 bg-surface-container-low rounded-xl py-3.5 px-4 text-sm font-medium font-headline ring-1 ring-outline-variant/10 border-0 outline-none text-on-surface-variant cursor-default"
          />
          <button
            type="button"
            onClick={handleBrowse}
            className="bg-surface hover:bg-surface-container-high rounded-xl ring-1 ring-outline-variant/20 py-3.5 px-5 text-sm font-semibold font-headline text-on-surface border-0 cursor-pointer transition-colors duration-150"
          >
            {t('settings.general.defaultExportPath.browse', 'Browse')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: AI Engine ──────────────────────────────────────────────────────────

function AIEngineTab() {
  const { t } = useTranslation();
  const accessContext = useAccessContext();
  const isAuthenticated = accessContext !== null;

  const [selectedAgent, setSelectedAgent] = useState<string>('gpt4');
  const [selectedContext, setSelectedContext] = useState<string>('16k');
  const [webAccessEnabled, setWebAccessEnabled] = useState(true);
  const [creativity, setCreativity] = useState(70);

  // Derive entitlement data from access context
  const planName = accessContext?.entitlement.plan_code === 'pro' ? 'AuraSphere Pro' : 'AuraSphere Free';
  const remainingTokens = accessContext ? (accessContext.entitlement.monthly_quota - accessContext.entitlement.used_quota) : 0;
  const usedPercentage = accessContext ? Math.round((accessContext.entitlement.used_quota / accessContext.entitlement.monthly_quota) * 100) : 0;
  const isPro = accessContext?.entitlement.plan_code === 'pro';

  return (
    <div className="flex flex-col gap-10 max-w-2xl mx-auto">

      {/* Header (Req 17.1) */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-2">
          {t('settings.aiEngine.intro.title', 'AI Engine Settings')}
        </h2>
        <p className="text-on-surface-variant text-base">
          {t('settings.aiEngine.intro.description', 'Configure model parameters, context window, and usage limits.')}
        </p>
      </div>

      {/* Model & Credits Card — authenticated only (Req 17.2) */}
      {isAuthenticated && (
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-[0_4px_24px_-4px_rgba(25,28,29,0.04)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2 m-0">
                  {planName}
                  {isPro && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary text-on-primary tracking-wide">PRO</span>
                  )}
                </h3>
                <p className="text-sm text-on-surface-variant mt-0.5 m-0">
                  {t('settings.aiEngine.credits.activeSubscription', 'Active Subscription')}
                </p>
              </div>
            </div>
            <button className="bg-primary hover:bg-primary-container text-on-primary font-medium px-5 py-2.5 rounded-md transition-colors duration-200 flex items-center gap-2 text-sm shadow-[0_0_12px_rgba(67,67,213,0.15)] hover:shadow-[0_0_16px_rgba(67,67,213,0.25)] border-0 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {t('settings.aiEngine.credits.getMore', 'Get more credits')}
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold text-on-surface m-0">
                  {remainingTokens.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-on-surface-variant">
                    {t('settings.aiEngine.credits.tokensRemaining', 'tokens remaining')}
                  </span>
                </p>
              </div>
              <p className="text-sm font-medium text-on-surface-variant m-0">
                {usedPercentage}% {t('settings.aiEngine.credits.usedThisMonth', 'used this month')}
              </p>
            </div>
            <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-2 m-0">
              {t('settings.aiEngine.credits.renewsAt', 'Renews automatically on')} {accessContext?.entitlement.quota_reset_at ? new Date(accessContext.entitlement.quota_reset_at).toLocaleDateString() : ''}
            </p>
          </div>
        </section>
      )}

      {/* AI Capabilities (Req 17.3) */}
      <section className="space-y-6">
        <h3 className="text-lg font-bold text-on-surface border-b border-surface-container-high pb-2 m-0">
          {t('settings.aiEngine.capabilities.title', 'Capabilities')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent Selection */}
          <div className="space-y-2" data-setting-id="ai-engine.agent">
            <label className="block text-sm font-semibold text-on-surface">
              {t('settings.aiEngine.agent.title', 'AI Agent & Model')}
            </label>
            <p className="text-xs text-on-surface-variant mb-2 mt-0">
              {t('settings.aiEngine.agent.description', 'Select the underlying intelligence engine.')}
            </p>
            <div className="relative">
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full appearance-none bg-surface-container-low border-0 text-on-surface text-sm rounded-md px-4 py-3 focus:ring-0 focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_rgba(67,67,213,1)] transition-all cursor-pointer font-medium outline-none"
              >
                <option value="gpt4">{t('settings.aiEngine.agent.options.gpt4', 'AuraSphere Omni (GPT-4o)')}</option>
                <option value="claude" disabled={!isAuthenticated}>
                  {!isAuthenticated ? '🔒 ' : ''}{t('settings.aiEngine.agent.options.claude', 'Claude 3.5 Sonnet')}
                </option>
                <option value="gemini" disabled={!isAuthenticated}>
                  {!isAuthenticated ? '🔒 ' : ''}{t('settings.aiEngine.agent.options.gemini', 'Gemini 1.5 Pro')}
                </option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">expand_more</span>
              </div>
            </div>
          </div>

          {/* Context Window */}
          <div className="space-y-2" data-setting-id="ai-engine.contextWindowTokens">
            <label className="block text-sm font-semibold text-on-surface">
              {t('settings.aiEngine.contextWindow.label', 'Context Window')}
            </label>
            <p className="text-xs text-on-surface-variant mb-2 mt-0">
              {t('settings.aiEngine.contextWindow.description', 'Memory allocation for current document.')}
            </p>
            <div className="relative">
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="w-full appearance-none bg-surface-container-low border-0 text-on-surface text-sm rounded-md px-4 py-3 focus:ring-0 focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_rgba(67,67,213,1)] transition-all cursor-pointer font-medium outline-none"
              >
                <option value="4k">{t('settings.aiEngine.contextWindow.options.4k', '4,096 tokens (Fast)')}</option>
                <option value="8k">{t('settings.aiEngine.contextWindow.options.8k', '8,192 tokens (Balanced)')}</option>
                <option value="16k">{t('settings.aiEngine.contextWindow.options.16k', '16,384 tokens (Pro)')}</option>
                <option value="32k">{t('settings.aiEngine.contextWindow.options.32k', '32,768 tokens (Max)')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">expand_more</span>
              </div>
            </div>
          </div>
        </div>

        {/* Web Access Toggle (Req 17.4) */}
        <div
          className={`flex items-center justify-between p-4 bg-surface-container-low rounded-lg mt-4 ${!isAuthenticated ? 'opacity-50 pointer-events-none' : ''}`}
          data-setting-id="ai-engine.webAccess"
        >
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-on-surface m-0">
                {!isAuthenticated && <span className="mr-1">🔒</span>}
                {t('settings.aiEngine.knowledge.webAccess', 'Live Web Access')}
              </h4>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-fixed-dim text-on-primary-fixed tracking-wide">PRO</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1 m-0">
              {t('settings.aiEngine.knowledge.description', 'Allow AI to search the web for real-time information.')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={webAccessEnabled}
              onChange={(e) => setWebAccessEnabled(e.target.checked)}
              disabled={!isAuthenticated}
            />
            <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
          </label>
        </div>
      </section>

      {/* Behavior — Creativity Slider (Req 17.5) */}
      <section className="space-y-6">
        <h3 className="text-lg font-bold text-on-surface border-b border-surface-container-high pb-2 m-0">
          {t('settings.aiEngine.behavior.title', 'Behavior')}
        </h3>

        <div className="space-y-4 p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-[0_4px_24px_-4px_rgba(25,28,29,0.04)]" data-setting-id="ai-engine.creativity">
          <div className="flex justify-between items-center mb-2">
            <div>
              <label className="block text-sm font-semibold text-on-surface">
                {t('settings.aiEngine.creativity.label', 'Creativity (Temperature)')}
              </label>
              <p className="text-xs text-on-surface-variant mt-0.5 m-0">
                {t('settings.aiEngine.creativity.description', 'Adjust how deterministic the output should be.')}
              </p>
            </div>
            <span className="text-lg font-bold text-primary bg-primary/5 px-3 py-1 rounded-md">
              {creativity}
            </span>
          </div>
          <div className="pt-2 pb-4">
            <input
              type="range"
              min={0}
              max={100}
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
              className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: '#4343d5' }}
            />
            <div className="flex justify-between text-xs text-on-surface-variant mt-2 font-medium">
              <span>{t('settings.aiEngine.creativity.marks.precise', 'Focused (0)')}</span>
              <span>{t('settings.aiEngine.creativity.marks.balanced', 'Balanced')}</span>
              <span>{t('settings.aiEngine.creativity.marks.creative', 'Creative (100)')}</span>
            </div>
          </div>
        </div>
      </section>

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
