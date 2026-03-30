import { useState, useEffect, useRef, useCallback } from 'react';
import { SETTING_REGISTRY } from '../data/settingRegistry';
import type { SettingEntry, Tab } from '../types/preferences';

export interface QuickSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: SettingEntry) => void;
}

const TAB_LABELS: Record<Tab, string> = {
  'general': 'General',
  'ai-engine': 'AI Engine',
  'typography': 'Typography',
  'privacy': 'Privacy',
};

export function filterSettings(query: string): SettingEntry[] {
  if (!query.trim()) return SETTING_REGISTRY;
  const q = query.toLowerCase();
  return SETTING_REGISTRY.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.keywords.some((kw) => kw.toLowerCase().includes(q))
  );
}

const MAX_VISIBLE = 8;

export function QuickSearchPopup({ isOpen, onClose, onSelect }: QuickSearchPopupProps) {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = filterSettings(query).slice(0, MAX_VISIBLE);

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
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
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
            maxHeight: 8 * 64,
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
                    {TAB_LABELS[entry.tab]}
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
