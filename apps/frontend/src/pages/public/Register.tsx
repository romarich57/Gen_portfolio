import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { Card, CardContent } from '@/components/ui/Card';
import CountrySelect from '@/components/common/CountrySelect';
import { register, resendEmailVerification, startOAuth } from '@/api/auth';
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
      } else if (apiError.code === 'USERNAME_TAKEN' || apiError.code === 'USERNAME_UNAVAILABLE') {
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
      <div className="mx-auto max-w-3xl space-y-6 animate-fadeUp">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-black tracking-tighter uppercase text-foreground">Activation Requise</h1>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
            Nous avons envoyé un lien système à <strong>{maskEmail(form.email.trim())}</strong>.
          </p>
        </div>

        <Card className="border-border/60 bg-card/90 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)]">
          <CardContent className="space-y-5 p-6">
            {emailSendFailed && (
              <ErrorBanner message="L'envoi de l'email a echoue. Verifiez la configuration SMTP ou reessayez." />
            )}
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-mutedForeground">
              <p>Conseils rapides :</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                <li>Verifiez vos spams et promotions.</li>
                <li>Ajoutez notre domaine aux contacts de confiance.</li>
                <li>Le lien expire automatiquement dans 1h.</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/login')} size="lg">
                Retour login
              </Button>
              <Button variant="outline" onClick={handleResend}>
                Renvoyer l'email
              </Button>
              {resendStatus && <p className="text-xs text-mutedForeground">{resendStatus}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card className="tech-panel animate-fadeUp border-foreground/10 shadow-2xl shadow-primary/5 p-2">
        <CardContent className="pt-6">
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
              error={fieldErrors.nationality || null}
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

            <Button
              type="submit"
              size="lg"
              disabled={loading || !csrfToken || !formValid}
              className="w-full rounded-none font-mono text-sm font-black tracking-[0.2em] uppercase h-14 bg-primary text-background hover:bg-primary/95 accent-glow transition-all"
            >
              {loading ? 'INITIALISATION...' : 'LANCER MON BRIEF'}
            </Button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-50">Ou via</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-3 rounded-none border-foreground/20 hover:border-primary/40 hover:bg-primary/5 font-mono text-[10px] font-black tracking-widest uppercase text-foreground h-12"
                onClick={() => startOAuth('google')}
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-3 rounded-none border-foreground/20 hover:border-primary/40 hover:bg-primary/5 font-mono text-[10px] font-black tracking-widest uppercase text-foreground h-12"
                onClick={() => startOAuth('github')}
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                GitHub
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Register;
