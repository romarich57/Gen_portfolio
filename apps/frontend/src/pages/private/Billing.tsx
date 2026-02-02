import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { createPortalSession, getBillingStatus, changePlan } from '@/api/billing';
import type { ApiError } from '@/api/http';
import { useAuth } from '@/app/providers/AuthBootstrap';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/Dialog';

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

const PLAN_LEVELS = { FREE: 0, PREMIUM: 1, VIP: 2 };
const PLAN_LABELS: Record<'FREE' | 'PREMIUM' | 'VIP', string> = {
  FREE: 'FREE',
  PREMIUM: 'ELITE',
  VIP: 'VIP'
};

/**
 * Billing page for plan management.
 * Preconditions: authenticated session.
 * Postconditions: redirects to Stripe checkout or portal.
 */
function Billing() {
  const { csrfToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<'FREE' | 'PREMIUM' | 'VIP' | null>(null);

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

  const handleChangePlan = async (targetPlanCode: 'FREE' | 'PREMIUM' | 'VIP') => {
    setError(null);
    setSuccessMessage(null);
    setDebug(null);
    setLoading(true);

    try {
      const response = await changePlan({ planCode: targetPlanCode });

      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }

      const formatEffectiveDate = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString('fr-FR');
      };

      const effectiveDate = formatEffectiveDate(response.effectiveAt);
      const appliedMessage = effectiveDate ? `Changement appliqué le ${effectiveDate}.` : null;
      const baseMessage =
        response.message ||
        (response.changeType === 'downgrade'
          ? 'Plan rétrogradé avec succès (différé).'
          : 'Plan mis à jour avec succès.');

      setSuccessMessage(appliedMessage ? `${appliedMessage} ${baseMessage}` : baseMessage);
      refetch();
    } catch (err) {
      const apiError = err as unknown as ApiError;
      if (apiError.requestId) {
        setDebug({ request_id: apiError.requestId, ...(apiError.debug ?? {}) });
      } else {
        setDebug(apiError.debug ?? null);
      }

      const errorMap: Record<string, string> = {
        'CAPTCHA_REQUIRED': 'Verification anti-bot requise.',
        'PLAN_INVALID': 'Plan invalide.',
        'PLAN_NOT_CONFIGURED': 'Plan non configuré.',
        'SESSION_INVALID': 'Session Stripe invalide.',
        'CHECKOUT_FORBIDDEN': 'Session Stripe non autorisée.',
        'SUBSCRIPTION_INVALID': 'Abonnement Stripe invalide.',
        'STRIPE_ADDRESS_REQUIRED': 'Stripe requiert une adresse.',
        'STRIPE_TAX_NOT_ENABLED': 'Stripe Tax non activé.',
        'STRIPE_ERROR': 'Erreur Stripe.',
        'CHECKOUT_FAILED': 'Échec du changement de plan.',
        'NETWORK_ERROR': 'Impossible de contacter le serveur.'
      };

      setError(errorMap[apiError.code] || 'Impossible de changer de plan.');
    } finally {
      setLoading(false);
    }
  };

  const requestDowngrade = (target: 'FREE' | 'PREMIUM') => {
    setDowngradeTarget(target);
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
  const scheduledPlan = billingStatus.scheduled_plan_code;
  const entitlements = billingStatus.entitlements;
  const projectsLimit = entitlements?.projects_limit;

  const getButtonState = (optionCode: 'PREMIUM' | 'VIP'): { label: string; disabled: boolean; variant?: 'primary' | 'outline' } => {
    const currentLevel = PLAN_LEVELS[planLabel];
    const optionLevel = PLAN_LEVELS[optionCode];

    if (planLabel === optionCode) {
      if (scheduledPlan) return { label: 'Actif (fin de période)', disabled: true };
      return { label: 'Actif', disabled: true };
    }

    // If pending downgrade to this plan
    if (scheduledPlan === optionCode) {
      return { label: 'Programmé', disabled: true };
    }

    if (optionLevel > currentLevel) {
      return { label: `Passer à ${PLAN_LABELS[optionCode]}`, disabled: false, variant: 'primary' };
    } else {
      return { label: 'Rétrograder', disabled: false, variant: 'outline' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-black tracking-tighter uppercase text-foreground">Abonnement & Crédits</h1>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Gérez la puissance de votre architecte IA.</p>
      </div>

      {error && (
        <div className="space-y-2">
          <ErrorBanner message={error} />
          {import.meta.env.DEV && debug && (
            <pre className="rounded-lg border border-border/60 bg-muted/40 p-3 text-[11px] text-muted-foreground overflow-auto">
              {JSON.stringify(debug, null, 2)}
            </pre>
          )}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded text-sm font-mono flex items-center gap-2">
          <span>✅</span> {successMessage}
        </div>
      )}

      <Card className="animate-fadeUp shadow-2xl shadow-primary/5">
        <CardHeader>
          <div className="flex gap-2 mb-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-none uppercase text-[10px] font-bold tracking-widest">Plan actuel</Badge>
            {scheduledPlan && (
              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 rounded-none uppercase text-[10px] font-bold tracking-widest">
                Change bientôt en {PLAN_LABELS[scheduledPlan]}
              </Badge>
            )}
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
              : scheduledPlan
                ? `Passage à ${PLAN_LABELS[scheduledPlan]} à la fin de la période`
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
        {upgradeOptions.map((option) => {
          const { label, disabled, variant } = getButtonState(option.code);
          return (
            <Card key={option.code} className={scheduledPlan === option.code ? 'border-orange-500/50' : ''}>
              <CardHeader>
                <h3 className="text-xl font-display font-black tracking-tighter uppercase text-foreground">{option.title}</h3>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{option.price}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
              </CardContent>
              <CardFooter>
                <Button
                  variant={variant ?? 'primary'}
                  className="w-full rounded-none font-mono text-[10px] tracking-widest h-10 uppercase transition-all"
                  onClick={() => {
                    const currentLevel = PLAN_LEVELS[planLabel];
                    const optionLevel = PLAN_LEVELS[option.code];
                    if (optionLevel < currentLevel) {
                      requestDowngrade(option.code as 'PREMIUM');
                      return;
                    }
                    void handleChangePlan(option.code);
                  }}
                  disabled={loading || !csrfToken || disabled}
                >
                  {loading ? '...' : label}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      {planLabel !== 'FREE' && !scheduledPlan && (
        <div className="flex justify-center mt-8">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive text-xs uppercase tracking-widest"
            onClick={() => requestDowngrade('FREE')}
            disabled={loading}
          >
            Revenir au plan gratuit (Annuler)
          </Button>
        </div>
      )}

      <Dialog open={!!downgradeTarget} onOpenChange={(open) => !open && setDowngradeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la rétrogradation</DialogTitle>
            <DialogDescription>
              Le changement vers {downgradeTarget} prendra effet à la fin de votre période de facturation actuelle.
              Vous conserverez vos avantages jusqu’à cette date.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDowngradeTarget(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!downgradeTarget) return;
                void handleChangePlan(downgradeTarget);
                setDowngradeTarget(null);
              }}
              disabled={loading}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Billing;
