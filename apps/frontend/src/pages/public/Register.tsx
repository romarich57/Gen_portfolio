import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import CountrySelect from '@/components/common/CountrySelect';
import { register, resendEmailVerification } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

type FieldErrors = Partial<Record<'email' | 'password' | 'confirm' | 'first' | 'last' | 'username' | 'nationality', string>>;

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!local || !domain) return value;
  const maskedLocal = local.length <= 2 ? `${local[0] ?? ''}*` : `${local[0]}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Register page for new users.
 * Preconditions: CSRF token available.
 * Postconditions: triggers email verification flow.
 */
function Register() {
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED === 'true';

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirm: '',
    firstName: '',
    lastName: '',
    username: '',
    nationality: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const validations = useMemo(() => {
    const email = form.email.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const username = form.username.trim();
    const nationality = form.nationality.trim();

    return {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      password: form.password.length >= 12,
      confirm: form.password === form.confirm,
      firstName: firstName.length >= 2,
      lastName: lastName.length >= 2,
      username: USERNAME_REGEX.test(username),
      nationality: nationality.length > 0,
      terms: termsAccepted
    };
  }, [form, termsAccepted]);

  const captchaOk = !captchaRequired || !captchaEnabled || captchaToken.trim().length > 0;
  const formValid = Object.values(validations).every(Boolean) && captchaOk;

  const buildFieldErrors = () => {
    const next: FieldErrors = {};
    if (!validations.email) next.email = 'Email invalide.';
    if (!validations.password) next.password = 'Mot de passe (12 caracteres minimum).';
    if (!validations.confirm) next.confirm = 'Les mots de passe ne correspondent pas.';
    if (!validations.firstName) next.first = 'Prenom requis (2 caracteres minimum).';
    if (!validations.lastName) next.last = 'Nom requis (2 caracteres minimum).';
    if (!validations.username) next.username = 'Pseudo invalide (3-30, lettres/chiffres/._-).';
    if (!validations.nationality) next.nationality = 'Nationalite requise.';
    return next;
  };

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setResendStatus(null);
    setEmailSendFailed(false);

    const nextErrors = buildFieldErrors();
    if (Object.keys(nextErrors).length > 0 || !validations.terms) {
      setFieldErrors(nextErrors);
      if (!validations.terms) {
        setError('Veuillez accepter les conditions et la politique de confidentialite.');
      }
      return;
    }

    setLoading(true);
    try {
      const response = await register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        nationality: form.nationality.trim().toUpperCase(),
        ...(captchaToken ? { captchaToken } : {})
      });
      if (response && 'email_sent' in response && response.email_sent === false) {
        setEmailSendFailed(true);
      }
      setSubmitted(true);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        setError('Verification anti-bot requise. Reessayez plus tard.');
      } else if (apiError.code === 'USERNAME_TAKEN') {
        setFieldErrors((prev) => ({ ...prev, username: 'Ce pseudo est deja pris.' }));
        setError('Pseudo indisponible.');
      } else if (
        apiError.code === 'CSRF_TOKEN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_MISSING'
      ) {
        setError('Session CSRF expiree. Rechargez la page.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else {
        setError('Impossible de creer le compte. Reessayez plus tard.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus(null);
    setEmailSendFailed(false);
    try {
      const response = await resendEmailVerification({ email: form.email.trim() });
      if (response && 'email_sent' in response && response.email_sent === false) {
        setEmailSendFailed(true);
      }
      setResendStatus("Si le compte existe, un email vient d'etre renvoye.");
    } catch {
      setResendStatus("Impossible de renvoyer l'email pour le moment.");
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-display font-semibold">Verifiez votre email</h1>
        <p className="text-sm text-mutedForeground">
          Un email de verification a ete envoye a <strong>{maskEmail(form.email.trim())}</strong>.
        </p>
        <div className="flex flex-col gap-3">
          {emailSendFailed && (
            <ErrorBanner message="L'envoi de l'email a echoue. Verifiez la configuration SMTP ou reessayez." />
          )}
          <Button onClick={() => navigate('/login')}>Retour login</Button>
          <Button variant="outline" onClick={handleResend}>
            Renvoyer l'email
          </Button>
          {resendStatus && <p className="text-xs text-mutedForeground">{resendStatus}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6 pt-6">
        <h1 className="text-4xl font-display font-semibold leading-tight">Creer un compte</h1>
        <p className="text-base text-mutedForeground">
          Renseignez votre profil complet des le depart. Vous gagnerez du temps au moment d'acceder a
          l'application.
        </p>
        <div className="rounded-2xl border border-border bg-card/90 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-mutedForeground">Etapes</h2>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-primary text-center text-xs font-semibold text-primaryForeground">
                1
              </span>
              <div>
                <p className="font-semibold text-foreground">Creer le compte (profil complet)</p>
                <p className="text-xs text-mutedForeground">Email, mot de passe, identite.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-muted text-center text-xs font-semibold text-mutedForeground">
                2
              </span>
              <div>
                <p className="font-semibold text-foreground">Verifier l'email (obligatoire)</p>
                <p className="text-xs text-mutedForeground">Lien unique pour activer l'acces.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-muted text-center text-xs font-semibold text-mutedForeground">
                3
              </span>
              <div>
                <p className="font-semibold text-foreground">Acceder a l'application</p>
                <p className="text-xs text-mutedForeground">Dashboard et billing disponibles.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-6 w-6 rounded-full bg-muted text-center text-xs font-semibold text-mutedForeground">
                4
              </span>
              <div>
                <p className="font-semibold text-foreground">Renforcer la securite (optionnel)</p>
                <p className="text-xs text-mutedForeground">Telephone + MFA dans Profil &gt; Securite.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedForeground">
            Formulaire complet
          </p>
        </CardHeader>
        <CardContent>
          {error && <ErrorBanner message={error} className="mb-4" />}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={handleChange('email')}
                required
                aria-invalid={Boolean(fieldErrors.email)}
                className={fieldErrors.email ? 'border-destructive' : undefined}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange('password')}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={fieldErrors.password ? 'border-destructive' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mutedForeground"
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              <p className="text-xs text-mutedForeground">Minimum 12 caracteres.</p>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm}
                onChange={handleChange('confirm')}
                required
                aria-invalid={Boolean(fieldErrors.confirm)}
                className={fieldErrors.confirm ? 'border-destructive' : undefined}
              />
              {fieldErrors.confirm && <p className="text-xs text-destructive">{fieldErrors.confirm}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prenom</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  required
                  aria-invalid={Boolean(fieldErrors.first)}
                  className={fieldErrors.first ? 'border-destructive' : undefined}
                />
                {fieldErrors.first && <p className="text-xs text-destructive">{fieldErrors.first}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                  required
                  aria-invalid={Boolean(fieldErrors.last)}
                  className={fieldErrors.last ? 'border-destructive' : undefined}
                />
                {fieldErrors.last && <p className="text-xs text-destructive">{fieldErrors.last}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Pseudo / username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={handleChange('username')}
                required
                aria-invalid={Boolean(fieldErrors.username)}
                className={fieldErrors.username ? 'border-destructive' : undefined}
              />
              <p className="text-xs text-mutedForeground">3-30 caracteres, lettres/chiffres/._-</p>
              {fieldErrors.username && (
                <p className="text-xs text-destructive">{fieldErrors.username}</p>
              )}
            </div>

            <CountrySelect
              id="nationality"
              label="Nationalite"
              value={form.nationality}
              onChange={(value) => setForm((prev) => ({ ...prev, nationality: value }))}
              required
              error={fieldErrors.nationality}
              helperText="Selection obligatoire"
            />

            <label className="flex items-start gap-3 text-sm text-mutedForeground">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <span>
                J'accepte les{' '}
                <Link to="/terms" className="text-primary">
                  Conditions d'utilisation
                </Link>{' '}
                et la{' '}
                <Link to="/privacy" className="text-primary">
                  Politique de confidentialite
                </Link>
                .
              </span>
            </label>

            {captchaRequired && !captchaEnabled && (
              <ErrorBanner
                message="Captcha requis mais non configure. Activez VITE_CAPTCHA_ENABLED et le provider."
              />
            )}

            {captchaRequired && captchaEnabled && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-mutedForeground">
                <p>Captcha requis (placeholder).</p>
                <Input
                  id="captchaToken"
                  value={captchaToken}
                  onChange={(event) => setCaptchaToken(event.target.value)}
                  placeholder="Token captcha"
                />
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading || !csrfToken || !formValid} className="w-full">
              {loading ? 'Creation...' : 'Creer le compte'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Register;
