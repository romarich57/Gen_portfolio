import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import Loading from '@/components/common/Loading';
import { useAuth } from '@/app/providers/AuthBootstrap';
import { isProfileComplete } from '@/utils/profile';

/**
 * Guarded route wrapper.
 * Preconditions: AuthBootstrap mounted.
 * Postconditions: redirects unauthenticated users to login.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isProfileComplete(user) && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  if (user.mfa_required && !user.mfa_enabled && location.pathname !== '/setup-mfa') {
    return <Navigate to="/setup-mfa" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
