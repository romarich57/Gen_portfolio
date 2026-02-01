import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { syncCheckoutSession } from '@/api/billing';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Payment success page displayed after Stripe checkout completion.
 * Preconditions: user redirected from Stripe with session_id.
 * Postconditions: displays success message and redirects to dashboard.
 */
function BillingSuccess() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [countdown, setCountdown] = useState(5);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (countdown <= 0) {
            navigate('/dashboard');
            return;
        }

        const timer = setTimeout(() => {
            setCountdown(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown, navigate]);

    useEffect(() => {
        let active = true;
        const sync = async () => {
            if (!sessionId) return;
            try {
                await syncCheckoutSession({ sessionId });
                await refreshUser();
                if (active) {
                    setSyncSuccess(true);
                }
            } catch {
                if (active) {
                    setSyncError('Impossible de synchroniser votre abonnement. Réessayez plus tard.');
                }
            }
        };
        void sync();
        return () => {
            active = false;
        };
    }, [sessionId, refreshUser]);

    return (
        <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
            {/* Header */}
            <div className="text-center">
                <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                    <span className="text-4xl">✓</span>
                </div>
                <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                    ✨ Paiement réussi
                </Badge>
                <h1 className="mt-4 text-3xl font-display font-bold tracking-tight sm:text-4xl">
                    Bienvenue dans votre nouveau plan !
                </h1>
                <p className="mt-3 text-base text-mutedForeground">
                    Votre abonnement a été activé avec succès. Profitez de toutes les fonctionnalités premium.
                </p>
            </div>

            {/* Success Card */}
            <Card className="border-emerald-500/20 bg-card/90 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.25)]">
                <CardContent className="p-8">
                    <div className="space-y-6">
                        {syncError && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {syncError}
                            </div>
                        )}
                        {syncSuccess && (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                Abonnement synchronisé avec succès.
                            </div>
                        )}
                        {/* Confirmation details */}
                        <div className="flex items-start gap-4">
                            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                🎉
                            </span>
                            <div>
                                <p className="text-lg font-semibold">Abonnement activé</p>
                                <p className="mt-1 text-sm text-mutedForeground">
                                    Votre compte a été mis à jour. Vous avez maintenant accès à toutes les fonctionnalités de votre plan.
                                </p>
                            </div>
                        </div>

                        {/* Features unlocked */}
                        <div className="rounded-xl border border-border bg-muted/40 p-5">
                            <p className="text-sm font-medium text-foreground">Fonctionnalités débloquées :</p>
                            <ul className="mt-3 grid gap-2 text-sm text-mutedForeground sm:grid-cols-2">
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span>
                                    Projets illimités
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span>
                                    Crédits mensuels bonus
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span>
                                    Support prioritaire
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span>
                                    Fonctionnalités avancées
                                </li>
                            </ul>
                        </div>

                        {/* Session ID (for debugging/reference) */}
                        {sessionId && (
                            <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-mutedForeground">
                                <span className="font-medium">Référence :</span>{' '}
                                <code className="font-mono">{sessionId.slice(0, 24)}...</code>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                            <Button
                                onClick={() => navigate('/dashboard')}
                                size="lg"
                                className="flex-1 gap-2"
                            >
                                Accéder au dashboard →
                            </Button>
                            <Button
                                onClick={() => navigate('/billing')}
                                variant="outline"
                                size="lg"
                                className="flex-1"
                            >
                                Voir mon abonnement
                            </Button>
                        </div>

                        {/* Auto-redirect notice */}
                        <p className="text-center text-xs text-mutedForeground">
                            Redirection automatique dans{' '}
                            <span className="font-semibold text-foreground">{countdown}</span> seconde{countdown > 1 ? 's' : ''}...
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Help section */}
            <div className="text-center">
                <p className="text-sm text-mutedForeground">
                    Une question ?{' '}
                    <button
                        onClick={() => navigate('/profile')}
                        className="font-medium text-primary hover:underline"
                    >
                        Contactez notre support
                    </button>
                </p>
            </div>
        </div>
    );
}

export default BillingSuccess;
