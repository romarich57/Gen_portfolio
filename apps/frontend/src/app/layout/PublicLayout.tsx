import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import ThemeToggle from '@/components/common/ThemeToggle';
import Button from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Public layout for unauthenticated pages.
 * Preconditions: used in public routes.
 * Postconditions: renders header and outlet.
 */
function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isLanding = location.pathname === '/' || location.pathname === '/pricing';

  return (
    <div className="relative min-h-screen">
      {isLanding && <div className="main-glow" />}
      <header className="relative z-10 flex items-center justify-between px-6 py-6">
        <Link to="/" className="text-lg font-display font-semibold">
          SaaS Builder
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Se connecter
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                Commencer
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="relative z-10 px-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}

export default PublicLayout;
