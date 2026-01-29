import React, { useState } from 'react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { requestPasswordReset } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * Forgot password request page.
 * Preconditions: CSRF token fetched.
 * Postconditions: neutral response shown.
 */
function ForgotPassword() {
  const { csrfToken } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestPasswordReset({ email });
      setSubmitted(true);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'CAPTCHA_REQUIRED') {
        setError('Verification anti-bot requise. Reessayez plus tard.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else {
        setError('Impossible de traiter la demande.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-display font-semibold">Verification en cours</h1>
        <p className="text-sm text-mutedForeground">
          Si l'adresse est valide, un email de reinitialisation a ete envoye.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Mot de passe oublie</h1>
        <p className="text-sm text-mutedForeground">Entrez votre email pour recevoir un lien.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
          {loading ? 'Envoi...' : 'Envoyer le lien'}
        </Button>
      </form>
    </div>
  );
}

export default ForgotPassword;
