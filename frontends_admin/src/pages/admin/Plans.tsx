import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import type { AdminMe, PlanAdmin } from '@/api/admin';
import { createCoupon, createPlan, getPlans, updatePlan } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

type PlanFormState = {
  name_fr: string;
  price_eur_cents: number;
  project_limit: number | null;
  credits_monthly: number | null;
  is_active: boolean;
  create_new_price: boolean;
};

type PlanCreatePayload = {
  code: string;
  name_fr: string;
  price_eur_cents: number;
  project_limit?: number | null;
  credits_monthly?: number | null;
  create_stripe?: boolean;
};

type CouponPayload = {
  percent_off?: number;
  amount_off?: number;
  duration: string;
  code: string;
};

function Plans() {
  const admin = useOutletContext<AdminMe>();
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: getPlans });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = (text: string) => {
    setMessage(text);
    setError(null);
  };

  const handleError = (text: string) => {
    setError(text);
    setMessage(null);
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      handleMessage('Plan mis a jour.');
    },
    onError: () => handleError('Impossible de mettre a jour le plan.')
  });

  const createMutation = useMutation({
    mutationFn: (payload: PlanCreatePayload) => createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      handleMessage('Plan cree.');
    },
    onError: () => handleError('Impossible de creer le plan.')
  });

  const couponMutation = useMutation({
    mutationFn: (payload: CouponPayload) => createCoupon(payload),
    onSuccess: () => handleMessage('Coupon Stripe cree.'),
    onError: () => handleError('Impossible de creer le coupon.')
  });

  const plans = plansQuery.data?.plans ?? [];
  const isSuperAdmin = admin.admin.role === 'super_admin';

  return (
    <div>
      <PageHeader title="Plans & Billing" description="Gestion des plans, prix et coupons Stripe." />

      {message ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {plansQuery.isError ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les plans.
        </div>
      ) : null}

      {isSuperAdmin ? <PlanCreateCard onSubmit={(payload) => createMutation.mutate(payload)} /> : null}

      <div className="grid gap-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            canEdit={isSuperAdmin}
            onSave={(payload) => updateMutation.mutate({ id: plan.id, payload })}
          />
        ))}
      </div>

      {isSuperAdmin ? <CouponCard onSubmit={(payload) => couponMutation.mutate(payload)} /> : null}
    </div>
  );
}

function PlanCard({
  plan,
  onSave,
  canEdit
}: {
  plan: PlanAdmin;
  onSave: (payload: Record<string, unknown>) => void;
  canEdit: boolean;
}) {
  const [state, setState] = useState<PlanFormState>({
    name_fr: plan.name_fr,
    price_eur_cents: plan.monthly_price_eur_cents,
    project_limit: plan.project_limit ?? null,
    credits_monthly: plan.credits_monthly ?? null,
    is_active: plan.is_active,
    create_new_price: false
  });

  const updateField = <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan.code}</CardTitle>
        <p className="text-sm text-mutedForeground">Stripe price: {plan.stripe_price_id ?? '—'}</p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Nom</Label>
          <Input
            value={state.name_fr}
            onChange={(event) => updateField('name_fr', event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Prix mensuel (centimes)</Label>
          <Input
            type="number"
            value={state.price_eur_cents}
            onChange={(event) => updateField('price_eur_cents', Number(event.target.value))}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Limite projets</Label>
          <Input
            type="number"
            value={state.project_limit ?? ''}
            onChange={(event) =>
              updateField('project_limit', event.target.value === '' ? null : Number(event.target.value))
            }
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Credits mensuels</Label>
          <Input
            type="number"
            value={state.credits_monthly ?? ''}
            onChange={(event) =>
              updateField('credits_monthly', event.target.value === '' ? null : Number(event.target.value))
            }
            disabled={!canEdit}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`active-${plan.id}`}
            type="checkbox"
            checked={state.is_active}
            onChange={(event) => updateField('is_active', event.target.checked)}
            disabled={!canEdit}
          />
          <Label htmlFor={`active-${plan.id}`}>Plan actif</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`new-price-${plan.id}`}
            type="checkbox"
            checked={state.create_new_price}
            onChange={(event) => updateField('create_new_price', event.target.checked)}
            disabled={!canEdit}
          />
          <Label htmlFor={`new-price-${plan.id}`}>Creer un nouveau price Stripe</Label>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button variant="outline" onClick={() => onSave(state)} disabled={!canEdit}>
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCreateCard({ onSubmit }: { onSubmit: (payload: PlanCreatePayload) => void }) {
  const [code, setCode] = useState('FREE');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [projectLimit, setProjectLimit] = useState<number | null>(null);
  const [creditsMonthly, setCreditsMonthly] = useState<number | null>(null);
  const [createStripe, setCreateStripe] = useState(false);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Creer un plan</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Code</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          >
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option>
            <option value="VIP">VIP</option>
          </select>
        </div>
        <div>
          <Label>Nom</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label>Prix (centimes)</Label>
          <Input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
        </div>
        <div>
          <Label>Limite projets</Label>
          <Input
            type="number"
            value={projectLimit ?? ''}
            onChange={(event) => setProjectLimit(event.target.value === '' ? null : Number(event.target.value))}
          />
        </div>
        <div>
          <Label>Credits mensuels</Label>
          <Input
            type="number"
            value={creditsMonthly ?? ''}
            onChange={(event) => setCreditsMonthly(event.target.value === '' ? null : Number(event.target.value))}
          />
        </div>
        <div className="flex items-center gap-2 pt-8">
          <input
            id="create-stripe"
            type="checkbox"
            checked={createStripe}
            onChange={(event) => setCreateStripe(event.target.checked)}
          />
          <Label htmlFor="create-stripe">Creer sur Stripe</Label>
        </div>
        <div className="md:col-span-3 flex justify-end">
          <Button
            variant="outline"
            onClick={() =>
              onSubmit({
                code,
                name_fr: name,
                price_eur_cents: price,
                project_limit: projectLimit,
                credits_monthly: creditsMonthly,
                create_stripe: createStripe
              })
            }
          >
            Creer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CouponCard({ onSubmit }: { onSubmit: (payload: CouponPayload) => void }) {
  const [code, setCode] = useState('');
  const [percentOff, setPercentOff] = useState<number | ''>('');
  const [amountOff, setAmountOff] = useState<number | ''>('');
  const [duration, setDuration] = useState('once');

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Coupons Stripe</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div>
          <Label>Code</Label>
          <Input value={code} onChange={(event) => setCode(event.target.value)} />
        </div>
        <div>
          <Label>Pourcentage</Label>
          <Input
            type="number"
            value={percentOff}
            onChange={(event) => setPercentOff(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </div>
        <div>
          <Label>Montant (centimes)</Label>
          <Input
            type="number"
            value={amountOff}
            onChange={(event) => setAmountOff(event.target.value === '' ? '' : Number(event.target.value))}
          />
        </div>
        <div>
          <Label>Duree</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            <option value="once">Une fois</option>
            <option value="repeating">Repetitif</option>
            <option value="forever">Permanent</option>
          </select>
        </div>
        <div className="md:col-span-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              const payload: CouponPayload = { code, duration };
              if (percentOff !== '') payload.percent_off = Number(percentOff);
              if (amountOff !== '') payload.amount_off = Number(amountOff);
              onSubmit(payload);
            }}
          >
            Creer le coupon
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default Plans;
