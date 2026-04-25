import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { importResumeWithAi } from '@/api/ai';
import { createResume } from '@/api/resumes';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

function ResumeBuilder() {
  const { t, i18n } = useTranslation('cv');
  const [text, setText] = useState('');
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async () => {
      const ai = text.trim()
        ? await importResumeWithAi({ text, locale: i18n.language.startsWith('en') ? 'en' : 'fr' })
        : null;
      return createResume({
        title: 'Nouveau CV',
        locale: i18n.language.startsWith('en') ? 'en' : 'fr',
        data: ai?.resume
      });
    },
    onSuccess: (result) => navigate(`/editor/${result.resume.id}`)
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fadeUp">
      <div>
        <h1 className="text-3xl font-display font-black uppercase tracking-tight">{t('dashboard.create')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Collez un CV existant ou démarrez avec un document vierge.</p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <textarea
            className="min-h-64 w-full rounded border border-border bg-background p-4 text-sm outline-none focus:border-primary"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Expériences, formations, compétences..."
          />
          <Button className="rounded-none font-mono text-xs font-black uppercase tracking-widest" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Génération...' : t('dashboard.create')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResumeBuilder;
