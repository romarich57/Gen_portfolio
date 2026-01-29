import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { startPhoneVerify, checkPhoneVerify } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';
import { COUNTRY_CODES, getCountryName, guessCountryFromLocale } from '@/data/countries';

/**
 * Phone verification page.
 * Preconditions: onboarding cookie stage=phone.
 * Postconditions: advances onboarding or activates session.
 */
function PhoneVerify() {
  const navigate = useNavigate();
  const { refreshUser, csrfToken, user } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'start' | 'check'>('start');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState<string>(() => {
    const fallback = guessCountryFromLocale(navigator.language);
    return user?.nationality?.toUpperCase() ?? fallback ?? '';
  });

  const normalizePhone = (value: string) => value.trim().replace(/[\s()-]/g, '');
  const isApiError = (value: unknown): value is ApiError =>
    typeof value === 'object' && value !== null && 'code' in value;

  const countryOptions = useMemo(
    () =>
      COUNTRY_CODES
        .map((code) => ({ code, name: getCountryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    []
  );

  useEffect(() => {
    if (!country && user?.nationality) {
      setCountry(user.nationality.toUpperCase());
    }
  }, [country, user?.nationality]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        setError('Numero invalide.');
        return;
      }
      await startPhoneVerify({ phoneE164: normalized, country: country || undefined });
      setStep('check');
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === 'VALIDATION_ERROR') {
          setError('Numero invalide.');
        } else if (err.code === 'AUTH_REQUIRED') {
          setError('Session expiree. Merci de vous reconnecter.');
          navigate('/login');
        } else if (err.code === 'PHONE_VERIFY_FAILED') {
          setError('Impossible d\'envoyer le code pour le moment.');
        } else if (err.code === 'PHONE_VERIFY_LOCKED') {
          setError('Trop de tentatives. Reessayez plus tard.');
        } else if (
          err.code === 'CSRF_TOKEN_INVALID' ||
          err.code === 'CSRF_ORIGIN_INVALID' ||
          err.code === 'CSRF_ORIGIN_MISSING'
        ) {
          setError('Session CSRF expiree. Rechargez la page.');
        } else if (err.code === 'CAPTCHA_REQUIRED') {
          setError('Verification anti-bot requise. Reessayez plus tard.');
        } else if (err.code === 'NETWORK_ERROR') {
          setError('Impossible de contacter le serveur.');
        } else {
          setError('Impossible d\'envoyer le code.');
        }
      } else {
        setError('Impossible d\'envoyer le code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        setError('Numero invalide.');
        return;
      }
      await checkPhoneVerify({ phoneE164: normalized, code, country: country || undefined });
      try {
        const nextUser = await refreshUser();
        if (nextUser) {
          navigate('/dashboard');
        } else {
          navigate('/login');
        }
      } catch {
        setError('Impossible de finaliser la verification.');
      }
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === 'AUTH_REQUIRED') {
          setError('Session expiree. Merci de vous reconnecter.');
          navigate('/login');
        } else if (err.code === 'PHONE_VERIFY_NOT_STARTED') {
          setError('Veuillez demander un code avant de verifier.');
          setStep('start');
        } else if (err.code === 'PHONE_VERIFY_EXPIRED') {
          setError('Le code a expire. Demandez un nouveau code.');
          setStep('start');
        } else if (err.code === 'PHONE_VERIFY_FAILED') {
          setError('Impossible de verifier le code pour le moment.');
        } else if (err.code === 'PHONE_VERIFY_LOCKED') {
          setError('Trop de tentatives. Reessayez plus tard.');
        } else if (
          err.code === 'CSRF_TOKEN_INVALID' ||
          err.code === 'CSRF_ORIGIN_INVALID' ||
          err.code === 'CSRF_ORIGIN_MISSING'
        ) {
          setError('Session CSRF expiree. Rechargez la page.');
        } else if (err.code === 'NETWORK_ERROR') {
          setError('Impossible de contacter le serveur.');
        } else {
          setError('Code invalide ou expire.');
        }
      } else {
        setError('Code invalide ou expire.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Verifier le telephone</h1>
        <p className="text-sm text-mutedForeground">
          Ajoutez un numero pour securiser votre compte (optionnel).
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {step === 'start' && (
        <form className="space-y-4" onSubmit={handleStart}>
          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <select
              id="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="flex h-11 w-full rounded-lg border border-border bg-card px-4 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Auto (navigateur)</option>
              {countryOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name} ({option.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Numero (E.164)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+33612345678 ou 0612345678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
            {loading ? 'Envoi...' : 'Envoyer le code'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-full text-xs"
          >
            Ignorer pour l'instant
          </Button>
        </form>
      )}

      {step === 'check' && (
        <form className="space-y-4" onSubmit={handleCheck}>
          <div className="space-y-2">
            <Label htmlFor="code">Code recu</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
            {loading ? 'Verification...' : 'Verifier'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-full text-xs"
          >
            Ignorer pour l'instant
          </Button>
        </form>
      )}
    </div>
  );
}

export default PhoneVerify;
