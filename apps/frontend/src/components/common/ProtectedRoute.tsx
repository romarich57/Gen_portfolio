import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import Loading from '@/components/common/Loading';
import { useAuth } from '@/app/providers/AuthBootstrap';

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

  if (!user.onboarding_completed_at && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
