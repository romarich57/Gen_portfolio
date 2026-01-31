import { createBrowserRouter } from 'react-router-dom';
import type { AdminMe } from '@/api/admin';
import AdminLayout from '@/components/layout/AdminLayout';
import Overview from '@/pages/admin/Overview';
import Users from '@/pages/admin/Users';
import UserDetails from '@/pages/admin/UserDetails';
import Plans from '@/pages/admin/Plans';
import Credits from '@/pages/admin/Credits';
import Logs from '@/pages/admin/Logs';
import Exports from '@/pages/admin/Exports';
import Settings from '@/pages/admin/Settings';

export function router(admin: AdminMe) {
  return createBrowserRouter([
    {
      path: '/',
      element: <AdminLayout admin={admin} />,
      children: [
        { index: true, element: <Overview /> },
        { path: 'overview', element: <Overview /> },
        { path: 'users', element: <Users /> },
        { path: 'users/:id', element: <UserDetails /> },
        { path: 'plans', element: <Plans /> },
        { path: 'credits', element: <Credits /> },
        { path: 'logs', element: <Logs /> },
        { path: 'exports', element: <Exports /> },
        { path: 'settings', element: <Settings /> }
      ]
    }
  ]);
}
