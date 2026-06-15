import i18n from 'i18next';
import en from './locales/en';
import zh from './locales/zh';

export type AppLanguage = 'zh' | 'en';
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['zh', 'en'];
export const LANGUAGE_STORAGE_KEY = 'lgb.language';

// Default to Chinese unless the user explicitly selected English before.
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
const initialLanguage: AppLanguage = stored === 'en' ? 'en' : 'zh';

// Resources are provided inline (no async backend), so init resolves
// synchronously and i18n.t is usable immediately after this module is imported.
i18n.init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
});

// String-typed translation helper used by the centralized dictionaries and
// components. Keeps call sites terse and avoids i18next's union return type.
export const tr = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options);

export const getLanguage = (): AppLanguage => (i18n.language === 'en' ? 'en' : 'zh');

export const setLanguage = (language: AppLanguage): void => {
  i18n.changeLanguage(language);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
};

export default i18n;
