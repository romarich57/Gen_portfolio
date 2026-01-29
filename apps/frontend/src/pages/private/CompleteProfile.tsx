import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import CountrySelect from '@/components/common/CountrySelect';
import { patchOnboarding } from '@/api/me';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';
import { isProfileComplete } from '@/utils/profile';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

type FieldErrors = Partial<Record<'first' | 'last' | 'username' | 'nationality', string>>;

/**
 * CompleteProfile page for OAuth and onboarding completion.
 * Preconditions: authenticated session.
 * Postconditions: profile completed before app access.
 */
function CompleteProfile() {
  const { user, refreshUser, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    username: user?.username ?? '',
    nationality: user?.nationality ?? ''
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validations = useMemo(() => {
    return {
      firstName: form.firstName.trim().length >= 2,
      lastName: form.lastName.trim().length >= 2,
      username: USERNAME_REGEX.test(form.username.trim()),
      nationality: form.nationality.trim().length > 0
    };
  }, [form]);

  const formValid = Object.values(validations).every(Boolean);

  const buildFieldErrors = () => {
    const next: FieldErrors = {};
    if (!validations.firstName) next.first = 'Prenom requis (2 caracteres minimum).';
    if (!validations.lastName) next.last = 'Nom requis (2 caracteres minimum).';
    if (!validations.username) next.username = 'Pseudo invalide (3-30, lettres/chiffres/._-).';
    if (!validations.nationality) next.nationality = 'Nationalite requise.';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const nextErrors = buildFieldErrors();
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      await patchOnboarding({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        username: form.username.trim(),
        nationality: form.nationality.trim().toUpperCase()
      });
      const refreshed = await refreshUser();
      if (!refreshed || !isProfileComplete(refreshed)) {
        setError('Impossible de finaliser le profil.');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'USERNAME_TAKEN') {
        setError('Ce nom d\'utilisateur est deja pris.');
      } else if (apiError.code === 'VALIDATION_ERROR') {
        setFieldErrors(buildFieldErrors());
        setError('Verifiez les champs requis.');
      } else if (
        apiError.code === 'CSRF_TOKEN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_MISSING'
      ) {
        setError('Session CSRF expiree. Rechargez la page.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else if (apiError.code === 'ONBOARDING_REQUIRED') {
        setError('Votre session ne permet pas de finaliser le profil.');
      } else {
        setError('Impossible de finaliser le profil.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Completer votre profil</h1>
        <p className="text-sm text-mutedForeground">
          Renseignez ces informations pour acceder a l'application.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cp-first">Prenom</Label>
            <Input
              id="cp-first"
              value={form.firstName}
              onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              required
              aria-invalid={Boolean(fieldErrors.first)}
              className={fieldErrors.first ? 'border-destructive' : undefined}
            />
            {fieldErrors.first && <p className="text-xs text-destructive">{fieldErrors.first}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-last">Nom</Label>
            <Input
              id="cp-last"
              value={form.lastName}
              onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              required
              aria-invalid={Boolean(fieldErrors.last)}
              className={fieldErrors.last ? 'border-destructive' : undefined}
            />
            {fieldErrors.last && <p className="text-xs text-destructive">{fieldErrors.last}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cp-username">Pseudo / username</Label>
          <Input
            id="cp-username"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            required
            aria-invalid={Boolean(fieldErrors.username)}
            className={fieldErrors.username ? 'border-destructive' : undefined}
          />
          <p className="text-xs text-mutedForeground">3-30 caracteres, lettres/chiffres/._-</p>
          {fieldErrors.username && <p className="text-xs text-destructive">{fieldErrors.username}</p>}
        </div>

        <CountrySelect
          id="cp-nationality"
          label="Nationalite"
          value={form.nationality}
          onChange={(value) => setForm((prev) => ({ ...prev, nationality: value }))}
          required
          error={fieldErrors.nationality}
        />

        <Button type="submit" size="lg" disabled={!csrfToken || loading || !formValid} className="w-full">
          {loading ? 'Validation...' : 'Valider le profil'}
        </Button>
      </form>
    </div>
  );
}

export default CompleteProfile;
