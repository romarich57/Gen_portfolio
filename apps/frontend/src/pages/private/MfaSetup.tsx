import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import ErrorBanner from '@/components/common/ErrorBanner';
import { startMfaSetup, confirmMfaSetup } from '@/api/auth';
import { useAuth } from '@/app/providers/AuthBootstrap';
import type { ApiError } from '@/api/http';

/**
 * MFA setup page with backup codes.
 * Preconditions: onboarding cookie stage=mfa.
 * Postconditions: MFA enabled and backup codes shown once.
 */
function MfaSetup() {
  const navigate = useNavigate();
  const { refreshUser, csrfToken } = useAuth();
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!csrfToken) return;
    let active = true;
    const run = async () => {
      try {
        const response = await startMfaSetup();
        if (active) {
          setOtpauthUrl(response.otpauthUrl);
        }
      } catch (err) {
        if (!active) return;
        const apiError = err as ApiError;
        if (apiError.code === 'AUTH_REQUIRED') {
          setError('Session expiree. Merci de vous reconnecter.');
          navigate('/login');
        } else {
          setError('Impossible de demarrer la configuration MFA.');
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [csrfToken, navigate]);

  useEffect(() => {
    if (!otpauthUrl) return;
    let active = true;

    const buildQr = async () => {
      try {
        const module = await import('qrcode');
        const url = await module.toDataURL(otpauthUrl, { width: 200, margin: 2 });
        if (active) {
          setQrDataUrl(url);
        }
      } catch {
        if (active) {
          setQrDataUrl(null);
        }
      }
    };

    buildQr();

    return () => {
      active = false;
    };
  }, [otpauthUrl]);

  const handleConfirm = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await confirmMfaSetup({ code });
      setBackupCodes(response.backupCodes);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'AUTH_REQUIRED') {
        setError('Session expiree. Merci de vous reconnecter.');
        navigate('/login');
      } else if (apiError.code === 'MFA_SETUP_REQUIRED') {
        setError('Configuration MFA manquante. Rechargez la page.');
      } else if (apiError.code === 'NETWORK_ERROR') {
        setError('Impossible de contacter le serveur.');
      } else if (
        apiError.code === 'CSRF_TOKEN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_INVALID' ||
        apiError.code === 'CSRF_ORIGIN_MISSING'
      ) {
        setError('Session CSRF expiree. Rechargez la page.');
      } else {
        setError('Code MFA invalide.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!acknowledged) return;
    setError(null);
    try {
      const refreshed = await refreshUser();
      if (!refreshed) {
        setError('Impossible de recuperer la session.');
        return;
      }
      navigate('/dashboard');
    } catch {
      setError('Impossible de recuperer la session.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-semibold">Configurer la MFA</h1>
        <p className="text-sm text-mutedForeground">
          Scannez l'URL otpauth dans votre application d'authentification.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {otpauthUrl && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-xs">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR MFA" className="h-48 w-48 rounded-lg bg-white p-2" />
          ) : (
            <p className="text-mutedForeground">QR indisponible, utilisez l'URL.</p>
          )}
          <div className="break-all text-mutedForeground">{otpauthUrl}</div>
        </div>
      )}

      {backupCodes.length === 0 && (
        <form className="space-y-4" onSubmit={handleConfirm}>
          <div className="space-y-2">
            <Label htmlFor="code">Code MFA</Label>
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
            {loading ? 'Verification...' : 'Activer la MFA'}
          </Button>
        </form>
      )}

      {backupCodes.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Backup codes (a conserver)</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-mutedForeground">
              {backupCodes.map((backup) => (
                <li key={backup} className="rounded-lg border border-border px-2 py-1">
                  {backup}
                </li>
              ))}
            </ul>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            J'ai sauvegarde mes codes
          </label>
          <Button size="lg" disabled={!acknowledged} onClick={handleFinish} className="w-full">
            Terminer
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={() => navigate('/profile')} className="w-full text-xs">
        Retour au profil
      </Button>
    </div>
  );
}

export default MfaSetup;
