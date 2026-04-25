import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { polishResumeText } from '@/api/ai';
import { getResume, requestResumeExport, updateResume, type ResumeData } from '@/api/resumes';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Loading from '@/components/common/Loading';

function ResumeEditor() {
  const { t } = useTranslation('cv');
  const { resumeId } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => getResume(resumeId!),
    enabled: Boolean(resumeId)
  });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!data?.resume) return;
    setTitle(data.resume.title);
    setContent(JSON.stringify(data.resume.data, null, 2));
  }, [data?.resume]);

  const parsedData = useMemo<ResumeData>(() => {
    try {
      return JSON.parse(content) as ResumeData;
    } catch {
      return {};
    }
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: () => updateResume(resumeId!, { expected_version: data!.resume.version, title, data: parsedData }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume', resumeId] })
  });

  const polishMutation = useMutation({
    mutationFn: () => polishResumeText({ content, section: 'resume' }),
    onSuccess: (result) => setContent(result.content)
  });

  const exportMutation = useMutation({
    mutationFn: (format: 'json' | 'markdown') => requestResumeExport(resumeId!, format)
  });

  if (isLoading) return <Loading />;
  if (!data?.resume) return <p>CV introuvable.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] animate-fadeUp">
      <div className="space-y-4">
        <input
          className="w-full bg-transparent text-3xl font-display font-black uppercase tracking-tight outline-none"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="min-h-[640px] w-full rounded border border-border bg-background p-4 font-mono text-xs outline-none focus:border-primary"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-mono text-xs font-black uppercase tracking-widest">{t('editor.title')}</h2>
          <Button className="w-full rounded-none" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {t('editor.save')}
          </Button>
          <Button variant="outline" className="w-full rounded-none" onClick={() => polishMutation.mutate()} disabled={polishMutation.isPending}>
            {t('editor.aiPolish')}
          </Button>
          <Button variant="outline" className="w-full rounded-none" onClick={() => exportMutation.mutate('json')}>
            {t('editor.exportJson')}
          </Button>
          <Button variant="outline" className="w-full rounded-none" onClick={() => exportMutation.mutate('markdown')}>
            {t('editor.exportMarkdown')}
          </Button>
          {saveMutation.isSuccess && <p className="text-xs text-emerald-400">Sauvegardé.</p>}
          {exportMutation.data && <p className="text-xs text-muted-foreground">Export {exportMutation.data.export.status}.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResumeEditor;
