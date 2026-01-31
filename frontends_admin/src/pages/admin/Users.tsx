import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getUsers } from '@/api/admin';
import PageHeader from '@/components/admin/PageHeader';
import UsersTable, { UsersFiltersForm, type UsersFilters } from '@/components/admin/UsersTable';
import Button from '@/components/ui/Button';

const DEFAULT_FILTERS: UsersFilters = {
  q: '',
  role: '',
  status: '',
  created_from: '',
  created_to: ''
};

function Users() {
  const [filters, setFilters] = useState<UsersFilters>(DEFAULT_FILTERS);

  const usersQuery = useInfiniteQuery({
    queryKey: ['admin-users', filters],
    queryFn: ({ pageParam }) =>
      getUsers({
        ...filters,
        limit: 25,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const items = useMemo(() => usersQuery.data?.pages.flatMap((page) => page.items) ?? [], [usersQuery.data]);

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Recherchez, filtrez et ouvrez les profils utilisateurs."
      />
      <UsersFiltersForm value={filters} onChange={setFilters} />

      {usersQuery.isError ? (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les utilisateurs.
        </div>
      ) : null}

      <UsersTable items={items} loading={usersQuery.isLoading} />

      <div className="mt-4 flex justify-center">
        {usersQuery.hasNextPage ? (
          <Button variant="outline" onClick={() => usersQuery.fetchNextPage()} disabled={usersQuery.isFetchingNextPage}>
            {usersQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
          </Button>
        ) : (
          <span className="text-xs text-mutedForeground">Fin de la liste</span>
        )}
      </div>
    </div>
  );
}

export default Users;
