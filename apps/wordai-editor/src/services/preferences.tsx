import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PreferencesTab = 'general' | 'editor';

export interface Preferences {
  general: {
    theme: 'system' | 'light' | 'dark';
    language: 'en' | 'vi';
  };
  editor: {
    fontSize: number;
    spellCheck: boolean;
    showMinimap: boolean;
  };
}

const PREFERENCES_KEY = 'wordai_preferences';
const LEGACY_FONT_SIZE_KEY = 'wordai_font_size';

const DEFAULT_PREFERENCES: Preferences = {
  general: {
    theme: 'system',
    language: 'en',
  },
  editor: {
    fontSize: 18,
    spellCheck: true,
    showMinimap: true,
  },
};

function coercePreferences(value: unknown): Preferences {
  const base: Preferences =
    typeof value === 'object' && value !== null
      ? {
          general: {
            theme:
              (value as any).general?.theme === 'light' ||
              (value as any).general?.theme === 'dark'
                ? (value as any).general.theme
                : 'system',
            language:
              (value as any).general?.language === 'vi'
                ? 'vi'
                : 'en',
          },
          editor: {
            fontSize: Number((value as any).editor?.fontSize) || DEFAULT_PREFERENCES.editor.fontSize,
            spellCheck:
              typeof (value as any).editor?.spellCheck === 'boolean'
                ? (value as any).editor.spellCheck
                : DEFAULT_PREFERENCES.editor.spellCheck,
            showMinimap:
              typeof (value as any).editor?.showMinimap === 'boolean'
                ? (value as any).editor.showMinimap
                : DEFAULT_PREFERENCES.editor.showMinimap,
          },
        }
      : DEFAULT_PREFERENCES;

  return {
    general: {
      ...DEFAULT_PREFERENCES.general,
      ...base.general,
    },
    editor: {
      ...DEFAULT_PREFERENCES.editor,
      ...base.editor,
    },
  };
}

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const prefs = coercePreferences(parsed);

    // Migrate legacy font-size key if present.
    const legacyFont = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacyFont) {
      const fontSize = Number(legacyFont);
      if (!Number.isNaN(fontSize)) {
        prefs.editor.fontSize = fontSize;
      }
    }

    return prefs;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function persistPreferences(prefs: Preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

interface PreferencesContextValue {
  preferences: Preferences;
  updateGeneral: (patch: Partial<Preferences['general']>) => void;
  updateEditor: (patch: Partial<Preferences['editor']>) => void;
  restoreTabDefaults: (tab: PreferencesTab) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences());

  const updateGeneral = useCallback((patch: Partial<Preferences['general']>) => {
    setPreferences((prev) => {
      const next = { ...prev, general: { ...prev.general, ...patch } };
      persistPreferences(next);
      return next;
    });
  }, []);

  const updateEditor = useCallback((patch: Partial<Preferences['editor']>) => {
    setPreferences((prev) => {
      const next = { ...prev, editor: { ...prev.editor, ...patch } };
      persistPreferences(next);
      return next;
    });
  }, []);

  const restoreTabDefaults = useCallback((tab: PreferencesTab) => {
    setPreferences((prev) => {
      const next: Preferences = {
        ...prev,
        [tab]: { ...DEFAULT_PREFERENCES[tab] } as Preferences[PreferencesTab],
      } as Preferences;
      persistPreferences(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      updateGeneral,
      updateEditor,
      restoreTabDefaults,
    }),
    [preferences, restoreTabDefaults, updateEditor, updateGeneral]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}

export const defaultPreferences = DEFAULT_PREFERENCES;
