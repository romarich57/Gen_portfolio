import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/common/ErrorBanner';
import { useAuth } from '@/app/providers/AuthBootstrap';

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

  useEffect(() => {
    const next = searchParams.get('next');
    const allowedNext = new Set([
      'verify-email',
      'verify-phone',
      'setup-mfa',
      'mfa-challenge',
      'dashboard',
      'profile'
    ]);

    if (next && allowedNext.has(next) && next !== 'dashboard' && next !== 'profile') {
      navigate(`/${next}`);
      return;
    }

    const run = async () => {
      try {
        await refreshUser();
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
    if (next === 'profile') {
      navigate('/profile');
      return;
    }

    if (user) {
      if (!user.onboarding_completed_at) {
        navigate('/profile');
        return;
      }
      navigate('/dashboard');
      return;
    }

    const explicitStatus = searchParams.get('status');
    if (explicitStatus === 'error') {
      setError('Connexion OAuth echouee.');
      setStatus('error');
    }
  }, [status, user, navigate, searchParams]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-display font-semibold">Connexion OAuth</h1>
      {status === 'loading' && <p className="text-sm text-mutedForeground">Finalisation...</p>}
      {status === 'error' && error && <ErrorBanner message={error} />}
      {status === 'error' && (
        <Button onClick={() => navigate('/login')}>Retour au login</Button>
      )}
    </div>
  );
}

export default OAuthCallback;
