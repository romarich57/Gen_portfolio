import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { router } from './router';
import { refreshCsrfToken } from '@/api/csrf';
import { getAdminMe } from '@/api/admin';
import AccessDenied from '@/pages/AccessDenied';

function App() {
  const [csrfReady, setCsrfReady] = useState(false);
  const [csrfError, setCsrfError] = useState<string | null>(null);

  useEffect(() => {
    refreshCsrfToken()
      .then(() => setCsrfReady(true))
      .catch(() => {
        setCsrfError('Impossible de charger le token CSRF.');
      });
  }, []);

  const adminQuery = useQuery({
    queryKey: ['admin-me'],
    queryFn: getAdminMe,
    retry: false,
    enabled: csrfReady
  });

  if (csrfError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-lg rounded-3xl border border-border bg-card p-10 shadow-xl">
          <h1 className="text-2xl font-semibold">Erreur securite</h1>
          <p className="mt-4 text-mutedForeground">{csrfError}</p>
        </div>
      </div>
    );
  }

  if (!csrfReady || adminQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse rounded-full bg-muted px-6 py-3 text-sm">Chargement...</div>
      </div>
    );
  }

  if (adminQuery.isError) {
    return <AccessDenied />;
  }

  return <RouterProvider router={router(adminQuery.data)} />;
}

export default App;
