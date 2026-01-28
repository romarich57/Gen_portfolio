import React from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/app/providers/AuthBootstrap';

const plans = [
  {
    code: 'FREE',
    name: 'Free',
    price: '0 EUR',
    description: 'Demarrage rapide pour tester.',
    features: ['1 projet / mois', 'Support standard', 'Acces communautaire']
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    price: '10 EUR / mois',
    description: 'Pour les equipes en croissance.',
    features: ['5 projets / mois', 'Support prioritaire', 'Exports avances']
  },
  {
    code: 'VIP',
    name: 'VIP',
    price: '30 EUR / mois',
    description: 'Acces illimite et accompagnement.',
    features: ['Projets illimites', 'Support dedie', 'Roadmap preview']
  }
];

/**
 * Public landing page with pricing.
 * Preconditions: none.
 * Postconditions: renders plan cards and CTAs.
 */
function LandingPricing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 pt-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Badge className="bg-accent text-accentForeground">SaaS secure by design</Badge>
          <h1 className="text-4xl font-display font-semibold leading-tight lg:text-5xl">
            Lancez votre SaaS avec une securite enterprise-grade.
          </h1>
          <p className="text-lg text-mutedForeground">
            Auth forte, RGPD, billing Stripe et onboarding securise deja integres. Concentrez-vous
            sur le produit.
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Button size="lg" onClick={() => navigate('/dashboard')}>
                Aller au dashboard
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => navigate('/register')}>
                  Commencer gratuit
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate('/login')}>
                  Se connecter
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-accent/30 blur-3xl" />
          <div className="relative rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <h2 className="text-xl font-display font-semibold">Ce que vous obtenez</h2>
            <ul className="mt-4 space-y-2 text-sm text-mutedForeground">
              <li>CSRF, rate-limits, audit logs, MFA obligatoire</li>
              <li>Billing Stripe + role grants automatises</li>
              <li>RGPD export/suppression asynchrones</li>
              <li>Infra prete pour production (OWASP/NIST)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.code} className="animate-fadeUp">
            <CardHeader>
              <p className="text-sm font-semibold text-mutedForeground">{plan.name}</p>
              <h3 className="text-2xl font-display font-semibold">{plan.price}</h3>
              <p className="text-sm text-mutedForeground">{plan.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-mutedForeground">
                {plan.features.map((feature) => (
                <li key={feature}>- {feature}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {user ? (
                <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
                  Gerer mon plan
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate('/register')}>
                  Choisir {plan.name}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default LandingPricing;
