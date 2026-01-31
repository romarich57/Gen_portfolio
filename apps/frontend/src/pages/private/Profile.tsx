import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import {
  getMe,
  getOnboardingStatus,
  patchOnboarding,
  patchMe,
  requestAvatarUploadUrl,
  confirmAvatarUpload,
  changePassword,
  changeEmail,
  getSessions,
  revokeSessionById,
  revokeAllSessions,
  regenerateBackupCodes,
  updateSecurityAlerts,
  requestRecoveryEmail,
  removeRecoveryEmail,
  requestAccountDeletion
} from '@/api/me';
import { getBillingStatus, createCheckoutSession, createPortalSession } from '@/api/billing';
import { unlinkOAuth, setPassword as apiSetPassword, startOAuth } from '@/api/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
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
  ),
  Database: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5V19A9 3 0 0 0 21 19V5M3 5A9 3 0 0 0 21 5M3 5A9 3 0 0 1 21 5M3 12A9 3 0 0 0 21 12" /><path d="M3 12A9 3 0 0 0 21 12" /></svg>
  ),
  Bell: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  ),
  Google: () => (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  ),
  GitHub: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  Upload: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
  ),
  Key: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
  ),
  Mail: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
  ),
  Monitor: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
  )
};

type Tab = 'INFO' | 'CONNECTIONS' | 'SECURITY' | 'DATA' | 'NOTIFICATIONS' | 'PLAN' | 'HISTORY';

