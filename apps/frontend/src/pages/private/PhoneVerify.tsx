import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { startPhoneVerify, checkPhoneVerify } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Phone verification page.
 * Preconditions: onboarding cookie stage=phone.
 * Postconditions: advances onboarding or activates session.
 */
function PhoneVerify() {
  const navigate = useNavigate();
  const { refreshUser, csrfToken } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'start' | 'check'>('start');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await startPhoneVerify({ phoneE164: phone });
      setStep('check');
    } catch {
      setError('Impossible d\'envoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await checkPhoneVerify({ phoneE164: phone, code });
      const nextUser = await refreshUser();
      if (nextUser) {
        navigate('/dashboard');
      } else {
        navigate('/setup-mfa');
      }
    } catch {
      setError('Code invalide ou expire.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Verifier le telephone</h1>
        <p className="text-sm text-mutedForeground">
          Entrez votre numero E.164 pour recevoir un code.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {step === 'start' && (
        <form className="space-y-4" onSubmit={handleStart}>
          <div className="space-y-2">
            <Label htmlFor="phone">Numero (E.164)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={loading || !csrfToken} className="w-full">
            {loading ? 'Envoi...' : 'Envoyer le code'}
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
        </form>
      )}
    </div>
  );
}

export default PhoneVerify;
