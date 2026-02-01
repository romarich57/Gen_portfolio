import { useAuth } from '@/app/providers/AuthBootstrap';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

function Dashboard() {
  const { user } = useAuth();
  const roleLabel = user?.roles?.includes('vip')
    ? 'VIP'
    : user?.roles?.includes('premium')
      ? 'PREMIUM'
      : 'USER';

  return (
    <div className="space-y-12 animate-fadeUp">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-black tracking-tighter uppercase text-foreground">
            Espace Projet
          </h1>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest leading-relaxed">
            Bienvenue, {user?.username ?? user?.email ?? 'Architecte'}. Système prêt pour génération.
          </p>
          <p className="text-xs text-emerald-300 font-mono uppercase tracking-widest">
            Vous êtes actuellement {roleLabel}.
          </p>
        </div>

        <Button
          className="rounded-none font-mono text-xs font-bold tracking-widest uppercase px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground accent-glow"
          onClick={() => { }}
        >
          Démarrer un Brief
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <svg className="size-6 text-muted-foreground opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">Aucun projet actif</h3>
              <p className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed">
                Votre pipeline est vide. Lancez un brief pour générer vos premières spécifications.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
