# I18n Architecture

## Choix

Frontend: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.

## Locales

- Defaut: `fr`
- Fallback: `en`
- Cookie non sensible: `cvgenius_locale`
- Backend: `locale` limite a `fr|en`

## Namespaces

Structure dans `apps/frontend/src/i18n/resources.ts`:

- `common`
- `navigation`
- `auth`
- `mfa`
- `profile`
- `cv`
- `billing`
- `errors`

## Integration

- `CvGeniusI18nProvider` enveloppe l'application.
- `LanguageSwitch` est disponible dans layouts public/prive.
- Les nouvelles pages CV utilisent des cles i18n.

## A poursuivre

Les anciennes pages auth/profil/billing doivent etre converties progressivement de textes hardcodes vers les namespaces existants.
