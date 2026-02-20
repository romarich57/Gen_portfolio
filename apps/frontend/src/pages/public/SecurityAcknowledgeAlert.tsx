import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import { Card, CardContent } from '@/components/ui/Card';
import { acknowledgeSecurityAlert } from '@/api/auth';
import type { ApiError } from '@/api/http';

function SecurityAcknowledgeAlert() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.delete('token');
    const queryString = nextQuery.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [token, searchParams]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Lien invalide ou manquant.');
      return;
    }

    let active = true;
    const run = async () => {
      setStatus('loading');
      try {
        await acknowledgeSecurityAlert(token);
        if (active) setStatus('success');
      } catch (err) {
        if (!active) return;
        const apiError = err as ApiError;
        if (apiError.code === 'NETWORK_ERROR') {
          setError('Impossible de contacter le serveur.');
        } else {
          setError('Lien invalide ou expiré.');
        }
        setStatus('error');
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <Badge className="border border-border bg-transparent text-mutedForeground">Sécurité</Badge>
        <h1 className="mt-3 text-3xl font-display font-semibold">C’était vous ?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous enregistrons votre confirmation.
        </p>
      </div>

      <Card className="border-border/60 bg-card/90 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)]">
        <CardContent className="space-y-5 p-6">
          {status === 'loading' && (
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                ⏳
              </span>
              <div>
                <p className="text-sm font-semibold">Validation en cours</p>
                <p className="text-xs text-muted-foreground">Merci de patienter.</p>
              </div>
            </div>
          )}

          {status === 'error' && error && <ErrorBanner message={error} />}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-semibold">Confirmation enregistrée</p>
                  <p className="text-xs text-muted-foreground">
                    Merci, nous avons bien noté que cette connexion était légitime.
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/login')} size="lg" className="w-full">
                Retour au login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SecurityAcknowledgeAlert;
