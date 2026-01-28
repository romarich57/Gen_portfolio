import React from 'react';

import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Dashboard placeholder page.
 * Preconditions: user authenticated.
 * Postconditions: renders user greeting.
 */
function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
      <p className="text-sm text-mutedForeground">
        Bienvenue, {user?.email ?? 'utilisateur'}. Votre espace est pret.
      </p>
    </div>
  );
}

export default Dashboard;
