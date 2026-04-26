import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslations from "./locales/en.json";
import viTranslations from "./locales/vi.json";

const LANGUAGE_STORAGE_KEY = "wordai_language";

export const resources = {
  en: {
    translation: enTranslations,
  },
  vi: {
    translation: viTranslations,
  },
};

export const AVAILABLE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
];

export type LanguageCode = "en" | "vi";

/**
 * Get saved language from localStorage
 * Returns null if not found or invalid
 */
function getSavedLanguage(): LanguageCode | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "en" || saved === "vi") {
    return saved;
  }
  return null;
}

/**
 * Save language preference to localStorage
 */
export function saveLanguagePreference(lang: LanguageCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

/**
 * Get initial language: saved preference or default 'en'
 */
export function getInitialLanguage(): LanguageCode {
  return getSavedLanguage() || "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
