import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import ThemeToggle from '@/components/common/ThemeToggle';
import Button from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthBootstrap';

/**
 * Public layout for unauthenticated pages.
 */
function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isLanding = location.pathname === '/' || location.pathname === '/pricing';

  const navLinks = [
    { label: '/FEATURES', to: '/#features' },
    { label: '/PRICING', to: '/pricing' },
    { label: '/DOCS', to: '#' },
    { label: '/API', to: '#' },
  ];

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground selection:bg-primary/30">
      {isLanding && <div className="main-glow" />}

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-md lg:px-12">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center p-1 border border-primary/50 bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <div className="size-4 bg-primary rotate-45" />
          </div>
          <span className="text-xl font-display font-bold tracking-tighter uppercase">
            Project<span className="text-primary font-light tracking-widest">//</span>Builder<span className="text-primary/50 font-light">//</span>AI
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-10 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="group relative font-mono text-xs font-black tracking-[0.3em] text-foreground/70 hover:text-primary transition-all duration-300"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          {user ? (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex font-mono text-[11px] font-black tracking-[0.2em] border-primary text-foreground hover:bg-primary/10"
              onClick={() => navigate('/dashboard')}
            >
              DASHBOARD_GO
            </Button>
          ) : (
            <div className="hidden sm:flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-[11px] font-black tracking-[0.2em] text-foreground hover:text-primary"
                onClick={() => navigate('/login')}
              >
                /LOGIN
              </Button>
              <Button
                size="sm"
                className="font-mono text-[11px] font-black tracking-[0.2em] rounded-none h-10 px-8 bg-primary text-background hover:bg-primary/90 accent-glow"
                onClick={() => navigate('/register')}
              >
                DEPLOY_NOW
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="flex lg:hidden flex-col gap-1.5 p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            <div className={`h-0.5 w-6 bg-foreground transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile Sidebar */}
        <div className={`fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl transition-all duration-500 lg:hidden ${isMobileMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}>
          <div className="flex flex-col h-full p-8">
            <div className="flex items-center justify-between mb-16">
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2">
                <div className="size-4 bg-primary rotate-45" />
                <span className="text-xl font-display font-bold tracking-tighter uppercase">PROJECT_BUILDER</span>
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="font-mono text-xs text-primary font-black uppercase">/CLOSE</button>
            </div>

            <nav className="flex flex-col gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-mono text-2xl font-black tracking-[0.2em] text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-6">
              <div className="flex items-center justify-between border-t border-border pt-6">
                <span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest">Theme Shift</span>
                <ThemeToggle />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="w-full font-mono text-[11px] font-black"
                  onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
                >
                  LOGIN
                </Button>
                <Button
                  className="w-full font-mono text-[11px] font-black bg-primary text-background"
                  onClick={() => { navigate('/register'); setIsMobileMenuOpen(false); }}
                >
                  JOIN_NOW
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-12 lg:px-12 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-border/50 bg-background/50 py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 opacity-80">
            <div className="size-3 bg-primary rotate-45" />
            <span className="font-display font-bold tracking-tighter text-sm uppercase">
              SaaS<span className="text-primary font-light tracking-widest">//</span>Builder
            </span>
          </div>

          <nav className="flex flex-wrap gap-x-10 gap-y-4">
            {['SECURITY', 'LEGAL', 'TERMS', 'STATUS'].map((link) => (
              <a
                key={link}
                href="#"
                className="font-mono text-[11px] font-black tracking-[0.2em] text-foreground hover:text-primary transition-colors"
              >
                {link}
              </a>
            ))}
          </nav>

          <span className="font-mono text-[10px] font-bold tracking-widest text-primary/80">
            © 2026 SYSTEM_ARCHITECT. REL: 2.6.0-PROD
          </span>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
