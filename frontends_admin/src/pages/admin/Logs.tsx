import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAudit } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

type AuditFilters = {
  userId: string;
  action_type: string;
  created_from: string;
  created_to: string;
};

function Logs() {
  const [filters, setFilters] = useState<AuditFilters>({
    userId: '',
    action_type: '',
    created_from: '',
    created_to: ''
  });

  const logsQuery = useInfiniteQuery({
    queryKey: ['admin-audit', filters],
    queryFn: ({ pageParam }) =>
      getAudit({
        ...filters,
        limit: 25,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const items = useMemo(() => logsQuery.data?.pages.flatMap((page) => page.items) ?? [], [logsQuery.data]);

  return (
    <div>
      <PageHeader title="Logs & Audit" description="Journalisation des actions sensibles." />

      <Card className="mb-6">
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={filters.userId}
              onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="action_type">Action</Label>
            <Input
              id="action_type"
              value={filters.action_type}
              onChange={(event) => setFilters({ ...filters, action_type: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="created_from">Depuis</Label>
            <Input
              id="created_from"
              type="date"
              value={filters.created_from}
              onChange={(event) => setFilters({ ...filters, created_from: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="created_to">Jusqu'au</Label>
            <Input
              id="created_to"
              type="date"
              value={filters.created_to}
              onChange={(event) => setFilters({ ...filters, created_to: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {logsQuery.isError ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les logs.
        </div>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-mutedForeground">
                <th className="pb-3">Date</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id} className="border-t border-border/60">
                  <td className="py-4 text-mutedForeground">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                  <td className="py-4 font-semibold">{log.action}</td>
                  <td className="py-4 text-mutedForeground">{log.actor_user_id ?? '—'}</td>
                  <td className="py-4 text-mutedForeground">{log.target_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logsQuery.isFetching && items.length === 0 ? (
            <div className="py-6 text-center text-mutedForeground">Aucun log.</div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-center">
        {logsQuery.hasNextPage ? (
          <Button variant="outline" onClick={() => logsQuery.fetchNextPage()} disabled={logsQuery.isFetchingNextPage}>
            {logsQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
          </Button>
        ) : (
          <span className="text-xs text-mutedForeground">Fin de la liste</span>
        )}
      </div>
    </div>
  );
}

export default Logs;
