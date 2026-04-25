import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthBootstrap';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

function ResumeLanding() {
  const { t } = useTranslation(['cv', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-16 animate-fadeUp">
      <section className="grid gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-primary">CV Genius</p>
            <h1 className="max-w-4xl text-4xl font-display font-black uppercase tracking-tight text-foreground md:text-6xl">
              {t('presentation.title')}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              {t('presentation.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="h-12 rounded-none px-8 font-mono text-xs font-black uppercase tracking-widest" onClick={() => navigate(user ? '/dashboard' : '/register')}>
              {t('presentation.cta')}
            </Button>
            <Button variant="outline" className="h-12 rounded-none px-8 font-mono text-xs font-black uppercase tracking-widest" onClick={() => navigate('/pricing')}>
              {t('presentation.secondary')}
            </Button>
          </div>
        </div>

        <div className="rounded border border-border bg-muted/30 p-5">
          <div className="aspect-[3/4] bg-background p-8 shadow-2xl">
            <div className="space-y-5">
              <div>
                <div className="h-8 w-2/3 bg-primary/80" />
                <div className="mt-3 h-3 w-1/2 bg-muted" />
              </div>
              {['Expérience', 'Compétences', 'Formation'].map((label) => (
                <div key={label} className="space-y-3">
                  <div className="h-4 w-32 bg-foreground/80" />
                  <div className="h-2 w-full bg-muted" />
                  <div className="h-2 w-5/6 bg-muted" />
                  <div className="h-2 w-3/5 bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {['Profil sécurisé', 'IA côté serveur', 'Édition complète'].map((title) => (
          <Card key={title}>
            <CardContent className="space-y-3 p-6">
              <h2 className="font-mono text-xs font-black uppercase tracking-widest">{title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Authentification, MFA, sauvegarde backend, génération Gemini contrôlée par l’application et contenu toujours modifiable.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default ResumeLanding;
