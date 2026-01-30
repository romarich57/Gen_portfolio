import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { getSessionsHistory, revokeAllSessions, revokeSessionById } from '@/api/me';
import type { SessionHistoryEntry } from '@/api/types';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { useAuth } from '@/app/providers/AuthBootstrap';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

function statusLabel(status?: SessionHistoryEntry['status']) {
  switch (status) {
    case 'revoked':
      return { text: 'Révoquée', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
    case 'expired':
      return { text: 'Expirée', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    default:
      return { text: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  }
}

function Sessions() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const {
    data: sessionsData,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['sessions-history'],
    queryFn: async () => getSessionsHistory()
  });

  const sessions = sessionsData?.sessions ?? [];

  const handleRevoke = async (sessionId: string, isCurrent: boolean) => {
    setError(null);
    setRevoking(sessionId);
    try {
      await revokeSessionById(sessionId);
      if (isCurrent) {
        await logout();
        navigate('/login');
        return;
      }
      await refetch();
    } catch {
      setError('Impossible de révoquer la session.');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setError(null);
    setRevokingAll(true);
    try {
      await revokeAllSessions({ includeCurrent: true });
      await logout();
      navigate('/login');
    } catch {
      setError('Impossible de révoquer toutes les sessions.');
    } finally {
      setRevokingAll(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black uppercase tracking-tight">Sessions & appareils</h1>
          <p className="text-sm text-muted-foreground">Historique des connexions et appareils autorisés.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/profile')}>
          Retour au profil
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="border-border/50">
        <CardContent className="space-y-4 py-6">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune session à afficher.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const status = statusLabel(session.status);
                return (
                  <div key={session.id} className="rounded-lg border border-border/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {session.user_agent || 'Navigateur inconnu'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          IP: {session.ip || '—'} · {session.location?.label || 'Localisation inconnue'} · Dernière activité: {formatDate(session.last_used_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.current && (
                          <Badge className="border border-border/50 bg-transparent text-foreground">Actuelle</Badge>
                        )}
                        <Badge className={status.className}>{status.text}</Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>Créée le: {formatDate(session.created_at)}</div>
                      <div>Expire le: {formatDate(session.expires_at)}</div>
                      {session.revoked_at && <div>Révoquée le: {formatDate(session.revoked_at)}</div>}
                      {session.device_fingerprint && <div>Device ID: {session.device_fingerprint}</div>}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revoking === session.id || session.status === 'revoked'}
                        onClick={() => handleRevoke(session.id, session.current)}
                      >
                        {revoking === session.id ? '...' : session.current ? 'Se déconnecter' : 'Révoquer'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" disabled={revokingAll || sessions.length === 0} onClick={handleRevokeAll}>
              {revokingAll ? 'Déconnexion...' : 'Déconnecter partout'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Sessions;
