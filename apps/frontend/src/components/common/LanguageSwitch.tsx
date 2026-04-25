import { useTranslation } from 'react-i18next';

import { changeLanguage } from '@/i18n';
import { normalizeLocale, type SupportedLocale } from '@/i18n/language';

function LanguageSwitch() {
  const { i18n } = useTranslation();
  const current = normalizeLocale(i18n.language);

  const next: SupportedLocale = current === 'fr' ? 'en' : 'fr';

  return (
    <button
      type="button"
      className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
      onClick={() => void changeLanguage(next)}
      aria-label="Changer de langue"
    >
      {current.toUpperCase()}
    </button>
  );
}

export default LanguageSwitch;
