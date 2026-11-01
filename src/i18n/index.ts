import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en/common.json';

export const LANGUAGES = { en: { dir: 'ltr' }, he: { dir: 'rtl' } } as const;
export type Language = keyof typeof LANGUAGES;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Switches language and page direction. The fretboard and tabs stay LTR on their own. */
export function applyLanguage(lang: Language) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;
}

export default i18n;
