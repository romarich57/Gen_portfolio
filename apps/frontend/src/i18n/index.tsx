import React, { useEffect } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { patchMe } from '@/api/me';
import { useAuth } from '@/app/providers/AuthBootstrap';
import { FALLBACK_LOCALE, persistLocale, readLocaleCookie, resolveBrowserLocale, normalizeLocale } from './language';
import { resources, type SupportedLocale } from './resources';

const initialLocale = readLocaleCookie() ?? resolveBrowserLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: FALLBACK_LOCALE,
  defaultNS: 'common',
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
});

export function CvGeniusI18nProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    const userLocale = normalizeLocale(user?.locale);
    if (user?.locale && i18n.language !== userLocale) {
      void i18n.changeLanguage(userLocale);
      persistLocale(userLocale);
    }
  }, [user?.locale]);

  useEffect(() => {
    const handler = (locale: string) => {
      const normalized = normalizeLocale(locale);
      persistLocale(normalized);
      if (user && user.locale !== normalized) {
        void patchMe({ locale: normalized })
          .then(() => refreshUser())
          .catch(() => undefined);
      }
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [refreshUser, user]);

  return <>{children}</>;
}

export function changeLanguage(locale: SupportedLocale) {
  return i18n.changeLanguage(locale);
}

export { i18n };
