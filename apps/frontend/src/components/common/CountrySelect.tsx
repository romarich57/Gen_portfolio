import React, { useMemo, useState } from 'react';

import Label from '@/components/ui/Label';
import Input from '@/components/ui/Input';
import { COUNTRY_CODES, getCountryName } from '@/data/countries';

type CountrySelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  helperText?: string;
  locale?: string;
};

function flagEmoji(code: string) {
  if (code.length !== 2) return '';
  const chars = code.toUpperCase().split('');
  return String.fromCodePoint(127397 + chars[0].charCodeAt(0), 127397 + chars[1].charCodeAt(0));
}

function CountrySelect({
  id,
  label,
  value,
  onChange,
  required,
  disabled,
  error,
  helperText,
  locale = 'fr'
}: CountrySelectProps) {
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    return COUNTRY_CODES.map((code) => ({
      code,
      name: getCountryName(code, locale),
      flag: flagEmoji(code)
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter(
      (option) =>
        option.code.toLowerCase().includes(trimmed) || option.name.toLowerCase().includes(trimmed)
    );
  }, [options, query]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={`${id}-search`}
        type="text"
        placeholder="Rechercher un pays..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        aria-label={`${label} recherche`}
      />
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="flex h-11 w-full rounded-lg border border-border bg-card px-4 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="">Selectionnez un pays</option>
        {filtered.map((option) => (
          <option key={option.code} value={option.code}>
            {option.flag} {option.name} ({option.code})
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-mutedForeground">{helperText}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default CountrySelect;
