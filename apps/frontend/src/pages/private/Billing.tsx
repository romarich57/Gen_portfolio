import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { createCheckoutSession, createPortalSession, getBillingStatus } from '@/api/billing';
import type { ApiError } from '@/api/http';
import { useAuth } from '@/app/providers/AuthBootstrap';

const upgradeOptions = [
  {
    code: 'PREMIUM' as const,
    title: 'Elite',
    price: '10 EUR / mois',
    description: 'Bâtissez jusqu\'à 5 projets avec prompts IA experts.'
  },
  {
    code: 'VIP' as const,
    title: 'VIP',
    price: '30 EUR / mois',
    description: 'Projets illimités + système de crédits pour calculs intensifs.'
  }
];

/**
 * Billing page for plan management.
 * Preconditions: authenticated session.
 * Postconditions: redirects to Stripe checkout or portal.
 */
function Billing() {
  const { csrfToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    data: billingStatus,
    isLoading,
    isError,
    error: billingError,
    refetch
  } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => getBillingStatus()
  });

  const billingErrorMessage = useMemo(() => {
    if (!billingError) return 'Impossible de charger le billing.';
    const apiError = billingError as unknown as ApiError;
    if (apiError.code === 'NETWORK_ERROR') {
      return 'Impossible de contacter le serveur.';
    }
    return 'Impossible de charger le billing.';
  }, [billingError]);

  const handleCheckout = async (planCode: 'PREMIUM' | 'VIP') => {
    setError(null);
    setLoading(true);
    try {
      const response = await createCheckoutSession({ planCode });
      window.location.assign(response.checkout_url);
    } catch (err) {
      const apiError = err as unknown as ApiError;
      if (apiError.code === 'CAPTCHA_REQUIRED') {
        setError('Verification anti-bot requise. Reessayez plus tard.');
      } else if (apiError.code === 'PLAN_INVALID') {
        setError('Plan invalide.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else {
        setError('Impossible de demarrer le checkout.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await createPortalSession();
      window.location.assign(response.portal_url);
    } catch (err) {
      const apiError = err as unknown as ApiError;
      if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else {
        setError('Impossible d\'ouvrir le portal.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <Loading />
      </div>
    );
  }

  if (isError || !billingStatus) {
    return (
      <div className="space-y-4 p-4">
        <ErrorBanner message={billingErrorMessage} />
        <Button variant="outline" onClick={() => refetch()}>
          Reessayer
        </Button>
      </div>
    );
  }

  const planLabel = billingStatus.plan_code ?? 'FREE';
  const entitlements = billingStatus.entitlements;
  const projectsLimit = entitlements?.projects_limit;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-black tracking-tighter uppercase text-foreground">Abonnement & Crédits</h1>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Gérez la puissance de votre architecte IA.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="animate-fadeUp shadow-2xl shadow-primary/5">
        <CardHeader>
          <div className="flex gap-2 mb-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-none uppercase text-[10px] font-bold tracking-widest">Plan actuel</Badge>
          </div>
          <h2 className="text-2xl font-display font-black tracking-tighter uppercase text-foreground">{planLabel}</h2>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
            {projectsLimit === null ? 'Génération Illimitée' : `${projectsLimit} Projets Actifs`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-mutedForeground">
            {billingStatus.cancel_at_period_end
              ? 'Annulation en fin de periode'
              : 'Renouvellement automatique'}
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={handlePortal} disabled={loading || !csrfToken}>
            Gerer dans Stripe
          </Button>
        </CardFooter>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {upgradeOptions.map((option) => (
          <Card key={option.code}>
            <CardHeader>
              <h3 className="text-xl font-display font-black tracking-tighter uppercase text-foreground">{option.title}</h3>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{option.price}</p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full rounded-none font-mono text-[10px] tracking-widest h-10 uppercase transition-all"
                onClick={() => handleCheckout(option.code)}
                disabled={loading || !csrfToken || planLabel === option.code}
              >
                {planLabel === option.code ? 'Actif' : 'Upgrade System'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default Billing;
