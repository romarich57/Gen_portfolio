import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
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
  const [identifier, setIdentifier] = useState('');
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

    let loginResult: Awaited<ReturnType<typeof login>> | null = null;
    try {
      loginResult = await login({ identifier, password });
    } catch (err) {
      const apiError = err as ApiError;
      switch (apiError.code) {
        case 'EMAIL_NOT_VERIFIED':
          setError("Votre email n'est pas verifie. Verifiez votre boite mail.");
          setEmailNotVerified(identifier.includes('@'));
          break;
        case 'MFA_SETUP_REQUIRED':
          navigate('/setup-mfa');
          break;
        case 'ONBOARDING_REQUIRED':
          navigate('/complete-profile');
          break;
        case 'CAPTCHA_REQUIRED':
          setError('Verification anti-bot requise. Reessayez plus tard.');
          break;
        case 'CSRF_TOKEN_INVALID':
        case 'CSRF_ORIGIN_INVALID':
        case 'CSRF_ORIGIN_MISSING':
          setError('Session CSRF expiree. Rechargez la page.');
          break;
        case 'NETWORK_ERROR':
          setError('Impossible de contacter le serveur.');
          break;
        default:
          setError('Identifiants invalides.');
      }
      setLoading(false);
      return;
    }

    if (loginResult && 'error' in loginResult) {
      if (loginResult.error === 'MFA_CHALLENGE_REQUIRED') {
        setLoading(false);
        navigate('/mfa-challenge');
        return;
      }
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

  const handleResend = async () => {
    if (!identifier || !identifier.includes('@')) {
      setResendStatus("Renseignez votre email pour renvoyer la verification.");
      return;
    }
    setResendStatus(null);
    try {
      const response = await resendEmailVerification({ email: identifier });
      if (response && 'email_sent' in response && response.email_sent === false) {
        setResendStatus("Echec d'envoi. Verifiez la configuration SMTP ou reessayez.");
        return;
      }
      setResendStatus("Si le compte existe, un email vient d'être renvoyé.");
    } catch {
      setResendStatus("Impossible de renvoyer l'email pour le moment.");
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

      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedForeground">
            Email & mot de passe
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email ou pseudo</Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
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
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-xs text-mutedForeground">
        <div className="h-px flex-1 bg-border" />
        <span>Ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <p className="text-xs text-mutedForeground">Continuer avec</p>
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
