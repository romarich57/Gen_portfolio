import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import { verifyEmail } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import { isProfileComplete } from '@/utils/profile';
import type { ApiError } from '@/api/http';

/**
 * Verify email page.
 * Preconditions: token present in query string.
 * Postconditions: triggers backend verification.
 */
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('success');
      return;
    }

    let active = true;
    const run = async () => {
      setStatus('loading');
      try {
        await verifyEmail(token);
        if (active) {
          setStatus('success');
        }
      } catch (err) {
        if (active) {
          setStatus('error');
          const apiError = err as ApiError;
          if (apiError.code === 'NETWORK_ERROR') {
            setError('Impossible de contacter le serveur.');
          } else {
            setError('Lien de verification invalide.');
          }
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (status !== 'success' || !user) return;
    if (isProfileComplete(user)) {
      navigate('/dashboard');
    } else {
      navigate('/complete-profile');
    }
  }, [status, user, navigate]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <Badge variant="outline">Verification</Badge>
        <h1 className="mt-3 text-3xl font-display font-semibold">Verification de votre email</h1>
        <p className="mt-2 text-sm text-mutedForeground">
          Finalisez votre inscription en quelques instants.
        </p>
      </div>

      <Card className="border-border/60 bg-card/90 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)]">
        <CardContent className="space-y-5 p-6">
          {status === 'loading' && (
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-mutedForeground">
                ⏳
              </span>
              <div>
                <p className="text-sm font-semibold">Verification en cours</p>
                <p className="text-xs text-mutedForeground">Nous validons votre lien.</p>
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
                  <p className="text-sm font-semibold">Email confirme</p>
                  <p className="text-xs text-mutedForeground">
                    {token
                      ? "Votre adresse est maintenant verifiee."
                      : "Si votre compte existe, un email de verification a ete envoye."}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-mutedForeground">
                <p>Prochaines etapes :</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                  <li>Connectez-vous avec votre email ou votre pseudo.</li>
                  <li>Completez votre profil si besoin.</li>
                  <li>Activez le telephone ou la MFA dans Profil &gt; Securite (optionnel).</li>
                </ul>
              </div>
              <Button onClick={() => navigate('/login')} size="lg" className="w-full">
                Se connecter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerifyEmail;
