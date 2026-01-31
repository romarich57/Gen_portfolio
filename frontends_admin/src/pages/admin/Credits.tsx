import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adjustCreditsApi, getCredits } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

function Credits() {
  const [userId, setUserId] = useState('');
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const creditsQuery = useQuery({
    queryKey: ['admin-credits', userId],
    queryFn: () => getCredits(userId),
    enabled: userId.length > 0
  });

  const adjustMutation = useMutation({
    mutationFn: () => adjustCreditsApi(userId, { delta, reason }),
    onSuccess: () => {
      setMessage('Credits mis a jour.');
      setError(null);
      creditsQuery.refetch();
    },
    onError: () => {
      setError('Impossible d ajuster les credits.');
      setMessage(null);
    }
  });

  return (
    <div>
      <PageHeader title="Credits & Quotas" description="Gestion interne des credits utilisateurs." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Rechercher un utilisateur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label htmlFor="userId">ID utilisateur</Label>
            <Input id="userId" value={userId} onChange={(event) => setUserId(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => creditsQuery.refetch()} disabled={!userId}>
              Charger
            </Button>
          </div>
        </CardContent>
      </Card>

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
      {creditsQuery.isError ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les credits.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Solde</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{creditsQuery.data?.balance ?? '—'}</p>
            <div className="mt-4 grid gap-3">
              <Label>Delta</Label>
              <Input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} />
              <Label>Raison</Label>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
              <Button onClick={() => adjustMutation.mutate()} disabled={!reason || !userId}>
                Ajuster
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-mutedForeground">
              {(creditsQuery.data?.ledger ?? []).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span>{entry.reason}</span>
                  <span className={entry.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                </li>
              ))}
              {!creditsQuery.isFetching && (creditsQuery.data?.ledger?.length ?? 0) === 0 ? (
                <li>Aucun mouvement.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Credits;