function Profile() {
  const { user, refreshUser, logout } = useAuth();
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // OAuth disconnect state
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  // Password / Email change state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);

  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [ceNewEmail, setCeNewEmail] = useState('');
  const [cePassword, setCePassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [backupCodesLoading, setBackupCodesLoading] = useState(false);
  const [backupCodesError, setBackupCodesError] = useState<string | null>(null);

  const [alertsEmailEnabled, setAlertsEmailEnabled] = useState(false);
  const [alertsSmsEnabled, setAlertsSmsEnabled] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmailPassword, setRecoveryEmailPassword] = useState('');
  const [recoveryEmailLoading, setRecoveryEmailLoading] = useState(false);
  const [recoveryEmailError, setRecoveryEmailError] = useState<string | null>(null);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState<boolean | null>(null);
  const [recoveryEmailRemoving, setRecoveryEmailRemoving] = useState(false);

  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  // Queries
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await getMe();
      return response.profile;
    },
    initialData: user ?? undefined
  });

  // Derived state for OAuth checks
  const hasPassword = profile?.has_password ?? (profile?.connected_accounts?.length === 0);
  const connectedAccountsCount = profile?.connected_accounts?.length ?? 0;

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

  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => getSessions(),
    enabled: activeTab === 'SECURITY'
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
    setAlertsEmailEnabled(Boolean(profile.security_alert_email_enabled));
    setAlertsSmsEnabled(Boolean(profile.security_alert_sms_enabled));
    setRecoveryEmail(profile.recovery_email_pending ?? profile.recovery_email ?? '');
  }, [profile]);

  // Handlers
  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setProfileFieldErrors({});
    setProfileLoading(true);
    try {
      const payload: {
        first_name?: string;
        last_name?: string;
        username?: string;
        nationality?: string;
        locale?: string;
      } = {};
      if (profileForm.first_name) payload.first_name = profileForm.first_name;
      if (profileForm.last_name) payload.last_name = profileForm.last_name;
      if (profileForm.username) payload.username = profileForm.username;
      if (profileForm.nationality) payload.nationality = profileForm.nationality;
      if (profileForm.locale) payload.locale = profileForm.locale;
      await patchMe(payload);
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

  const handleOnboardingSubmit = async (event: FormEvent) => {
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

  const handleBackupCodesRegenerate = async () => {
    setBackupCodesError(null);
    setBackupCodesLoading(true);
    try {
      const result = await regenerateBackupCodes();
      setBackupCodes(result.backup_codes);
      setShowBackupCodesModal(true);
      await refetchProfile();
      showToast('Codes de secours générés.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'MFA_STEP_UP_REQUIRED') {
        setBackupCodesError('Validez votre MFA pour générer de nouveaux codes.');
      } else if (apiError.code === 'MFA_NOT_CONFIGURED') {
        setBackupCodesError('Activez la MFA avant de générer des codes.');
      } else {
        setBackupCodesError('Impossible de générer les codes.');
      }
    } finally {
      setBackupCodesLoading(false);
    }
  };

  const handleAlertsUpdate = async (nextEmail: boolean, nextSms: boolean) => {
    if (!profile) return;
    setAlertsError(null);
    setAlertsSaving(true);
    const prevEmail = alertsEmailEnabled;
    const prevSms = alertsSmsEnabled;
    setAlertsEmailEnabled(nextEmail);
    setAlertsSmsEnabled(nextSms);
    try {
      await updateSecurityAlerts({ email_enabled: nextEmail, sms_enabled: nextSms });
      await refetchProfile();
      showToast('Préférences de sécurité mises à jour.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      setAlertsEmailEnabled(prevEmail);
      setAlertsSmsEnabled(prevSms);
      if (apiError.code === 'PHONE_NOT_VERIFIED') {
        setAlertsError('Vérifiez votre numéro de téléphone pour activer les alertes SMS.');
      } else if (apiError.code === 'SMS_NOT_AVAILABLE') {
        setAlertsError('Les alertes SMS ne sont pas configurées.');
      } else {
        setAlertsError('Impossible de mettre à jour les alertes.');
      }
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleRecoveryEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRecoveryEmailError(null);
    setRecoveryEmailSent(null);
    setRecoveryEmailLoading(true);
    try {
      const result = await requestRecoveryEmail({
        email: recoveryEmail,
        ...(recoveryEmailPassword ? { password: recoveryEmailPassword } : {})
      });
      const emailSent = result.email_sent !== false;
      setRecoveryEmailSent(emailSent);
      await refetchProfile();
      setRecoveryEmailPassword('');
      if (emailSent) {
        showToast('Email de récupération envoyé.', 'success');
      } else {
        setRecoveryEmailError('Impossible d’envoyer l’email pour le moment.');
        showToast('Envoi email indisponible.', 'error');
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'PASSWORD_REQUIRED') {
        setRecoveryEmailError('Mot de passe requis.');
      } else if (apiError.code === 'INVALID_PASSWORD') {
        setRecoveryEmailError('Mot de passe incorrect.');
      } else if (apiError.code === 'MFA_STEP_UP_REQUIRED') {
        setRecoveryEmailError('Validation MFA requise.');
      } else {
        setRecoveryEmailError('Impossible de mettre à jour l’email de récupération.');
      }
    } finally {
      setRecoveryEmailLoading(false);
    }
  };

  const handleRecoveryEmailRemove = async () => {
    setRecoveryEmailError(null);
    setRecoveryEmailRemoving(true);
    try {
      await removeRecoveryEmail(recoveryEmailPassword ? { password: recoveryEmailPassword } : {});
      setRecoveryEmailSent(null);
      setRecoveryEmailPassword('');
      setRecoveryEmail('');
      await refetchProfile();
      showToast('Email de récupération supprimé.', 'success');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'PASSWORD_REQUIRED') {
        setRecoveryEmailError('Mot de passe requis.');
      } else if (apiError.code === 'INVALID_PASSWORD') {
        setRecoveryEmailError('Mot de passe incorrect.');
      } else if (apiError.code === 'MFA_STEP_UP_REQUIRED') {
        setRecoveryEmailError('Validation MFA requise.');
      } else {
        setRecoveryEmailError('Impossible de supprimer l’email de récupération.');
      }
    } finally {
      setRecoveryEmailRemoving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeSessionById(sessionId);
      await refetchSessions();
      const wasCurrent = sessionsData?.sessions?.some((s) => s.id === sessionId && s.current);
      if (wasCurrent) {
        await logout();
        navigate('/login');
      } else {
        showToast('Session révoquée.', 'success');
      }
    } catch {
      showToast('Impossible de révoquer la session.', 'error');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokingAllSessions(true);
    try {
      await revokeAllSessions({ includeCurrent: true });
      await logout();
      navigate('/login');
    } catch {
      showToast('Impossible de révoquer les sessions.', 'error');
    } finally {
      setRevokingAllSessions(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeletingAccount(true);
    try {
      await requestAccountDeletion();
      setShowDeleteModal(false);
      await logout();
      navigate('/login');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'MFA_STEP_UP_REQUIRED') {
        setDeleteError('Validation MFA requise avant suppression.');
      } else {
        setDeleteError('Impossible de lancer la suppression.');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleApiError = (err: ApiError, setMsg: (m: string) => void, setFields: (f: any) => void) => {
    if (err.code === 'VALIDATION_ERROR') {
      const mapped: any = {};
      const normalizeFieldMessage = (message?: string) => {
        if (!message) return 'Champ invalide';
        if (message === 'country_invalid') return 'Code pays ISO2 invalide';
        return message;
      };
      err.issues?.forEach(i => mapped[i.field] = normalizeFieldMessage(i.message));
      setFields(mapped);
      setMsg('Veuillez vérifier les champs.');
    } else if (err.code === 'USERNAME_UNAVAILABLE') {
      setMsg('Ce nom d\'utilisateur est déjà pris.');
    } else {
      setMsg('Une erreur est survenue.');
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('fr-FR');
  };

  const isOnboardingRequired = profile && !isProfileComplete(profile);
  const sessions = sessionsData?.sessions ?? [];
  const emailVerified = Boolean(profile?.email_verified_at);
  const phoneVerified = Boolean(profile?.phone_verified_at);
  const recoveryVerified = Boolean(profile?.recovery_email_verified_at);
  const recoveryPending = Boolean(profile?.recovery_email_pending);
  const backupCodesRemaining = profile?.backup_codes_remaining ?? 0;

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
          <SidebarItem
            icon={<Icons.Database />}
            label="Gestion des données"
            active={activeTab === 'DATA'}
            onClick={() => setActiveTab('DATA')}
          />
          <SidebarItem
            icon={<Icons.Bell />}
            label="Notifications"
            active={activeTab === 'NOTIFICATIONS'}
            onClick={() => setActiveTab('NOTIFICATIONS')}
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
                    <form
                      onSubmit={handleOnboardingSubmit}
                      className="grid sm:grid-cols-2 gap-4"
                      aria-label="Onboarding form"
                    >
                      <Field label="Prénom" error={onboardingFieldErrors.first_name} htmlFor="onboarding-first-name">
                        <Input
                          id="onboarding-first-name"
                          value={onboardingForm.first_name}
                          onChange={e => setOnboardingForm({ ...onboardingForm, first_name: e.target.value })}
                          required
                        />
                      </Field>
                      <Field label="Nom" error={onboardingFieldErrors.last_name} htmlFor="onboarding-last-name">
                        <Input
                          id="onboarding-last-name"
                          value={onboardingForm.last_name}
                          onChange={e => setOnboardingForm({ ...onboardingForm, last_name: e.target.value })}
                          required
                        />
                      </Field>
                      <Field label="Nom d'utilisateur" error={onboardingFieldErrors.username} htmlFor="onboarding-username">
                        <Input
                          id="onboarding-username"
                          value={onboardingForm.username}
                          onChange={e => setOnboardingForm({ ...onboardingForm, username: e.target.value })}
                          required
                        />
                      </Field>
                      <div className="space-y-2">
                        <CountrySelect
                          id="onboarding-nationality"
                          label="Nationalité"
                          value={onboardingForm.nationality}
                          onChange={v => setOnboardingForm({ ...onboardingForm, nationality: v })}
                          error={onboardingFieldErrors.nationality ?? null}
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

              {/* Avatar Upload Card */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Photo de Profil</h2>
                  <p className="text-sm text-muted-foreground">Personnalisez votre avatar. Formats acceptés : PNG, JPG, WebP (max 2 Mo).</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    {/* Avatar Preview */}
                    <div className="relative group">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="size-24 border border-border/50 object-cover"
                        />
                      ) : (
                        <div className="size-24 flex items-center justify-center bg-primary/10 border border-primary/30 font-mono text-xl font-black text-primary uppercase">
                          {profile?.first_name && profile?.last_name
                            ? `${profile.first_name[0]}${profile.last_name[0]}`
                            : profile?.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Changer l'avatar"
                      >
                        <Icons.Upload />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        aria-label="Sélectionner un avatar"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('Fichier trop volumineux (max 2 Mo)', 'error');
                            return;
                          }
                          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                            showToast('Format non supporté', 'error');
                            return;
                          }
                          setAvatarUploading(true);
                          try {
                            const { upload_url, file_id } = await requestAvatarUploadUrl({
                              content_type: file.type,
                              file_size: file.size
                            });
                            await fetch(upload_url, {
                              method: 'PUT',
                              body: file,
                              headers: { 'Content-Type': file.type }
                            });
                            await confirmAvatarUpload({ file_id });
                            await refetchProfile();
                            await refreshUser();
                            showToast('Avatar mis à jour', 'success');
                          } catch (err) {
                            const apiError = err as ApiError;
                            showToast(apiError?.message || 'Erreur lors du téléchargement', 'error');
                          } finally {
                            setAvatarUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="rounded-none"
                      >
                        {avatarUploading ? 'Téléchargement...' : 'Changer l\'avatar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <h2 className="text-xl font-display font-black uppercase tracking-tight">Informations Personnelles</h2>
                  <p className="text-sm text-muted-foreground">Ces informations sont utilisées pour personnaliser votre expérience.</p>
                </CardHeader>
                <CardContent>
                  {profileError && <ErrorBanner message={profileError} className="mb-4" />}
                  <form onSubmit={handleProfileSubmit} className="grid sm:grid-cols-2 gap-4">
                    <Field label="Prénom" error={profileFieldErrors.first_name} htmlFor="profile-first-name">
                      <Input
                        id="profile-first-name"
                        value={profileForm.first_name}
                        onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                        disabled={isOnboardingRequired ?? false}
                      />
                    </Field>
                    <Field label="Nom" error={profileFieldErrors.last_name} htmlFor="profile-last-name">
                      <Input
                        id="profile-last-name"
                        value={profileForm.last_name}
                        onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                        disabled={isOnboardingRequired ?? false}
                      />
                    </Field>
                    <Field label="Nom d'utilisateur" error={profileFieldErrors.username} htmlFor="profile-username">
                      <Input
                        id="profile-username"
                        value={profileForm.username}
                        onChange={e => setProfileForm({ ...profileForm, username: e.target.value })}
                        disabled={isOnboardingRequired ?? false}
                      />
                    </Field>
                    <div className="space-y-2">
                      <CountrySelect
                        id="profile-nationality"
                        label="Nationalité"
                        value={profileForm.nationality}
                        onChange={v => setProfileForm({ ...profileForm, nationality: v })}
                        error={profileFieldErrors.nationality ?? null}
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
                  connected={Boolean(profile?.connected_accounts?.includes('google'))}
                  icon={<Icons.Google />}
                  disconnecting={disconnectingProvider === 'google'}
                  onDisconnect={async () => {
                    if (connectedAccountsCount === 1 && !hasPassword) {
                      setShowSetPasswordModal(true);
                      return;
                    }
                    setDisconnectingProvider('google');
                    try {
                      await unlinkOAuth('google');
                      await refetchProfile();
                      await refreshUser();
                      showToast('Connexion Google supprimée', 'success');
                    } catch (err) {
                      const e = err as ApiError;
                      if (e.code === 'NEED_PASSWORD_FIRST') {
                        setShowSetPasswordModal(true);
                      } else {
                        showToast(e.message || 'Erreur lors de la déconnexion', 'error');
                      }
                    } finally {
                      setDisconnectingProvider(null);
                    }
                  }}
                  onConnect={() => startOAuth('google')}
                />
                <OAuthProviderItem
                  name="GitHub"
                  connected={Boolean(profile?.connected_accounts?.includes('github'))}
                  icon={<Icons.GitHub />}
                  disconnecting={disconnectingProvider === 'github'}
                  onDisconnect={async () => {
                    if (connectedAccountsCount === 1 && !hasPassword) {
                      setShowSetPasswordModal(true);
                      return;
                    }
                    setDisconnectingProvider('github');
                    try {
                      await unlinkOAuth('github');
                      await refetchProfile();
                      await refreshUser();
                      showToast('Connexion GitHub supprimée', 'success');
                    } catch (err) {
                      const e = err as ApiError;
                      if (e.code === 'NEED_PASSWORD_FIRST') {
                        setShowSetPasswordModal(true);
                      } else {
                        showToast(e.message || 'Erreur lors de la déconnexion', 'error');
                      }
                    } finally {
                      setDisconnectingProvider(null);
                    }
                  }}
                  onConnect={() => startOAuth('github')}
                />
              </div>

              {/* Set Password Modal for OAuth-only users */}
              {showSetPasswordModal && (
                <Card className="mt-6 border-primary/30 bg-primary/5">
                  <CardHeader>
                    <h3 className="text-lg font-display font-black uppercase tracking-tight">Créer un mot de passe</h3>
                    <p className="text-sm text-muted-foreground">Pour déconnecter votre dernier provider OAuth, vous devez d'abord créer un mot de passe.</p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (newPassword !== confirmPassword) {
                        showToast('Les mots de passe ne correspondent pas', 'error');
                        return;
                      }
                      if (newPassword.length < 12) {
                        showToast('Mot de passe trop court (min 12 caractères)', 'error');
                        return;
                      }
                      setSettingPassword(true);
                      try {
                        await apiSetPassword({ password: newPassword, password_confirmation: confirmPassword });
                        showToast('Mot de passe créé avec succès', 'success');
                        setShowSetPasswordModal(false);
                        setNewPassword('');
                        setConfirmPassword('');
                      } catch (err) {
                        const e = err as ApiError;
                        showToast(e.message || 'Erreur lors de la création du mot de passe', 'error');
                      } finally {
                        setSettingPassword(false);
                      }
                    }} className="space-y-4">
                      <Field label="Nouveau mot de passe" htmlFor="set-password-new">
                        <Input
                          id="set-password-new"
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          minLength={12}
                          required
                        />
                      </Field>
                      <Field label="Confirmer le mot de passe" htmlFor="set-password-confirm">
                        <Input
                          id="set-password-confirm"
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          minLength={12}
                          required
                        />
                      </Field>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={settingPassword}>
                          {settingPassword ? 'Création...' : 'Créer le mot de passe'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowSetPasswordModal(false)}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'SECURITY' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Sécurité de l'accès</h2>
                <p className="text-sm text-muted-foreground font-medium">Protégez votre compte avec des couches de sécurité additionnelles.</p>
              </div>

              <Card className="border-border/50 bg-muted/5">
                <CardContent className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Email principal</p>
                    <Badge className={emailVerified ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                      {emailVerified ? 'Vérifié' : 'Non vérifié'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Téléphone</p>
                    <Badge className={phoneVerified ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}>
                      {phoneVerified ? 'Vérifié' : 'Non configuré'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Email récupération</p>
                    <Badge className={recoveryVerified ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : recoveryPending ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}>
                      {recoveryVerified ? 'Vérifié' : recoveryPending ? 'En attente' : 'Non configuré'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground">Codes de secours</p>
                    <Badge className={profile?.mfa_enabled ? 'bg-primary/10 text-primary border-primary/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}>
                      {profile?.mfa_enabled ? `${backupCodesRemaining} restant(s)` : 'MFA désactivée'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

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
                        <Icons.Key />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Codes de secours</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">
                          {profile?.mfa_enabled ? `Restants: ${backupCodesRemaining}` : 'Activez la MFA pour utiliser les codes.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!profile?.mfa_enabled || backupCodesLoading}
                      onClick={handleBackupCodesRegenerate}
                    >
                      {backupCodesLoading ? 'Génération...' : 'Régénérer'}
                    </Button>
                  </CardContent>
                  {backupCodesError && (
                    <div className="px-6 pb-4">
                      <ErrorBanner message={backupCodesError} />
                    </div>
                  )}
                </Card>

                <Card className="group hover:border-primary/30 transition-all border-border/50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-none group-hover:bg-primary/10 transition-colors">
                        <Icons.Key />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Mot de passe</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">
                          {hasPassword ? 'Dernière modification inconnue' : 'Aucun mot de passe défini (OAuth)'}
                        </p>
                      </div>
                    </div>
                    {hasPassword ? (
                      <Button variant="outline" size="sm" onClick={() => setShowChangePasswordModal(true)}>
                        Modifier
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setShowSetPasswordModal(true)}>
                        Définir
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="group hover:border-primary/30 transition-all border-border/50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-none group-hover:bg-primary/10 transition-colors">
                        <Icons.Mail />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Email</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">{profile?.email}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowChangeEmailModal(true)}>
                      Modifier
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
                      {phoneVerified ? 'Modifier' : 'Configurer'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/50">
                <CardContent className="space-y-4 py-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-none">
                        <Icons.Mail />
                      </div>
                      <div>
                        <h3 className="font-bold uppercase tracking-tight">Email de récupération</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 italic">
                          {profile?.recovery_email || profile?.recovery_email_pending || 'Aucun email secondaire'}
                        </p>
                      </div>
                    </div>
                    <Badge className={recoveryVerified ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : recoveryPending ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}>
                      {recoveryVerified ? 'Vérifié' : recoveryPending ? 'En attente' : 'Non configuré'}
                    </Badge>
                  </div>
                  {recoveryEmailError && <ErrorBanner message={recoveryEmailError} />}
                  <form onSubmit={handleRecoveryEmailSubmit} className="grid gap-4 sm:grid-cols-2">
                    <Field label="Email de récupération" htmlFor="recovery-email">
                      <Input
                        id="recovery-email"
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        required
                      />
                    </Field>
                    {hasPassword && (
                      <Field label="Mot de passe actuel" htmlFor="recovery-email-password">
                        <Input
                          id="recovery-email-password"
                          type="password"
                          value={recoveryEmailPassword}
                          onChange={(e) => setRecoveryEmailPassword(e.target.value)}
                        />
                      </Field>
                    )}
                    <div className="sm:col-span-2 flex flex-wrap gap-3">
                      <Button type="submit" disabled={recoveryEmailLoading}>
                        {recoveryEmailLoading ? 'Envoi...' : 'Envoyer le lien'}
                      </Button>
                      {(profile?.recovery_email || profile?.recovery_email_pending) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRecoveryEmailRemove}
                          disabled={recoveryEmailRemoving}
                        >
                          {recoveryEmailRemoving ? 'Suppression...' : 'Supprimer'}
                        </Button>
                      )}
                    </div>
                    {recoveryEmailSent === false && (
                      <p className="text-xs text-amber-600">Envoi impossible pour le moment. Réessayez plus tard.</p>
                    )}
                    {recoveryPending && (
                      <p className="text-xs text-muted-foreground">Un email de validation a été envoyé.</p>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="space-y-4 py-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-none">
                      <Icons.Bell />
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-tight">Alertes de sécurité</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-1 italic">
                        Soyez averti lors d'une nouvelle connexion.
                      </p>
                    </div>
                  </div>
                  {alertsError && <ErrorBanner message={alertsError} />}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Email</p>
                        <p className="text-xs text-muted-foreground">Recommandé pour tous les comptes.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alertsEmailEnabled}
                        disabled={alertsSaving}
                        onClick={() => handleAlertsUpdate(!alertsEmailEnabled, alertsSmsEnabled)}
                        className={`h-6 w-11 rounded-full transition-colors ${alertsEmailEnabled ? 'bg-primary' : 'bg-muted'} ${alertsSaving ? 'opacity-60' : ''}`}
                      >
                        <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${alertsEmailEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">SMS</p>
                        <p className="text-xs text-muted-foreground">
                          Disponible si votre numéro est vérifié.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alertsSmsEnabled}
                        disabled={alertsSaving || !phoneVerified}
                        onClick={() => handleAlertsUpdate(alertsEmailEnabled, !alertsSmsEnabled)}
                        className={`h-6 w-11 rounded-full transition-colors ${alertsSmsEnabled ? 'bg-primary' : 'bg-muted'} ${alertsSaving || !phoneVerified ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${alertsSmsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="space-y-4 py-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-none">
                      <Icons.Monitor />
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-tight">Sessions actives</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-1 italic">Gérez vos appareils connectés.</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => navigate('/sessions')}>
                      Voir l'historique complet
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {sessionsLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
                    {!sessionsLoading && sessions.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucune session active.</p>
                    )}
                    {sessions.map((session) => (
                      <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{session.user_agent || 'Navigateur inconnu'}</p>
                          <p className="text-xs text-muted-foreground">
                            IP: {session.ip || '—'} · {session.location?.label || 'Localisation inconnue'} · Dernière activité: {formatDate(session.last_used_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.current && (
                            <Badge className="border border-border/50 bg-transparent text-foreground">Actuelle</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={revokingSessionId === session.id}
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            {revokingSessionId === session.id ? '...' : session.current ? 'Se déconnecter' : 'Révoquer'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      disabled={revokingAllSessions || sessions.length === 0}
                      onClick={handleRevokeAllSessions}
                    >
                      {revokingAllSessions ? 'Déconnexion...' : 'Déconnecter partout'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'DATA' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Gestion des données</h2>
                <p className="text-sm text-muted-foreground font-medium">Contrôlez vos données personnelles et vos exports.</p>
              </div>
              <Card className="border-border/50">
                <CardContent className="space-y-4 py-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-none">
                      <Icons.Trash />
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-tight">Supprimer mon compte</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-1 italic">
                        Suppression définitive après délai de sécurité.
                      </p>
                    </div>
                  </div>
                  {deleteError && <ErrorBanner message={deleteError} />}
                  <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                    Demander la suppression
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    La suppression requiert une validation MFA récente et annule toutes vos sessions.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-6 animate-fadeUp">
              <div className="px-2">
                <h2 className="text-2xl font-display font-black uppercase tracking-tight">Notifications</h2>
                <p className="text-sm text-muted-foreground font-medium">Gérez vos préférences de communication.</p>
              </div>
              <Card className="border-dashed border-border/50 bg-muted/5">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="p-4 bg-muted rounded-full mb-4 opacity-50">
                    <Icons.Bell />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Section en cours d'implémentation</p>
                </CardContent>
              </Card>
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

      {/* Change Password Modal */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (cpNew !== cpConfirm) {
              showToast('Les mots de passe ne correspondent pas', 'error');
              return;
            }
            setChangingPassword(true);
            try {
              await changePassword({
                currentPassword: cpCurrent,
                newPassword: cpNew,
                confirmPassword: cpConfirm
              });
              showToast('Mot de passe modifié avec succès', 'success');
              setShowChangePasswordModal(false);
              setCpCurrent('');
              setCpNew('');
              setCpConfirm('');
            } catch (err) {
              const e = err as ApiError;
              showToast(e.message || 'Erreur lors de la modification', 'error');
            } finally {
              setChangingPassword(false);
            }
          }} className="space-y-4">
            <Field label="Mot de passe actuel" htmlFor="change-password-current">
              <Input id="change-password-current" type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required />
            </Field>
            <Field label="Nouveau mot de passe" htmlFor="change-password-new">
              <Input id="change-password-new" type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} minLength={12} required />
            </Field>
            <Field label="Confirmer le nouveau mot de passe" htmlFor="change-password-confirm">
              <Input id="change-password-confirm" type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} minLength={12} required />
            </Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowChangePasswordModal(false)}>Annuler</Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? 'Modification...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Email Modal */}
      <Dialog open={showChangeEmailModal} onOpenChange={setShowChangeEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer l'adresse email</DialogTitle>
            <DialogDescription>
              Un lien de vérification sera envoyé à la nouvelle adresse. Vous devrez cliquer dessus pour valider le changement.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setChangingEmail(true);
            try {
              const payload: { newEmail: string; password?: string } = {
                newEmail: ceNewEmail
              };
              if (hasPassword) {
                payload.password = cePassword;
              }
              await changeEmail(payload);
              showToast('Email de vérification envoyé', 'success');
              setShowChangeEmailModal(false);
              setCeNewEmail('');
              setCePassword('');
            } catch (err) {
              const e = err as ApiError;
              showToast(e.message || 'Erreur lors de la demande', 'error');
            } finally {
              setChangingEmail(false);
            }
          }} className="space-y-4">
            <Field label="Nouvel email" htmlFor="change-email-new">
              <Input id="change-email-new" type="email" value={ceNewEmail} onChange={e => setCeNewEmail(e.target.value)} required />
            </Field>
            {hasPassword && (
              <Field label="Mot de passe actuel (pour confirmer)" htmlFor="change-email-password">
                <Input id="change-email-password" type="password" value={cePassword} onChange={e => setCePassword(e.target.value)} required />
              </Field>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowChangeEmailModal(false)}>Annuler</Button>
              <Button type="submit" disabled={changingEmail}>
                {changingEmail ? 'Envoi...' : 'Envoyer le lien'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBackupCodesModal}
        onOpenChange={(open) => {
          setShowBackupCodesModal(open);
          if (!open) setBackupCodes([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vos codes de secours</DialogTitle>
            <DialogDescription>
              Conservez ces codes dans un endroit sûr. Ils ne seront affichés qu'une seule fois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <div key={code} className="rounded-md border border-border/50 bg-muted/60 px-3 py-2 text-center font-mono text-sm">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const payload = backupCodes.join('\n');
                  void navigator.clipboard?.writeText(payload);
                  showToast('Codes copiés.', 'success');
                }}
              >
                Copier
              </Button>
              <Button type="button" onClick={() => setShowBackupCodesModal(false)}>
                J'ai sauvegardé
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer votre compte ?</DialogTitle>
            <DialogDescription>
              Cette action lance une suppression différée (J+7). Toutes vos sessions seront révoquées immédiatement.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <ErrorBanner message={deleteError} />}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" disabled={deletingAccount} onClick={handleDeleteAccount}>
              {deletingAccount ? 'Suppression...' : 'Confirmer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components
function SidebarItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
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

function Field({
  label,
  error,
  children,
  htmlFor
}: {
  label: string,
  error?: string | null | undefined,
  children: ReactNode,
  htmlFor?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="uppercase text-[10px] font-black tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-[10px] font-bold text-destructive flex items-center gap-1 uppercase tracking-tighter"><Icons.AlertCircle /> {error}</p>}
    </div>
  );
}

function OAuthProviderItem({
  name,
  connected,
  icon,
  disconnecting,
  onDisconnect,
  onConnect
}: {
  name: string,
  connected?: boolean,
  icon: ReactNode,
  disconnecting?: boolean,
  onDisconnect?: () => void,
  onConnect?: () => void
}) {
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
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white rounded-none uppercase font-mono text-[9px] font-black tracking-widest"
            onClick={onDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Déconnexion...' : 'Déconnecter'}
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-none uppercase font-mono text-[9px] font-black tracking-widest"
            onClick={onConnect}
          >
            Connecter
          </Button>
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
