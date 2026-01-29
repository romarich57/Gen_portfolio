import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
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
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-display font-semibold">Verification email</h1>
      {status === 'loading' && <p className="text-sm text-mutedForeground">Verification...</p>}
      {status === 'error' && error && <ErrorBanner message={error} />}
      {status === 'success' && (
        <div className="space-y-3">
          <p className="text-sm text-mutedForeground">
            {token
              ? "Email verifie. Vous pouvez vous connecter."
              : "Si votre compte existe, un email de verification a ete envoye."}
          </p>
          <Button onClick={() => navigate('/login')}>
            Se connecter
          </Button>
        </div>
      )}
    </div>
  );
}

export default VerifyEmail;
