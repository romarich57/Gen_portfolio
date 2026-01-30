import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ErrorBanner from '@/components/common/ErrorBanner';
import Loading from '@/components/common/Loading';
import CountrySelect from '@/components/common/CountrySelect';
import { getMe, getOnboardingStatus, patchOnboarding, patchMe } from '@/api/me';
import { getBillingStatus, createCheckoutSession, createPortalSession } from '@/api/billing';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';
import { useToast } from '@/components/common/ToastProvider';
import { isProfileComplete } from '@/utils/profile';
import { cn } from '@/lib/utils';

// Inline Icons to avoid dependency issues
const Icons = {
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  Link: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
  ),
  Shield: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  CreditCard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
  ),
  History: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
  ),
  AlertCircle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
  )
};

type Tab = 'INFO' | 'CONNECTIONS' | 'SECURITY' | 'PLAN' | 'HISTORY';

function Profile() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('INFO');

  // Forms states
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

  // Loading & Error states
  const [profileLoading, setProfileLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [billingErrorMsg, setBillingErrorMsg] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string | undefined>>({});
  const [onboardingFieldErrors, setOnboardingFieldErrors] = useState<Record<string, string | undefined>>({});

  // Queries
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await getMe();
      return response.profile;
    },
    initialData: user ?? undefined
  });

  const { refetch: refetchOnboarding } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => getOnboardingStatus(),
    enabled: Boolean(profile)
  });

  const { data: billingStatus } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => getBillingStatus(),
    enabled: activeTab === 'PLAN'
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

  // Handlers
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
      showToast('Profil mis à jour.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      handleApiError(apiError, setProfileError, setProfileFieldErrors);
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
      showToast('Onboarding terminé.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      handleApiError(apiError, setOnboardingError, setOnboardingFieldErrors);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleUpgrade = async (planCode: 'PREMIUM' | 'VIP') => {
    setBillingLoading(true);
    setBillingErrorMsg(null);
    try {
      const { checkout_url } = await createCheckoutSession({ planCode });
      window.location.assign(checkout_url);
    } catch (err) {
      setBillingErrorMsg('Impossible de démarrer le paiement.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handlePortal = async () => {
    setBillingLoading(true);
    setBillingErrorMsg(null);
    try {
      const { portal_url } = await createPortalSession();
      window.location.assign(portal_url);
    } catch (err) {
      setBillingErrorMsg('Impossible d\'ouvrir le portail de gestion.');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleApiError = (err: ApiError, setMsg: (m: string) => void, setFields: (f: any) => void) => {
    if (err.code === 'VALIDATION_ERROR') {
      const mapped: any = {};
      err.issues?.forEach(i => mapped[i.field] = i.message);
      setFields(mapped);
      setMsg('Veuillez vérifier les champs.');
    } else if (err.code === 'USERNAME_UNAVAILABLE') {
      setMsg('Ce nom d\'utilisateur est déjà pris.');
    } else {
      setMsg('Une erreur est survenue.');
    }
  };

  const isOnboardingRequired = profile && !isProfileComplete(profile);

  if (isProfileLoading) return <Loading />;

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <aside className="lg:w-72 flex flex-col gap-2">
          <div className="mb-6 px-4">
            <h1 className="text-3xl font-display font-black tracking-tighter uppercase text-foreground">Paramètres</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">Gérez votre expérience.</p>
          </div>

          <SidebarItem
            icon={<Icons.User />}
            label="Mon Profil"
            active={activeTab === 'INFO'}
            onClick={() => setActiveTab('INFO')}
          />
          <SidebarItem
            icon={<Icons.Link />}
            label="Connexions"
            active={activeTab === 'CONNECTIONS'}
            onClick={() => setActiveTab('CONNECTIONS')}
          />
          <SidebarItem
            icon={<Icons.Shield />}
            label="Sécurité"
            active={activeTab === 'SECURITY'}
            onClick={() => setActiveTab('SECURITY')}
          />
          <div className="h-px bg-border/50 my-4 mx-4" />
          <SidebarItem
            icon={<Icons.CreditCard />}
            label="Plan Actuel"
            active={activeTab === 'PLAN'}
            onClick={() => setActiveTab('PLAN')}
          />
          <SidebarItem
            icon={<Icons.History />}
            label="Historique"
            active={activeTab === 'HISTORY'}
            onClick={() => setActiveTab('HISTORY')}
          />
        </aside>

        {/* Content */}
        <main className="flex-1">
          {activeTab === 'INFO' && (
            <div className="space-y-8 animate-fadeUp">
              {isOnboardingRequired && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <h2 className="text-xl font-display font-black uppercase tracking-tight">Onboarding requis</h2>
                    <p className="text-sm text-muted-foreground font-medium">Complétez ces informations pour débloquer votre accès.</p>
                  </CardHeader>
                  <CardContent>
                    {onboardingError && <ErrorBanner message={onboardingError} className="mb-4" />}
                    <form onSubmit={handleOnboardingSubmit} className="grid sm:grid-cols-2 gap-4">
                      <Field label="Prénom" error={onboardingFieldErrors.first_name}>
                        <Input value={onboardingForm.first_name} onChange={e => setOnboardingForm({ ...onboardingForm, first_name: e.target.value })} required />
                      </Field>
                      <Field label="Nom" error={onboardingFieldErrors.last_name}>
                        <Input value={onboardingForm.last_name} onChange={e => setOnboardingForm({ ...onboardingForm, last_name: e.target.value })} required />
                      </Field>
                      <Field label="Nom d'utilisateur" error={onboardingFieldErrors.username}>
                        <Input value={onboardingForm.username} onChange={e => setOnboardingForm({ ...onboardingForm, username: e.target.value })} required />
                      </Field>
                      <div className="space-y-2">
                        <CountrySelect
                          id="onboarding-nationality"
                          label="Nationalité"
                          value={onboardingForm.nationality}
                          onChange={v => setOnboardingForm({ ...onboardingForm, nationality: v })}
                        />
                      </div>
                      <div className="sm:col-span-2 pt-4">
                        <Button type="submit" className="w-full sm:w-auto" disabled={onboardingLoading}>
                          {onboardingLoading ? 'Finalisation...' : 'Compléter le profil'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Informations Personnelles</h2>
                  <p className="text-sm text-muted-foreground">Ces informations sont utilisées pour personnaliser votre expérience.</p>
                </CardHeader>
                <CardContent>
                  {profileError && <ErrorBanner message={profileError} className="mb-4" />}
                  <form onSubmit={handleProfileSubmit} className="grid sm:grid-cols-2 gap-4">
                    <Field label="Prénom" error={profileFieldErrors.first_name}>
                      <Input value={profileForm.first_name} onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })} disabled={isOnboardingRequired ?? false} />
                    </Field>
                    <Field label="Nom" error={profileFieldErrors.last_name}>
                      <Input value={profileForm.last_name} onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })} disabled={isOnboardingRequired ?? false} />
                    </Field>
                    <Field label="Nom d'utilisateur" error={profileFieldErrors.username}>
                      <Input value={profileForm.username} onChange={e => setProfileForm({ ...profileForm, username: e.target.value })} disabled={isOnboardingRequired ?? false} />
                    </Field>
                    <div className="space-y-2">
                      <CountrySelect
                        id="profile-nationality"
                        label="Nationalité"
                        value={profileForm.nationality}
                        onChange={v => setProfileForm({ ...profileForm, nationality: v })}
                        disabled={isOnboardingRequired ?? false}
                      />
                    </div>
                    <div className="sm:col-span-2 pt-4">
                      <Button type="submit" disabled={profileLoading || (isOnboardingRequired ?? false)} className="w-full sm:w-auto">
                        {profileLoading ? 'Mise à jour...' : 'Sauvegarder les modifications'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'CONNECTIONS' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Mes Connexions</h2>
                <p className="text-sm text-muted-foreground font-medium">Gérez vos comptes tiers liés à votre profil SaaS//Builder.</p>
              </div>

              <div className="grid gap-4">
                <OAuthProviderItem
                  name="Google"
                  connected={profile?.connected_accounts.includes('google')}
                  icon={<div className="size-5 bg-foreground rounded-full" />}
                />
                <OAuthProviderItem
                  name="GitHub"
                  connected={profile?.connected_accounts.includes('github')}
                  icon={<div className="size-5 bg-foreground rounded-sm" />}
                />
              </div>
            </div>
          )}

          {activeTab === 'SECURITY' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Sécurité de l'accès</h2>
                <p className="text-sm text-muted-foreground font-medium">Protégez votre compte avec des couches de sécurité additionnelles.</p>
              </div>

              <div className="grid gap-4">
                <Card className="group hover:border-primary/30 transition-all border-border/50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-none group-hover:bg-primary/10 transition-colors">
                        <Icons.Shield />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Authentification à deux facteurs (MFA)</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">Statut: {profile?.mfa_enabled ? 'Activé' : 'Désactivé'}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/setup-mfa')}>
                      {profile?.mfa_enabled ? 'Modifier' : 'Configurer'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="group hover:border-primary/30 transition-all border-border/50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-none group-hover:bg-primary/10 transition-colors">
                        <Icons.CreditCard />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Numéro de téléphone</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">Pour la récupération et les alertes critiques.</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/verify-phone')}>
                      Configurer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'PLAN' && (
            <div className="space-y-8 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Votre Abonnement</h2>
                <p className="text-sm text-muted-foreground font-medium">Gérez la puissance de votre architecte IA.</p>
                {billingErrorMsg && <ErrorBanner message={billingErrorMsg} className="mt-4" />}
              </div>

              {billingStatus ? (
                <>
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <Badge className="mb-2 rounded-none font-black tracking-widest uppercase text-[9px] bg-primary/20 text-primary border-primary/30">Plan Actuel</Badge>
                        <h3 className="text-3xl font-display font-black uppercase tracking-tighter">{billingStatus.plan_code}</h3>
                      </div>
                      <Button variant="outline" onClick={handlePortal} disabled={billingLoading}>Gérer dans Stripe</Button>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-12">
                        <div className="space-y-1">
                          <p className="text-[10px] font-mono uppercase text-muted-foreground">Projets</p>
                          <p className="font-bold">{billingStatus.entitlements?.projects_used} / {billingStatus.entitlements?.projects_limit || '∞'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-mono uppercase text-muted-foreground">Statut</p>
                          <p className="font-bold text-green-500 uppercase text-xs">{billingStatus.status || 'ACTIVE'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4">
                    {upgradeOptions.map(opt => (
                      <Card key={opt.code} className={cn("border-border/50", billingStatus.plan_code === opt.code && "border-primary/50 bg-primary/5")}>
                        <CardHeader>
                          <h4 className="font-display font-black uppercase tracking-tight text-lg">{opt.title}</h4>
                          <p className="font-mono text-xs text-primary font-bold">{opt.price}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-relaxed">{opt.description}</p>
                        </CardContent>
                        <CardFooter>
                          <Button className="w-full rounded-none h-11 uppercase font-mono text-xs font-black tracking-widest disabled:opacity-50" disabled={billingStatus.plan_code === opt.code || billingLoading} onClick={() => handleUpgrade(opt.code)}>
                            {billingStatus.plan_code === opt.code ? 'Votre Plan' : 'Choisir ce plan'}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </>
              ) : <Loading />}
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Historique de paiements</h2>
                <p className="text-sm text-muted-foreground font-medium">Consultez vos factures et transactions passées.</p>
              </div>

              <div className="border border-border/50 overflow-hidden">
                <table className="w-full text-left text-sm font-mono">
                  <thead>
                    <tr className="bg-muted uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Montant</th>
                      <th className="px-6 py-4">Statut</th>
                      <th className="px-6 py-4">Facture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">15 Janv. 2026</td>
                      <td className="px-6 py-4 font-bold">10.00 EUR</td>
                      <td className="px-6 py-4"><span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 font-bold uppercase">Succès</span></td>
                      <td className="px-6 py-4"><Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-primary">Télécharger</Button></td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">15 Déc. 2025</td>
                      <td className="px-6 py-4 font-bold">10.00 EUR</td>
                      <td className="px-6 py-4"><span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 font-bold uppercase">Succès</span></td>
                      <td className="px-6 py-4"><Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-primary">Télécharger</Button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-center text-xs text-muted-foreground italic font-medium">Toutes vos transactions sont sécurisées par Stripe.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Sub-components
function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm font-black uppercase tracking-[0.1em] font-mono transition-all border-r-2 group",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function Field({ label, error, children }: { label: string, error?: string | null | undefined, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="uppercase text-[10px] font-black tracking-widest text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-[10px] font-bold text-destructive flex items-center gap-1 uppercase tracking-tighter"><Icons.AlertCircle /> {error}</p>}
    </div>
  );
}

function OAuthProviderItem({ name, connected, icon }: { name: string, connected?: boolean, icon: React.ReactNode }) {
  return (
    <Card className="border-border/50 group hover:border-primary/20 transition-all">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <h4 className="font-bold uppercase tracking-tight">{name}</h4>
            <p className="text-xs text-muted-foreground font-mono italic">
              {connected ? 'Connecté' : 'Non connecté'}
            </p>
          </div>
        </div>
        {connected ? (
          <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white rounded-none uppercase font-mono text-[9px] font-black tracking-widest">Déconnecter</Button>
        ) : (
          <Button size="sm" className="rounded-none uppercase font-mono text-[9px] font-black tracking-widest">Connecter</Button>
        )}
      </CardContent>
    </Card>
  );
}

const upgradeOptions = [
  {
    code: 'PREMIUM' as const,
    title: 'Elite',
    price: '10 EUR / mois',
    description: 'Bâtissez jusqu\'à 5 projets avec prompts IA experts.'
  },
  {
    code: 'VIP' as const,
    title: 'VIP',
    price: '30 EUR / mois',
    description: 'Projets illimités + système de crédits pour calculs intensifs.'
  }
];

export default Profile;
