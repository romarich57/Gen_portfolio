import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getExports } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

type ExportFilters = {
  userId: string;
  status: string;
  created_from: string;
  created_to: string;
};

function Exports() {
  const [filters, setFilters] = useState<ExportFilters>({
    userId: '',
    status: '',
    created_from: '',
    created_to: ''
  });

  const exportsQuery = useInfiniteQuery({
    queryKey: ['admin-exports', filters],
    queryFn: ({ pageParam }) =>
      getExports({
        ...filters,
        limit: 25,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const items = useMemo(() => exportsQuery.data?.pages.flatMap((page) => page.items) ?? [], [exportsQuery.data]);

  return (
    <div>
      <PageHeader title="Exports RGPD" description="Suivi des exports demandes par les utilisateurs." />

      <Card className="mb-6">
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>User ID</Label>
            <Input
              value={filters.userId}
              onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Input
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            />
          </div>
          <div>
            <Label>Depuis</Label>
            <Input
              type="date"
              value={filters.created_from}
              onChange={(event) => setFilters({ ...filters, created_from: event.target.value })}
            />
          </div>
          <div>
            <Label>Jusqu'au</Label>
            <Input
              type="date"
              value={filters.created_to}
              onChange={(event) => setFilters({ ...filters, created_to: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {exportsQuery.isError ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les exports.
        </div>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-mutedForeground">
                <th className="pb-3">Export</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Demande</th>
                <th className="pb-3">Expiration</th>
              </tr>
            </thead>
            <tbody>
              {items.map((exp) => (
                <tr key={exp.id} className="border-t border-border/60">
                  <td className="py-4 font-semibold">{exp.id.slice(0, 8)}</td>
                  <td className="py-4 text-mutedForeground">{exp.user_id}</td>
                  <td className="py-4">{exp.status}</td>
                  <td className="py-4 text-mutedForeground">{new Date(exp.requested_at).toLocaleString('fr-FR')}</td>
                  <td className="py-4 text-mutedForeground">
                    {exp.expires_at ? new Date(exp.expires_at).toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!exportsQuery.isFetching && items.length === 0 ? (
            <div className="py-6 text-center text-mutedForeground">Aucun export.</div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-center">
        {exportsQuery.hasNextPage ? (
          <Button variant="outline" onClick={() => exportsQuery.fetchNextPage()} disabled={exportsQuery.isFetchingNextPage}>
            {exportsQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
          </Button>
        ) : (
          <span className="text-xs text-mutedForeground">Fin de la liste</span>
        )}
      </div>
    </div>
  );
}

export default Exports;
