import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import ptBRTranslation from './locales/pt-BR/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      'pt-BR': {
        translation: ptBRTranslation,
      },
    },
    fallbackLng: 'en', // Fallback language if detection fails or translation is missing
    debug: false, // Set to true for debugging
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'], // Order of language detection
      caches: ['localStorage'], // Cache detected language in localStorage
    },
  });

export default i18n;