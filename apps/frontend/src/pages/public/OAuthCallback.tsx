import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useAuth } from '@/app/providers/AuthBootstrap';
import { apiRequest } from '@/api/http';
import { isProfileComplete } from '@/utils/profile';

/**
 * OAuth callback landing page.
 * Preconditions: backend already set cookies and redirected.
 * Postconditions: routes user based on session state.
 */
function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    google?: { redirect_uri: string; client_id: string };
    github?: { redirect_uri: string; client_id: string };
  } | null>(null);

  useEffect(() => {
    const next = searchParams.get('next');
    const allowedNext = new Set([
      'verify-email',
      'verify-phone',
      'setup-mfa',
      'mfa-challenge',
      'dashboard',
      'complete-profile'
    ]);

    if (next && allowedNext.has(next) && next !== 'dashboard' && next !== 'complete-profile') {
      navigate(`/${next}`);
      return;
    }

    const run = async () => {
      try {
        const refreshed = await refreshUser();
        if (!refreshed) {
          setStatus('error');
          setError('Impossible de finaliser la connexion.');
          return;
        }
        if (!isProfileComplete(refreshed)) {
          navigate('/complete-profile');
          return;
        }
        setStatus('ready');
      } catch {
        setStatus('error');
        setError('Impossible de finaliser la connexion.');
      }
    };

    run();
  }, [refreshUser, searchParams, navigate]);

  useEffect(() => {
    if (status !== 'ready') return;

    const next = searchParams.get('next');
    if (user) {
      navigate('/dashboard');
      return;
    }

    const explicitStatus = searchParams.get('status');
    if (explicitStatus === 'error') {
      setError('Connexion OAuth echouee.');
      setStatus('error');
    }
  }, [status, user, navigate, searchParams]);

  useEffect(() => {
    if (status !== 'error') return;
    const loadDebug = async () => {
      try {
        const data = await apiRequest<{
          google?: { redirect_uri: string; client_id: string };
          github?: { redirect_uri: string; client_id: string };
        }>('/auth/oauth/debug', { method: 'GET', skipAuthRedirect: true });
        setDebugInfo(data);
      } catch {
        setDebugInfo(null);
      }
    };
    loadDebug();
  }, [status]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-display font-semibold">Connexion OAuth</h1>
      {status === 'loading' && <p className="text-sm text-mutedForeground">Finalisation...</p>}
      {status === 'error' && error && <ErrorBanner message={error} />}
      {status === 'error' && (
        <div className="rounded-xl border border-border bg-card/90 p-4 text-sm text-mutedForeground">
          <p>Conseils de diagnostic :</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Verifier l'URI de redirection enregistree chez le provider.</li>
            <li>Verifier que vous etes bien sur https://localhost:3000 en dev.</li>
            <li>Reessayer la connexion apres avoir mis a jour les redirects.</li>
          </ul>
          {searchParams.get('request_id') && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground">Request ID</p>
              <p className="break-all">{searchParams.get('request_id')}</p>
            </div>
          )}
          {debugInfo?.google?.redirect_uri && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground">Google redirect URI attendu</p>
              <p className="break-all">{debugInfo.google.redirect_uri}</p>
            </div>
          )}
          {debugInfo?.github?.redirect_uri && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold text-foreground">GitHub redirect URI attendu</p>
              <p className="break-all">{debugInfo.github.redirect_uri}</p>
            </div>
          )}
        </div>
      )}
      {status === 'error' && (
        <Button onClick={() => navigate('/login')}>Retour au login</Button>
      )}
    </div>
  );
}

export default OAuthCallback;
