import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

const getInitialLanguage = (): 'th' | 'en' => {
  if (typeof window === 'undefined') return 'th';

  try {
    const persisted = window.localStorage.getItem('senic-locale-storage');
    if (!persisted) return 'th';

    const parsed = JSON.parse(persisted) as { state?: { language?: string } };
    const language = parsed.state?.language;
    return language === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
};

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'th',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
