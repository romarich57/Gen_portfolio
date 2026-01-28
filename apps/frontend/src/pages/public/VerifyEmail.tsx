import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/common/ErrorBanner';
import { verifyEmail } from '@/api/auth';

/**
 * Verify email page.
 * Preconditions: token present in query string.
 * Postconditions: triggers backend verification.
 */
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
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
      } catch {
        if (active) {
          setStatus('error');
          setError('Lien de verification invalide.');
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-display font-semibold">Verification email</h1>
      {status === 'loading' && <p className="text-sm text-mutedForeground">Verification...</p>}
      {status === 'error' && error && <ErrorBanner message={error} />}
      {status === 'success' && (
        <div className="space-y-3">
          <p className="text-sm text-mutedForeground">
            {token
              ? "Email verifie. Continuez l'onboarding."
              : "Si votre compte existe, un email de verification a ete envoye."}
          </p>
          <Button onClick={() => navigate(token ? '/verify-phone' : '/login')}>
            {token ? 'Verifier mon telephone' : 'Se connecter'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default VerifyEmail;
