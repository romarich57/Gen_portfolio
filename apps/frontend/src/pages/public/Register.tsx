import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { register, startOAuth } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Register page for new users.
 * Preconditions: CSRF token available.
 * Postconditions: triggers email verification flow.
 */
function Register() {
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register({ email, password });
      setSubmitted(true);
    } catch {
      setError('Impossible de creer le compte. Reessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-display font-semibold">Verifiez votre email</h1>
        <p className="text-sm text-mutedForeground">
          Si l'adresse est valide, un email de verification vient d'etre envoye.
        </p>
        <Button onClick={() => navigate('/login')}>Aller au login</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Creer un compte</h1>
        <p className="text-sm text-mutedForeground">Commencez par verifier votre email.</p>
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
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
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
          {loading ? 'Creation...' : 'Creer le compte'}
        </Button>
      </form>

      <div className="space-y-3">
        <p className="text-xs text-mutedForeground">Ou continuer avec</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => startOAuth('google')}>
            Google
          </Button>
          <Button variant="outline" onClick={() => startOAuth('github')}>
            GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Register;
