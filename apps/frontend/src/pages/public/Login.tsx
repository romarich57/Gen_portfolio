import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { login, resendEmailVerification, startOAuth } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * Login page.
 * Preconditions: CSRF token fetched.
 * Postconditions: session established or onboarding redirected.
 */
function Login() {
  const navigate = useNavigate();
  const { refreshUser, csrfToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResendStatus(null);
    setEmailNotVerified(false);
    setLoading(true);

    try {
      const result = await login({ email, password });
      if ('error' in result) {
        if (result.error === 'MFA_CHALLENGE_REQUIRED') {
          navigate('/mfa-challenge');
          return;
        }
      }

      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      const apiError = err as ApiError;
      switch (apiError.code) {
        case 'EMAIL_NOT_VERIFIED':
          setError('Votre email n\\'est pas verifie. Verifiez votre boite mail.');
          setEmailNotVerified(true);
          break;
        case 'PHONE_NOT_VERIFIED':
          navigate('/verify-phone');
          break;
        case 'MFA_SETUP_REQUIRED':
          navigate('/setup-mfa');
          break;
        case 'ONBOARDING_REQUIRED':
          navigate('/profile');
          break;
        default:
          setError('Identifiants invalides.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendStatus(null);
    try {
      await resendEmailVerification({ email });
      setResendStatus('Si le compte existe, un email vient d\\'etre renvoye.');
    } catch {
      setResendStatus('Impossible de renvoyer l\\'email pour le moment.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Connexion</h1>
        <p className="text-sm text-mutedForeground">Connectez-vous a votre compte.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {resendStatus && <p className="text-xs text-mutedForeground">{resendStatus}</p>}

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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-primary">
          Mot de passe oublie ?
        </Link>
        <Link to="/register" className="text-primary">
          Creer un compte
        </Link>
      </div>

      {emailNotVerified && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-mutedForeground">
          <p>Besoin de renvoyer l'email de verification ?</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            className="mt-2"
            disabled={!csrfToken}
          >
            Renvoyer l'email
          </Button>
        </div>
      )}

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

export default Login;
