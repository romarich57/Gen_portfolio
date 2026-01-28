import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import { getMe, getOnboardingStatus, patchOnboarding, patchMe } from '@/api/me';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * Profile page with onboarding block.
 * Preconditions: authenticated session.
 * Postconditions: allows onboarding completion and profile updates.
 */
function Profile() {
  const { user, refreshUser, csrfToken } = useAuth();
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const { data: profile, isLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await getMe();
      return response.profile;
    },
    initialData: user ?? undefined
  });

  const { data: onboardingStatus, refetch: refetchOnboarding } = useQuery({
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
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'USERNAME_TAKEN') {
        setProfileError('Ce nom d\'utilisateur est deja pris.');
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
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'USERNAME_TAKEN') {
        setOnboardingError('Ce nom d\'utilisateur est deja pris.');
      } else {
        setOnboardingError('Onboarding impossible.');
      }
    } finally {
      setOnboardingLoading(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="p-4">
        <Loading />
      </div>
    );
  }

  const isOnboardingRequired = !profile.onboarding_completed_at;

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
              />
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
              />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-nationality">Nationalite (ISO2)</Label>
              <Input
                id="onb-nationality"
                value={onboardingForm.nationality}
                onChange={(event) =>
                  setOnboardingForm({ ...onboardingForm, nationality: event.target.value })
                }
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={onboardingLoading || !csrfToken}>
                {onboardingLoading ? 'Enregistrement...' : 'Valider l\'onboarding'}
              </Button>
            </div>
          </form>
          {onboardingStatus?.missing_fields?.length ? (
            <p className="mt-3 text-xs text-mutedForeground">
              Champs manquants: {onboardingStatus.missing_fields.join(', ')}
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card/90 p-6">
        <h2 className="text-xl font-display font-semibold">Informations</h2>
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Nom</Label>
            <Input
              id="last"
              value={profileForm.last_name}
              onChange={(event) =>
                setProfileForm({ ...profileForm, last_name: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Nom d'utilisateur</Label>
            <Input
              id="username"
              value={profileForm.username}
              onChange={(event) =>
                setProfileForm({ ...profileForm, username: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationalite (ISO2)</Label>
            <Input
              id="nationality"
              value={profileForm.nationality}
              onChange={(event) =>
                setProfileForm({ ...profileForm, nationality: event.target.value })
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="locale">Locale</Label>
            <Input
              id="locale"
              value={profileForm.locale}
              onChange={(event) => setProfileForm({ ...profileForm, locale: event.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={profileLoading || !csrfToken}>
              {profileLoading ? 'Mise a jour...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default Profile;
