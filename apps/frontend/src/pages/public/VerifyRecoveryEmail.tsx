import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import { verifyRecoveryEmail } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

function VerifyRecoveryEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Lien de verification manquant.');
      return;
    }

    let active = true;
    const run = async () => {
      setStatus('loading');
      try {
        await verifyRecoveryEmail(token);
        if (active) setStatus('success');
      } catch (err) {
        if (!active) return;
        setStatus('error');
        const apiError = err as ApiError;
        if (apiError.code === 'NETWORK_ERROR') {
          setError('Impossible de contacter le serveur.');
        } else {
          setError('Lien de verification invalide ou expire.');
        }
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
        <Badge variant="outline">Securite</Badge>
        <h1 className="mt-3 text-3xl font-display font-semibold">Verification de l'email de recuperation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirmez un email secondaire pour recuperer votre compte.
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
                <p className="text-sm font-semibold">Verification en cours</p>
                <p className="text-xs text-muted-foreground">Nous validons votre lien.</p>
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
                  <p className="text-sm font-semibold">Email de recuperation confirme</p>
                  <p className="text-xs text-muted-foreground">
                    Votre compte dispose maintenant d'une option de recuperation.
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate(user ? '/profile' : '/login')} size="lg" className="w-full">
                {user ? 'Aller au profil' : 'Se connecter'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerifyRecoveryEmail;
