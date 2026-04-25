import type { SupportedLocale } from './resources';
export type { SupportedLocale } from './resources';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: SupportedLocale = 'fr';
export const FALLBACK_LOCALE: SupportedLocale = 'en';
export const LOCALE_COOKIE = 'cvgenius_locale';

export function normalizeLocale(value?: string | null): SupportedLocale {
  const normalized = value?.toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.includes(normalized as SupportedLocale) ? (normalized as SupportedLocale) : DEFAULT_LOCALE;
}

export function readLocaleCookie(): SupportedLocale | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1];
  return cookie ? normalizeLocale(decodeURIComponent(cookie)) : null;
}

export function persistLocale(locale: SupportedLocale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export function resolveBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return normalizeLocale(navigator.languages?.[0] ?? navigator.language);
}
