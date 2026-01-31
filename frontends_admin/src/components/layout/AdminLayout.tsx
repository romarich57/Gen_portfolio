import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Users as UsersIcon,
  CreditCard,
  Database,
  FileText,
  Download,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { AdminMe } from '@/api/admin';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { MAIN_APP_URL } from '@/api/config';

const navItems = [
  { label: 'Overview', path: '/overview', icon: BarChart3 },
  { label: 'Utilisateurs', path: '/users', icon: UsersIcon },
  { label: 'Plans & Billing', path: '/plans', icon: CreditCard },
  { label: 'Credits', path: '/credits', icon: Database },
  { label: 'Logs', path: '/logs', icon: FileText },
  { label: 'Exports', path: '/exports', icon: Download },
  { label: 'Settings', path: '/settings', icon: SettingsIcon }
];

type AdminLayoutProps = {
  admin: AdminMe;
};

function AdminLayout({ admin }: AdminLayoutProps) {
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  const crumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '));

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    document.documentElement.classList.toggle('dark', next);
    setDarkMode(next);
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] dark:bg-[#020617] overflow-hidden transition-colors duration-500">
      {/* 3D Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border/40 bg-card/60 backdrop-blur-2xl px-6 py-8 flex flex-col">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-10 px-2"
          >
            <p className="text-[10px] items-center flex gap-2 font-bold uppercase tracking-[0.25em] text-primary/80">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              SaaS Builder
            </p>
            <h1 className="mt-2 text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Admin Hub</h1>
          </motion.div>

          <nav className="flex flex-col gap-1.5 flex-1">
            {navItems.map((item, idx) => (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 preserve-3d h-11',
                      isActive
                        ? 'bg-primary text-primaryForeground shadow-lg shadow-primary/25 translate-z-10'
                        : 'text-mutedForeground hover:bg-muted hover:text-foreground translate-z-0'
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4.5 w-4.5" />
                    {item.label}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </NavLink>
              </motion.div>
            ))}
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-auto rounded-2xl border border-border/40 bg-muted/40 backdrop-blur p-4 text-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-mutedForeground font-medium">Session Admin</span>
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </div>
            <p className="text-sm font-bold text-foreground truncate">{admin.admin.email_masked}</p>
            <div className="mt-2 text-[10px] uppercase tracking-wider text-mutedForeground font-bold">Role: {admin.admin.role}</div>
          </motion.div>
        </aside>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden perspective-1000">
          <header className="flex items-center justify-between border-b border-border/40 bg-card/40 backdrop-blur-xl px-10 py-5">
            <div className="flex items-center gap-4">
              <div className="sm:hidden -ml-2 p-2 rounded-lg hover:bg-muted">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-none capitalize">
                  {crumbs[crumbs.length - 1] || 'Dashboard'}
                </h2>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-mutedForeground uppercase font-bold tracking-widest">
                  Admin <ChevronRight className="h-2 w-2" /> {crumbs.length === 0 ? 'overview' : crumbs.join(' > ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-10 w-10 border border-border/40 bg-card/60"
                onClick={toggleTheme}
              >
                {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-10 gap-2 border-border/40 bg-card/60 hover:bg-primary hover:text-primaryForeground transition-all duration-300"
                onClick={() => window.location.assign(`${MAIN_APP_URL}/profile`)}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline font-bold">App</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-10 py-8 scrollbar-thin">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="preserve-3d"
              >
                <Outlet context={admin} />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
