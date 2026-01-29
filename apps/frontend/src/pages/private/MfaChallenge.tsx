import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { verifyMfa } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * MFA challenge page.
 * Preconditions: MFA challenge cookie set.
 * Postconditions: session established on success.
 */
function MfaChallenge() {
  const navigate = useNavigate();
  const { refreshUser, csrfToken } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyMfa({ code });
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else if (
        apiError.code === 'CSRF_TOKEN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_MISSING'
      ) {
        setError('Session CSRF expiree. Rechargez la page.');
      } else {
        setError('Code MFA invalide.');
      }
      setLoading(false);
      return;
    }

    try {
      const refreshed = await refreshUser();
      if (!refreshed) {
        setError('Impossible de recuperer la session.');
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Impossible de recuperer la session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Verifier la MFA</h1>
        <p className="text-sm text-mutedForeground">
          Entrez un code TOTP ou un backup code valide.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="code">Code MFA</Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
          {loading ? 'Verification...' : 'Continuer'}
        </Button>
      </form>
    </div>
  );
}

export default MfaChallenge;
