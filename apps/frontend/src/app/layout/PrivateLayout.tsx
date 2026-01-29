import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import ThemeToggle from '@/components/common/ThemeToggle';
import Button from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Private layout for authenticated pages.
 * Preconditions: user authenticated.
 * Postconditions: renders nav and outlet.
 */
function PrivateLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const navItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile', label: 'Profil' },
    { to: '/billing', label: 'Billing' },
    ...(isAdmin ? [{ to: '/admin/status', label: 'Statut services' }] : [])
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card/70 px-6 py-4">
        <div className="space-y-1">
          <p className="text-sm text-mutedForeground">Connecte en tant que</p>
          <p className="font-semibold text-foreground">{user?.email ?? 'Utilisateur'}</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Deconnexion
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-6 px-6 py-8 lg:flex-row">
        <nav className="flex flex-wrap gap-2 lg:w-56">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  isActive
                    ? 'bg-primary text-primaryForeground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default PrivateLayout;
