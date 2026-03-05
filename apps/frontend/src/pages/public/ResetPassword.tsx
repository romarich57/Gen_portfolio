import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { confirmPasswordReset } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * Password reset confirmation page.
 * Preconditions: token present in URL.
 * Postconditions: password updated on backend.
 */
function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [token] = useState(() => searchParams.get('token'));

  useEffect(() => {
    if (!token) return;
    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.delete('token');
    const queryString = nextQuery.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [token, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError('Token invalide.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset({ token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'TOKEN_INVALID') {
        setError('Lien invalide ou expire.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else {
        setError('Impossible de reinitialiser le mot de passe.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-display font-semibold">Mot de passe modifie</h1>
        <Button onClick={() => navigate('/login')}>Se connecter</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Reinitialiser le mot de passe</h1>
        <p className="text-sm text-mutedForeground">Entrez un nouveau mot de passe securise.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
          {loading ? 'Mise a jour...' : 'Confirmer'}
        </Button>
      </form>
    </div>
  );
}

export default ResetPassword;
