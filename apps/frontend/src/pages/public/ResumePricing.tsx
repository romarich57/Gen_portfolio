import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/Card';

const plans = [
  { key: 'free', quota: '1 CV', ai: 'IA limitée' },
  { key: 'premium', quota: '5 CV', ai: 'Import et amélioration IA' },
  { key: 'vip', quota: 'CV illimités', ai: 'Quotas IA élevés et exports avancés' }
] as const;

function ResumePricing() {
  const { t } = useTranslation('cv');

  return (
    <div className="space-y-8 animate-fadeUp">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-black uppercase tracking-tight">{t('pricing.title')}</h1>
        <p className="text-sm text-muted-foreground">Les rôles et accès restent attribués par Stripe Webhooks signés.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.key}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-mono text-sm font-black uppercase tracking-widest">{t(`pricing.${plan.key}`)}</h2>
              <p className="text-2xl font-display font-black">{plan.quota}</p>
              <p className="text-sm text-muted-foreground">{plan.ai}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default ResumePricing;
