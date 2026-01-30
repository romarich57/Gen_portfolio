import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';

/**
 * Work In Progress page.
 */
function WIP() {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-12 text-center animate-fadeUp">
            <div className="space-y-4">
                <h1 className="text-5xl font-display font-black tracking-tighter uppercase sm:text-7xl lg:text-9xl text-foreground">
                    EN COURS <br />
                    <span className="text-primary italic">D'IMPLÉMENTATION</span>
                </h1>
                <p className="mx-auto max-w-xl text-lg font-mono uppercase tracking-[0.4em] text-muted-foreground opacity-60">
                    Système en cours de déploiement. Revenez bientôt.
                </p>
            </div>

            <Button
                size="lg"
                className="rounded-none bg-primary px-12 h-16 font-mono text-sm font-black tracking-[0.3em] text-background hover:bg-primary/90 accent-glow"
                onClick={() => navigate('/')}
            >
                RETOUR_SYSTEME
            </Button>

            {/* Background decoration */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-primary/5 rounded-full blur-[100px]" />
            </div>
        </div>
    );
}

export default WIP;
