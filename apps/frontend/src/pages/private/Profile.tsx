import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import CountrySelect from '@/components/common/CountrySelect';
import { getMe, getOnboardingStatus, patchOnboarding, patchMe } from '@/api/me';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';
import { fetchCsrfToken } from '@/api/csrf';
import { useToast } from '@/components/common/ToastProvider';
import { isProfileComplete } from '@/utils/profile';

/**
 * Profile page with onboarding block.
 * Preconditions: authenticated session.
 * Postconditions: allows onboarding completion and profile updates.
 */
function Profile() {
  const { user, refreshUser, csrfToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    nationality: '',
    locale: ''
  });
  const [onboardingForm, setOnboardingForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    nationality: ''
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [onboardingFieldErrors, setOnboardingFieldErrors] = useState<Record<string, string>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const {
    data: profile,
    isLoading,
    isError: isProfileError,
    error: profileFetchError,
    refetch: refetchProfile
  } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await getMe();
      return response.profile;
    },
    initialData: user ?? undefined
  });

  const {
    data: onboardingStatus,
    isError: isOnboardingError,
    error: onboardingFetchError,
    refetch: refetchOnboarding
  } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => getOnboardingStatus(),
    enabled: Boolean(profile)
  });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      username: profile.username ?? '',
      nationality: profile.nationality ?? '',
      locale: profile.locale ?? ''
    });
    setOnboardingForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      username: profile.username ?? '',
      nationality: profile.nationality ?? ''
    });
  }, [profile]);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setProfileFieldErrors({});
    setProfileLoading(true);
    try {
      await patchMe({
        first_name: profileForm.first_name || undefined,
        last_name: profileForm.last_name || undefined,
        username: profileForm.username || undefined,
        nationality: profileForm.nationality || undefined,
        locale: profileForm.locale || undefined
      });
      await refetchProfile();
      await refreshUser();
      showToast('Profil mis a jour.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'NETWORK_ERROR') {
        setProfileError('Impossible de contacter le serveur.');
      } else if (apiError.code === 'USERNAME_TAKEN') {
        setProfileError('Ce nom d\'utilisateur est deja pris.');
      } else if (apiError.code === 'ONBOARDING_REQUIRED') {
        setProfileError('Terminez d\'abord l\'onboarding obligatoire.');
      } else if (apiError.code === 'VALIDATION_ERROR') {
        setProfileFieldErrors(mapFieldErrors(apiError));
        setProfileError(buildValidationMessage(apiError.fields));
      } else if (isCsrfError(apiError.code)) {
        await fetchCsrfToken().catch(() => undefined);
        setProfileError('Session CSRF expiree. Rechargez la page et reessayez.');
      } else {
        setProfileError('Mise a jour impossible.');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOnboardingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setOnboardingError(null);
    setOnboardingFieldErrors({});
    setOnboardingLoading(true);
    try {
      await patchOnboarding({
        first_name: onboardingForm.first_name,
        last_name: onboardingForm.last_name,
        username: onboardingForm.username,
        nationality: onboardingForm.nationality.toUpperCase()
      });
      await refetchOnboarding();
      await refetchProfile();
      await refreshUser();
      showToast('Onboarding termine.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'NETWORK_ERROR') {
        setOnboardingError('Impossible de contacter le serveur.');
      } else if (apiError.code === 'USERNAME_TAKEN') {
        setOnboardingError('Ce nom d\'utilisateur est deja pris.');
      } else if (apiError.code === 'VALIDATION_ERROR') {
        setOnboardingFieldErrors(mapFieldErrors(apiError));
        setOnboardingError(buildValidationMessage(apiError.fields));
      } else if (isCsrfError(apiError.code)) {
        await fetchCsrfToken().catch(() => undefined);
        setOnboardingError('Session CSRF expiree. Rechargez la page et reessayez.');
      } else {
        setOnboardingError('Onboarding impossible.');
      }
    } finally {
      setOnboardingLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <Loading />
      </div>
    );
  }

  if (isProfileError || !profile) {
    const apiError = profileFetchError as ApiError | undefined;
    const message =
      apiError?.code === 'NETWORK_ERROR'
        ? 'Impossible de contacter le serveur.'
        : 'Impossible de charger le profil.';
    return (
      <div className="space-y-4 p-4">
        <ErrorBanner message={message} />
        <Button variant="outline" onClick={() => refetchProfile()}>
          Reessayer
        </Button>
      </div>
    );
  }

  const isOnboardingRequired = !isProfileComplete(profile);
  const profileDisabled = isOnboardingRequired;

  function buildValidationMessage(fields?: string[]) {
    if (!fields || fields.length === 0) {
      return 'Verifiez les champs requis.';
    }
    if (fields.includes('nationality')) {
      return 'Nationalite invalide (ISO2, ex: FR).';
    }
    if (fields.includes('username')) {
      return 'Nom d\'utilisateur invalide (3-30 caracteres, lettres/chiffres/_).';
    }
    return 'Verifiez les champs requis.';
  }

  function isCsrfError(code: string) {
    return code === 'CSRF_TOKEN_INVALID' || code === 'CSRF_ORIGIN_INVALID' || code === 'CSRF_ORIGIN_MISSING';
  }

  function mapFieldErrors(error: ApiError) {
    const result: Record<string, string> = {};
    const issues = error.issues ?? [];
    const fallbackFields = error.fields ?? [];

    issues.forEach((issue) => {
      result[issue.field] = translateIssue(issue.field, issue.message);
    });

    fallbackFields.forEach((field) => {
      if (!result[field]) {
        result[field] = translateIssue(field, 'required');
      }
    });

    return result;
  }

  function translateIssue(field: string, message: string) {
    const fieldLabel: Record<string, string> = {
      first_name: 'Prenom',
      last_name: 'Nom',
      username: 'Nom d\'utilisateur',
      nationality: 'Nationalite',
      locale: 'Locale'
    };

    switch (message) {
      case 'required':
        return `${fieldLabel[field] ?? 'Champ'} requis.`;
      case 'username_invalid':
        return '3-30 caracteres, lettres/chiffres/underscore.';
      case 'country_invalid':
        return 'Code pays ISO2 invalide (ex: FR).';
      case 'min':
        return 'Valeur trop courte.';
      case 'max':
        return 'Valeur trop longue.';
      default:
        return 'Valeur invalide.';
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-semibold">Profil</h1>
        <p className="text-sm text-mutedForeground">Gerez vos informations personnelles.</p>
      </div>

      {isOnboardingRequired && (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-6">
          <h2 className="text-xl font-display font-semibold">Onboarding obligatoire</h2>
          <p className="mt-2 text-sm text-mutedForeground">
            Completez votre profil pour debloquer toutes les fonctionnalites.
          </p>
          {onboardingError && <ErrorBanner message={onboardingError} className="mt-4" />}
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleOnboardingSubmit}>
            <div className="space-y-2">
              <Label htmlFor="onb-first">Prenom</Label>
              <Input
                id="onb-first"
                value={onboardingForm.first_name}
                onChange={(event) =>
                  setOnboardingForm({ ...onboardingForm, first_name: event.target.value })
                }
                required
                aria-invalid={Boolean(onboardingFieldErrors.first_name)}
                className={onboardingFieldErrors.first_name ? 'border-destructive' : undefined}
              />
              {onboardingFieldErrors.first_name && (
                <p className="text-xs text-destructive">{onboardingFieldErrors.first_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-last">Nom</Label>
              <Input
                id="onb-last"
                value={onboardingForm.last_name}
                onChange={(event) =>
                  setOnboardingForm({ ...onboardingForm, last_name: event.target.value })
                }
                required
                aria-invalid={Boolean(onboardingFieldErrors.last_name)}
                className={onboardingFieldErrors.last_name ? 'border-destructive' : undefined}
              />
              {onboardingFieldErrors.last_name && (
                <p className="text-xs text-destructive">{onboardingFieldErrors.last_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-username">Nom d'utilisateur</Label>
              <Input
                id="onb-username"
                value={onboardingForm.username}
                onChange={(event) =>
                  setOnboardingForm({ ...onboardingForm, username: event.target.value })
                }
                required
                aria-invalid={Boolean(onboardingFieldErrors.username)}
                className={onboardingFieldErrors.username ? 'border-destructive' : undefined}
              />
              <p className="text-xs text-mutedForeground">
                3-30 caracteres, lettres/chiffres/underscore.
              </p>
              {onboardingFieldErrors.username && (
                <p className="text-xs text-destructive">{onboardingFieldErrors.username}</p>
              )}
            </div>
            <CountrySelect
              id="onb-nationality"
              label="Nationalite (ISO2)"
              value={onboardingForm.nationality}
              onChange={(value) => setOnboardingForm({ ...onboardingForm, nationality: value })}
              required
              error={onboardingFieldErrors.nationality}
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={onboardingLoading || !csrfToken}>
                {onboardingLoading ? 'Enregistrement...' : 'Valider l\'onboarding'}
              </Button>
            </div>
          </form>
          {isOnboardingError && (
            <p className="mt-3 text-xs text-destructive">
              {((onboardingFetchError as ApiError | undefined)?.code === 'NETWORK_ERROR'
                ? 'Impossible de contacter le serveur.'
                : 'Impossible de charger le statut d\'onboarding.')}
            </p>
          )}
          {!isOnboardingError && onboardingStatus?.missing_fields?.length ? (
            <p className="mt-3 text-xs text-mutedForeground">
              Champs manquants: {onboardingStatus.missing_fields.join(', ')}
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card/90 p-6">
        <h2 className="text-xl font-display font-semibold">Informations</h2>
        {profileDisabled && (
          <p className="mt-2 text-sm text-mutedForeground">
            Terminez l\'onboarding pour modifier vos informations.
          </p>
        )}
        {profileError && <ErrorBanner message={profileError} className="mt-4" />}
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
          <div className="space-y-2">
            <Label htmlFor="first">Prenom</Label>
            <Input
              id="first"
              value={profileForm.first_name}
              onChange={(event) =>
                setProfileForm({ ...profileForm, first_name: event.target.value })
              }
              disabled={profileDisabled}
              aria-invalid={Boolean(profileFieldErrors.first_name)}
              className={profileFieldErrors.first_name ? 'border-destructive' : undefined}
            />
            {profileFieldErrors.first_name && (
              <p className="text-xs text-destructive">{profileFieldErrors.first_name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Nom</Label>
            <Input
              id="last"
              value={profileForm.last_name}
              onChange={(event) =>
                setProfileForm({ ...profileForm, last_name: event.target.value })
              }
              disabled={profileDisabled}
              aria-invalid={Boolean(profileFieldErrors.last_name)}
              className={profileFieldErrors.last_name ? 'border-destructive' : undefined}
            />
            {profileFieldErrors.last_name && (
              <p className="text-xs text-destructive">{profileFieldErrors.last_name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Nom d'utilisateur</Label>
            <Input
              id="username"
              value={profileForm.username}
              onChange={(event) =>
                setProfileForm({ ...profileForm, username: event.target.value })
              }
              disabled={profileDisabled}
              aria-invalid={Boolean(profileFieldErrors.username)}
              className={profileFieldErrors.username ? 'border-destructive' : undefined}
            />
            <p className="text-xs text-mutedForeground">
              3-30 caracteres, lettres/chiffres/underscore.
            </p>
            {profileFieldErrors.username && (
              <p className="text-xs text-destructive">{profileFieldErrors.username}</p>
            )}
          </div>
          <CountrySelect
            id="nationality"
            label="Nationalite (ISO2)"
            value={profileForm.nationality}
            onChange={(value) => setProfileForm({ ...profileForm, nationality: value })}
            disabled={profileDisabled}
            error={profileFieldErrors.nationality}
            helperText="Optionnel"
          />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="locale">Locale</Label>
            <Input
              id="locale"
              value={profileForm.locale}
              onChange={(event) => setProfileForm({ ...profileForm, locale: event.target.value })}
              disabled={profileDisabled}
              aria-invalid={Boolean(profileFieldErrors.locale)}
              className={profileFieldErrors.locale ? 'border-destructive' : undefined}
            />
            {profileFieldErrors.locale && (
              <p className="text-xs text-destructive">{profileFieldErrors.locale}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={profileLoading || !csrfToken || profileDisabled}>
              {profileLoading ? 'Mise a jour...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-semibold">Securite</h2>
            <p className="text-sm text-mutedForeground">
              Renforcez la securite de votre compte (optionnel).
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">Telephone</h3>
            <p className="mt-2 text-xs text-mutedForeground">
              Verifiez votre numero pour renforcer la recuperation.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/verify-phone')}
            >
              Ajouter un telephone
            </Button>
          </div>
          <div className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">MFA TOTP</h3>
            <p className="mt-2 text-xs text-mutedForeground">
              Ajoutez une seconde verification via application.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/setup-mfa')}
            >
              Activer la MFA
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Profile;
