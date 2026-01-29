import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/app/providers/AuthBootstrap';
import { getServiceStatus, getServiceStatusHistory } from '@/api/admin';
import type { ApiError } from '@/api/http';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

function ServiceStatusCard({
  label,
  status
}: {
  label: string;
  status: { ok: boolean; latency_ms: number | null; error?: string | null };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-semibold">{label}</h3>
          <Badge>{status.ok ? 'OK' : 'KO'}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-mutedForeground">
          {status.ok ? 'Service disponible' : 'Service indisponible'}
        </p>
        <div className="mt-2 text-xs text-mutedForeground">
          Latence: {status.latency_ms !== null ? `${status.latency_ms} ms` : 'n/a'}
        </div>
        {!status.ok && status.error && (
          <p className="mt-2 text-xs text-destructive">Erreur: {status.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceStatus() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['service-status'],
    queryFn: async () => getServiceStatus(),
    enabled: Boolean(isAdmin)
  });

  const {
    data: historyData,
    isError: historyError,
    error: historyFetchError,
    refetch: refetchHistory,
    isLoading: historyLoading
  } = useQuery({
    queryKey: ['service-status-history'],
    queryFn: async () => getServiceStatusHistory(20),
    enabled: Boolean(isAdmin)
  });

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display font-semibold">Statut des services</h1>
        <ErrorBanner message="Acces admin requis pour consulter ce statut." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <Loading />
      </div>
    );
  }

  if (isError || !data) {
    const apiError = error as ApiError | undefined;
    const message =
      apiError?.code === 'NETWORK_ERROR'
        ? 'Impossible de contacter le serveur.'
        : 'Impossible de charger le statut des services.';
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display font-semibold">Statut des services</h1>
        <ErrorBanner message={message} />
        <Button variant="outline" onClick={() => refetch()}>
          Reessayer
        </Button>
      </div>
    );
  }

  const { services } = data;
  const hasIssue = !services.smtp.ok || !services.s3.ok;
  const history = historyData?.history ?? [];
  const computeAverage = (values: Array<number | null>) => {
    const filtered = values.filter((value): value is number => typeof value === 'number');
    if (filtered.length === 0) return null;
    const sum = filtered.reduce((acc, value) => acc + value, 0);
    return Math.round(sum / filtered.length);
  };
  const smtpAvg = computeAverage(history.map((entry) => entry.services.smtp.latency_ms ?? null));
  const s3Avg = computeAverage(history.map((entry) => entry.services.s3.latency_ms ?? null));
  const historyErrorMessage =
    (historyFetchError as ApiError | undefined)?.code === 'NETWORK_ERROR'
      ? 'Impossible de contacter le serveur.'
      : 'Impossible de charger l\'historique.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold">Statut des services</h1>
          <p className="text-sm text-mutedForeground">Verification SMTP/S3 pour le support.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          Rafraichir
        </Button>
      </div>

      {hasIssue && (
        <ErrorBanner message="Un ou plusieurs services sont indisponibles. Verifiez la configuration SMTP/S3." />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ServiceStatusCard label="SMTP (email)" status={services.smtp} />
        <ServiceStatusCard label="S3 (stockage)" status={services.s3} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-display font-semibold">Latence moyenne SMTP</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display font-semibold">
              {smtpAvg !== null ? `${smtpAvg} ms` : 'n/a'}
            </p>
            <p className="text-xs text-mutedForeground">Moyenne sur l'historique recent.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-display font-semibold">Latence moyenne S3</h3>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display font-semibold">
              {s3Avg !== null ? `${s3Avg} ms` : 'n/a'}
            </p>
            <p className="text-xs text-mutedForeground">Moyenne sur l'historique recent.</p>
          </CardContent>
        </Card>
      </div>

      <section className="rounded-2xl border border-border bg-card/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-semibold">Historique recent</h2>
            <p className="text-sm text-mutedForeground">
              20 derniers checks (ok/degraded + latences).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
            Rafraichir
          </Button>
        </div>

        {historyLoading && <p className="mt-3 text-sm text-mutedForeground">Chargement...</p>}
        {historyError && <ErrorBanner message={historyErrorMessage} className="mt-3" />}

        {!historyLoading && !historyError && history.length === 0 && (
          <p className="mt-3 text-sm text-mutedForeground">Aucun historique disponible.</p>
        )}

        {!historyLoading && !historyError && history.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-mutedForeground">
                <tr>
                  <th className="py-2 pr-4">Heure</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">SMTP</th>
                  <th className="py-2 pr-4">S3</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history
                  .slice()
                  .reverse()
                  .map((entry) => {
                    const when = new Date(entry.checked_at);
                    return (
                      <tr key={entry.checked_at} className="border-t border-border/60">
                        <td className="py-2 pr-4 text-mutedForeground">
                          {when.toLocaleString('fr-FR')}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge>{entry.ok ? 'OK' : 'DEGRADED'}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-mutedForeground">
                          {entry.services.smtp.ok ? 'OK' : 'KO'} —{' '}
                          {entry.services.smtp.latency_ms ?? 'n/a'} ms
                        </td>
                        <td className="py-2 pr-4 text-mutedForeground">
                          {entry.services.s3.ok ? 'OK' : 'KO'} — {entry.services.s3.latency_ms ?? 'n/a'} ms
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ServiceStatus;
