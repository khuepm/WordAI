import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SETTING_REGISTRY } from '../data/settingRegistry';
import type { SettingEntry, Tab } from '../types/preferences';

/** Maps each setting entry id to its i18n label and description keys */
export const SETTING_I18N_MAP: Record<string, { label: string; description: string }> = {
  'general.theme': { label: 'settings.general.interfaceMode.label', description: 'settings.general.interfaceMode.description' },
  'general.autoSave': { label: 'settings.general.autoSave.label', description: 'settings.general.autoSave.description' },
  'general.focusMode': { label: 'settings.general.focusMode.label', description: 'settings.general.focusMode.description' },
  'general.language': { label: 'settings.general.language.label', description: 'settings.general.language.description' },
  'general.defaultExportPath': { label: 'settings.general.defaultExportPath.label', description: 'settings.general.defaultExportPath.description' },
  'general.defaultExportFormat': { label: 'settings.general.defaultExportFormat.label', description: 'settings.general.defaultExportFormat.description' },
  'general.autoSyncEnabled': { label: 'settings.general.autoSync.label', description: 'settings.general.autoSync.description' },
  'general.autoSyncInterval': { label: 'settings.general.autoSyncInterval.label', description: 'settings.general.autoSyncInterval.description' },
  'ai-engine.agent': { label: 'settings.aiEngine.agent.title', description: 'settings.aiEngine.agent.description' },
  'ai-engine.model': { label: 'settings.aiEngine.models.title', description: 'settings.aiEngine.sectionDescription' },
  'ai-engine.creativity': { label: 'settings.aiEngine.creativity.label', description: 'settings.aiEngine.creativity.description' },
  'ai-engine.contextWindowTokens': { label: 'settings.aiEngine.contextWindow.label', description: 'settings.aiEngine.contextWindow.description' },
  'ai-engine.responseLanguage': { label: 'settings.aiEngine.responseLanguage.label', description: 'settings.aiEngine.responseLanguage.description' },
  'ai-engine.webAccess': { label: 'settings.aiEngine.knowledge.label', description: 'settings.aiEngine.knowledge.description' },
  'typography.fontFamily': { label: 'settings.typography.font.standardFont', description: 'settings.typography.font.standardFontDescription' },
  'typography.fontSize': { label: 'settings.typography.fontSize.label', description: 'settings.typography.fontSize.note' },
  'typography.lineSpacing': { label: 'settings.typography.lineSpacing.label', description: 'settings.typography.lineSpacing.note' },
  'typography.smartQuotes': { label: 'settings.typography.smart.quotes.label', description: 'settings.typography.smart.quotes.description' },
  'typography.autoCapitalize': { label: 'settings.typography.smart.autoCapitalize.label', description: 'settings.typography.smart.autoCapitalize.description' },
  'typography.ligatures': { label: 'settings.typography.smart.ligatures.label', description: 'settings.typography.smart.ligatures.description' },
  'privacy.allowAITraining': { label: 'settings.privacy.aiTraining.label', description: 'settings.privacy.aiTraining.description' },
  'privacy.analyticsEnabled': { label: 'settings.privacy.regionalInfrastructure.label', description: 'settings.privacy.sectionDescription' },
  'privacy.crashReports': { label: 'settings.privacy.encryptionEnabled', description: 'settings.privacy.encryptionDescription' },
  'privacy.localProcessingOnly': { label: 'settings.privacy.localProcessing.label', description: 'settings.privacy.localProcessing.description' },
  'about.auraBrainStoragePath': { label: 'settings.about.storagePath.label', description: 'settings.about.storagePath.description' },
};

export interface QuickSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: SettingEntry) => void;
}

const MAX_VISIBLE = 8;

export function filterSettings(
  query: string,
  translatedEntries?: Array<{ id: string; label: string; description: string }>
): SettingEntry[] {
  if (!query.trim()) return SETTING_REGISTRY;
  const q = query.toLowerCase().trim();
  return SETTING_REGISTRY.filter((entry) => {
    // Match against registry label, description, keywords (English)
    const baseMatch =
      entry.label.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.keywords.some((kw) => kw.toLowerCase().includes(q));
    if (baseMatch) return true;

    // Match against translated label/description (current UI language)
    if (translatedEntries) {
      const translated = translatedEntries.find((te) => te.id === entry.id);
      if (translated) {
        return (
          translated.label.toLowerCase().includes(q) ||
          translated.description.toLowerCase().includes(q)
        );
      }
    }
    return false;
  });
}

export function QuickSearchPopup({ isOpen, onClose, onSelect }: QuickSearchPopupProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Build translated entries for bilingual search
  const translatedEntries = SETTING_REGISTRY.map((entry) => {
    const keys = SETTING_I18N_MAP[entry.id];
    return {
      id: entry.id,
      label: keys ? t(keys.label) : entry.label,
      description: keys ? t(keys.description) : entry.description,
    };
  });

  const tabLabels: Record<Tab, string> = {
    'general': t('settings.tabs.general'),
    'ai-engine': t('settings.tabs.aiEngine'),
    'typography': t('settings.tabs.typography'),
    'privacy': t('settings.tabs.privacy'),
    'about': t('settings.tabs.about'),
  };

  const results = filterSettings(query, translatedEntries).slice(0, MAX_VISIBLE);

  // Reset state when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlightIndex(0);
      // Auto-focus input
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keep highlight in bounds when results change
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Scroll highlighted item into view (scrollIntoView may not exist in test environments)
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      if (item && typeof item.scrollIntoView === 'function') {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const isNavigationKey =
        e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter';

      if (isNavigationKey && results.length === 0) {
        // No results to navigate or select; just prevent default behavior.
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[highlightIndex]) {
          onSelect(results[highlightIndex]);
        }
      }
    },
    [results, highlightIndex, onClose, onSelect]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="quick-search-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(24, 24, 27, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal panel — stop propagation so clicks inside don't close */}
      <div
        role="dialog"
        aria-label="Quick settings search"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          maxWidth: 'var(--modal-max-width-popup, min(560px, calc(100vw - 32px)))',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(67, 67, 213, 0.18), 0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          fontFamily: "'Inter', 'Manrope', sans-serif",
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e7e8e9',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0, color: '#767586' }}
          >
            <path
              d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zm4.243-.757 2.757 2.757"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search settings"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            placeholder="Search settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: '#18181b',
              backgroundColor: 'transparent',
              fontFamily: 'inherit',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: '#767586',
              backgroundColor: '#f3f4f5',
              border: '1px solid #e1e3e4',
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'inherit',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          style={{
            maxHeight: 'min(512px, calc(100vh - 200px))',
            overflowY: 'auto',
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#767586',
                fontSize: 14,
              }}
            >
              No settings found
            </div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Settings results"
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              {results.map((entry, idx) => (
                <li
                  key={entry.id}
                  role="option"
                  aria-selected={idx === highlightIndex}
                  data-setting-id={entry.id}
                  onClick={() => onSelect(entry)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: idx === highlightIndex ? '#f0f0ff' : 'transparent',
                    borderLeft: idx === highlightIndex ? '3px solid #4343d5' : '3px solid transparent',
                    transition: 'background-color 100ms ease',
                  }}
                >
                  {/* Text content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#18181b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {entry.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#767586',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {entry.description}
                    </div>
                  </div>

                  {/* Tab badge */}
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#4343d5',
                      backgroundColor: '#ededff',
                      borderRadius: 4,
                      padding: '2px 7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tabLabels[entry.tab]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
