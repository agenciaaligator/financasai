import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import ptPT from './locales/pt-PT.json';
import enUS from './locales/en-US.json';
import esES from './locales/es-ES.json';
import itIT from './locales/it-IT.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'pt-PT': { translation: ptPT },
      'en-US': { translation: enUS },
      'es-ES': { translation: esES },
      'it-IT': { translation: itIT },
    },
    fallbackLng: 'pt-BR',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

