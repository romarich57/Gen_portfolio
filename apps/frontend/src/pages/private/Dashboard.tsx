import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { createResume, listResumes } from '@/api/resumes';
import { useAuth } from '@/app/providers/AuthBootstrap';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Loading from '@/components/common/Loading';

function Dashboard() {
  const { t, i18n } = useTranslation('cv');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['resumes'], queryFn: listResumes });

  const createMutation = useMutation({
    mutationFn: () => createResume({ title: 'Nouveau CV', locale: i18n.language.startsWith('en') ? 'en' : 'fr' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['resumes'] });
      navigate(`/editor/${result.resume.id}`);
    }
  });

  if (isLoading) return <Loading />;

  const resumes = data?.resumes ?? [];

  return (
    <div className="space-y-10 animate-fadeUp">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-black uppercase tracking-tight text-foreground">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('dashboard.subtitle')} Bienvenue, {user?.username ?? user?.email ?? 'utilisateur'}.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="rounded-none font-mono text-xs font-black uppercase tracking-widest" onClick={() => navigate('/builder')}>
            {t('dashboard.import')}
          </Button>
          <Button className="rounded-none font-mono text-xs font-black uppercase tracking-widest" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {t('dashboard.create')}
          </Button>
        </div>
      </div>

      {resumes.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <h2 className="font-mono text-xs font-black uppercase tracking-widest">{t('dashboard.empty')}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">Créez votre premier CV ou importez un texte existant pour lancer la génération IA.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id}>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-display font-black uppercase tracking-tight">{resume.title}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {resume.status} · v{resume.version}
                  </p>
                </div>
                <Button variant="outline" className="w-full rounded-none font-mono text-xs font-black uppercase tracking-widest" onClick={() => navigate(`/editor/${resume.id}`)}>
                  {t('dashboard.open')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
