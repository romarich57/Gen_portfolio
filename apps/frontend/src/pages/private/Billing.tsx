import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { createCheckoutSession, createPortalSession, getBillingStatus } from '@/api/billing';
import { useAuth } from '@/app/providers/AuthBootstrap';

const upgradeOptions = [
  {
    code: 'PREMIUM' as const,
    title: 'Premium',
    price: '10 EUR / mois',
    description: '5 projets par mois'
  },
  {
    code: 'VIP' as const,
    title: 'VIP',
    price: '30 EUR / mois',
    description: 'Projets illimites'
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

  const { data: billingStatus, isLoading } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => getBillingStatus()
  });

  const handleCheckout = async (planCode: 'PREMIUM' | 'VIP') => {
    setError(null);
    setLoading(true);
    try {
      const response = await createCheckoutSession({ planCode });
      window.location.assign(response.checkout_url);
    } catch {
      setError('Impossible de demarrer le checkout.');
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
    } catch {
      setError('Impossible d\'ouvrir le portal.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !billingStatus) {
    return (
      <div className="p-4">
        <Loading />
      </div>
    );
  }

  const planLabel = billingStatus.plan_code ?? 'FREE';
  const entitlements = billingStatus.entitlements;
  const projectsLimit = entitlements?.projects_limit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Billing</h1>
        <p className="text-sm text-mutedForeground">Gerez votre abonnement Stripe.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader>
          <Badge>Plan actuel</Badge>
          <h2 className="text-2xl font-display font-semibold">{planLabel}</h2>
          <p className="text-sm text-mutedForeground">
            {projectsLimit === null ? 'Projets illimites' : `${projectsLimit} projets / mois`}
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
              <h3 className="text-xl font-display font-semibold">{option.title}</h3>
              <p className="text-sm text-mutedForeground">{option.price}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-mutedForeground">{option.description}</p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handleCheckout(option.code)}
                disabled={loading || !csrfToken || planLabel === option.code}
              >
                {planLabel === option.code ? 'Plan actuel' : 'Upgrade'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default Billing;
