import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import ThemeToggle from '@/components/common/ThemeToggle';
import LanguageSwitch from '@/components/common/LanguageSwitch';
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


  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background font-body text-foreground">
      <header className="flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-md lg:px-12 sticky top-0 z-50">
        {/* Left: User Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-1 border border-primary/50 bg-primary/10">
            <div className="size-3 bg-primary rotate-45" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground leading-none">Connecté en tant que</p>
            <p className="text-xs font-mono font-black text-foreground mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Center: Dashboard */}
        <nav className="absolute left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-6">
            {[
              { to: '/dashboard', label: 'CV' },
              { to: '/templates', label: 'TEMPLATES' },
              { to: '/billing', label: 'ABONNEMENT' }
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `font-mono text-xs font-black tracking-[0.3em] uppercase transition-all hover:text-primary ${isActive ? 'text-primary' : 'text-foreground/70'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <LanguageSwitch />
          <div className="h-4 w-px bg-border/50 mx-2 hidden sm:block" />

          {/* Avatar / Profile Button */}
          <button
            onClick={() => navigate('/profile')}
            className="group flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Mon profil"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Avatar"
                className="size-9 rounded-none border border-border/50 object-cover"
              />
            ) : (
              <div className="size-9 flex items-center justify-center bg-primary/10 border border-primary/30 font-mono text-xs font-black text-primary uppercase">
                {user?.first_name && user?.last_name
                  ? `${user.first_name[0]}${user.last_name[0]}`
                  : user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </button>

          <Button
            size="sm"
            variant="outline"
            className="rounded-none h-9 px-6 font-mono text-[11px] font-black tracking-[0.2em] border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all"
            onClick={handleLogout}
          >
            DECONNEXION
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 lg:px-12">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-border/50 bg-background/50 py-8 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center opacity-50">
          <div className="flex items-center gap-2">
            <div className="size-3 bg-primary rotate-45" />
            <span className="font-display font-bold tracking-tighter text-xs uppercase">CV//Genius</span>
          </div>
          <span className="font-mono text-[9px] font-black tracking-[0.3em] uppercase">Build by Batox</span>
        </div>
      </footer>
    </div>
  );
}

export default PrivateLayout;
