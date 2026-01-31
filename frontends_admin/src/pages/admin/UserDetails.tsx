import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import type { AdminMe } from '@/api/admin';
import {
  adjustCreditsApi,
  changeSubscription,
  forceVerifyEmail,
  getCredits,
  getUserDetails,
  purgeUser,
  requestGdprExport,
  revealSensitive,
  revokeSessions,
  revokeVerifyEmail,
  softDeleteUser,
  triggerPasswordReset,
  updateUserRole,
  updateUserStatus
} from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import Badge from '@/components/admin/Badge';
import ConfirmRevealModal from '@/components/admin/ConfirmRevealModal';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

const PLAN_CODES = ['FREE', 'PREMIUM', 'VIP'];
const STATUS_ACTIONS = [
  { value: 'ban', label: 'Bannir' },
  { value: 'unban', label: 'Debannir' },
  { value: 'deactivate', label: 'Desactiver' },
  { value: 'reactivate', label: 'Reactiver' }
];

function UserDetails() {
  const { id } = useParams();
  const admin = useOutletContext<AdminMe>();
  const queryClient = useQueryClient();
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [emailFull, setEmailFull] = useState<string | null>(null);
  const [role, setRole] = useState('user');
  const [statusAction, setStatusAction] = useState('ban');
  const [planCode, setPlanCode] = useState('FREE');
  const [proration, setProration] = useState(true);
  const [creditsDelta, setCreditsDelta] = useState(0);
  const [creditsReason, setCreditsReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getUserDetails(id!),
    enabled: Boolean(id)
  });

  const creditsQuery = useQuery({
    queryKey: ['admin-user-credits', id],
    queryFn: () => getCredits(id!),
    enabled: Boolean(id)
  });

  const user = detailsQuery.data;

  useEffect(() => {
    if (user) {
      setRole(user.profile.roles[0] ?? 'user');
      setPlanCode(user.billing.plan_code ?? 'FREE');
    }
  }, [user]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-user-credits', id] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => {
      setMessage(null);
      setError(null);
      await action();
      invalidate();
    },
    onSuccess: () => setMessage('Action effectuee.'),
    onError: () => setError('Action impossible pour le moment.')
  });

  const handleReveal = async (confirmValue: string) => {
    try {
      setRevealError(null);
      const result = await revealSensitive(id!, ['email'], confirmValue);
      setEmailFull(result.email_full ?? null);
      setRevealOpen(false);
    } catch (err) {
      setRevealError('Confirmation incorrecte.');
    }
  };

  if (detailsQuery.isLoading) {
    return <div className="text-mutedForeground">Chargement...</div>;
  }

  if (detailsQuery.isError || !user) {
    return <div className="text-destructive">Impossible de charger le profil utilisateur.</div>;
  }

  return (
    <div>
      <PageHeader
        title={`Utilisateur ${user.profile.username ?? 'Sans pseudo'}`}
        description="Actions sensibles et resume du compte."
      />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Prenom</Label>
              <p className="mt-1 font-semibold">{user.profile.first_name ?? '—'}</p>
            </div>
            <div>
              <Label>Nom</Label>
              <p className="mt-1 font-semibold">{user.profile.last_name ?? '—'}</p>
            </div>
            <div>
              <Label>Pseudo</Label>
              <p className="mt-1 font-semibold">{user.profile.username ?? '—'}</p>
            </div>
            <div>
              <Label>Nationalite</Label>
              <p className="mt-1 font-semibold">{user.profile.nationality ?? '—'}</p>
            </div>
            <div>
              <Label>Email</Label>
              <p className="mt-1 font-semibold">{emailFull ?? user.profile.email_masked ?? '—'}</p>
            </div>
            <div>
              <Label>Sessions actives</Label>
              <p className="mt-1 font-semibold">{user.sessions_count}</p>
            </div>
            <div>
              <Label>Statut</Label>
              <Badge variant={user.profile.status === 'active' ? 'success' : 'warning'}>
                {user.profile.status}
              </Badge>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {user.profile.roles.map((roleValue) => (
                <Badge key={roleValue} variant="info">
                  {roleValue}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flags securite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Email verifie: {user.flags.email_verified ? 'Oui' : 'Non'}</p>
            <p>Telephone verifie: {user.flags.phone_verified ? 'Oui' : 'Non'}</p>
            <p>MFA activee: {user.flags.mfa_enabled ? 'Oui' : 'Non'}</p>
            <p>Compte supprime: {user.flags.deleted ? 'Oui' : 'Non'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Actions rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => setRevealOpen(true)}
            >
              Afficher email complet
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate(() => revokeSessions(id!, 'all'))}
            >
              Revoquer sessions
            </Button>
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate(() => requestGdprExport(id!))}
            >
              Export RGPD
            </Button>
            <Button
              variant="destructive"
              onClick={() => actionMutation.mutate(() => softDeleteUser(id!))}
            >
              Soft delete
            </Button>
            <Button
              variant="destructive"
              onClick={() => actionMutation.mutate(() => purgeUser(id!))}
            >
              Purger definitivement
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role & statut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Role</Label>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="user">User</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
                <option value="admin" disabled={admin.admin.role !== 'super_admin'}>
                  Admin
                </option>
                <option value="super_admin" disabled={admin.admin.role !== 'super_admin'}>
                  Super admin
                </option>
              </select>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => actionMutation.mutate(() => updateUserRole(id!, role))}
              >
                Mettre a jour
              </Button>
            </div>
            <div>
              <Label>Statut</Label>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
                value={statusAction}
                onChange={(event) => setStatusAction(event.target.value)}
              >
                {STATUS_ACTIONS.map((action) => (
                  <option key={action.value} value={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => actionMutation.mutate(() => updateUserStatus(id!, statusAction))}
              >
                Appliquer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification & reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={() => actionMutation.mutate(() => triggerPasswordReset(id!, 'send_link'))}>
              Envoyer lien reset
            </Button>
            <Button variant="outline" onClick={() => actionMutation.mutate(() => triggerPasswordReset(id!, 'force_reset'))}>
              Reset force
            </Button>
            <Button variant="outline" onClick={() => actionMutation.mutate(() => forceVerifyEmail(id!))}>
              Forcer verification email
            </Button>
            <Button variant="outline" onClick={() => actionMutation.mutate(() => revokeVerifyEmail(id!))}>
              Retirer verification email
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Abonnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Plan actuel</Label>
                <p className="mt-1 font-semibold">{user.billing.plan_code}</p>
              </div>
              <div>
                <Label>Statut</Label>
                <p className="mt-1 font-semibold">{user.billing.status}</p>
              </div>
              <div>
                <Label>Periode</Label>
                <p className="mt-1 text-sm text-mutedForeground">
                  {user.billing.period_start ? new Date(user.billing.period_start).toLocaleDateString('fr-FR') : '—'} →
                  {user.billing.period_end ? new Date(user.billing.period_end).toLocaleDateString('fr-FR') : '—'}
                </p>
              </div>
              <div>
                <Label>Quota projets</Label>
                <p className="mt-1 font-semibold">
                  {user.billing.entitlements.projects_limit ?? 'Illimite'}
                </p>
              </div>
              <div>
                <Label>Projets utilises</Label>
                <p className="mt-1 font-semibold">{user.billing.entitlements.projects_used}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Nouveau plan</Label>
                <select
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
                  value={planCode}
                  onChange={(event) => setPlanCode(event.target.value)}
                >
                  {PLAN_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  id="proration"
                  type="checkbox"
                  checked={proration}
                  onChange={(event) => setProration(event.target.checked)}
                />
                <Label htmlFor="proration">Proration</Label>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={() => actionMutation.mutate(() => changeSubscription(id!, { plan_code: planCode, proration }))}
                >
                  Changer le plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{creditsQuery.data?.balance ?? user.credits_balance}</p>
            <Label>Delta</Label>
            <Input
              type="number"
              value={creditsDelta}
              onChange={(event) => setCreditsDelta(Number(event.target.value))}
            />
            <Label>Raison</Label>
            <Input value={creditsReason} onChange={(event) => setCreditsReason(event.target.value)} />
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate(() => adjustCreditsApi(id!, { delta: creditsDelta, reason: creditsReason }))}
              disabled={!creditsReason}
            >
              Appliquer
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ledger credits</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-mutedForeground">
            {(creditsQuery.data?.ledger ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-border/60 pb-2">
                <span>{entry.reason}</span>
                <span className={entry.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            ))}
            {creditsQuery.data?.ledger?.length === 0 ? <li>Aucun mouvement.</li> : null}
          </ul>
        </CardContent>
      </Card>

      <ConfirmRevealModal
        open={revealOpen}
        onOpenChange={setRevealOpen}
        onConfirm={handleReveal}
        error={revealError}
        loading={false}
      />
    </div>
  );
}

export default UserDetails;
