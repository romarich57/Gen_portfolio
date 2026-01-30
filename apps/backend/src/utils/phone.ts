import { parsePhoneNumberFromString, isSupportedCountry, type CountryCode } from 'libphonenumber-js';

export type PhoneNormalizationResult = {
  normalized: string;
  original: string;
};

type NormalizeOptions = {
  defaultCountry?: string | null;
};

export function normalizeCountryCode(value?: string | null): CountryCode | null {
  if (!value) return null;
  const candidate = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(candidate)) return null;
  return isSupportedCountry(candidate as CountryCode) ? (candidate as CountryCode) : null;
}

export function extractCountryFromLocale(value?: string | null): CountryCode | null {
  if (!value) return null;
  const normalized = value.replace('_', '-').split(',')[0]?.split(';')[0]?.trim();
  if (!normalized) return null;
  const parts = normalized.split('-');
  if (parts.length < 2) return null;
  return normalizeCountryCode(parts[1]);
}

/**
 * Normalize a phone number to E.164.
 * - Accepts E.164 numbers with leading '+'
 * - Accepts national format if defaultCountry is provided
 * - Accepts international numbers without '+' by inferring country calling code
 */
export function normalizePhoneE164(input: string, options: NormalizeOptions = {}): PhoneNormalizationResult | null {
  const original = input;
  const stripped = input.trim().replace(/[^\d+]/g, '');

  if (!stripped) {
    return null;
  }

  if (stripped.startsWith('+')) {
    const phone = parsePhoneNumberFromString(stripped);
    if (phone && phone.isValid()) {
      return { normalized: phone.number, original };
    }
    return null;
  }

  const defaultCountry = normalizeCountryCode(options.defaultCountry);
  if (defaultCountry) {
    const phone = parsePhoneNumberFromString(stripped, defaultCountry);
    if (phone && phone.isValid()) {
      return { normalized: phone.number, original };
    }
  }

  const withPlus = `+${stripped}`;
  const phone = parsePhoneNumberFromString(withPlus);
  if (phone && phone.isValid()) {
    return { normalized: phone.number, original };
  }

  return null;
}
