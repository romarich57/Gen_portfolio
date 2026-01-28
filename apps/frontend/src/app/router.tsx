import React from 'react';
import { createBrowserRouter } from 'react-router-dom';

import PublicLayout from './layout/PublicLayout';
import PrivateLayout from './layout/PrivateLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import LandingPricing from '@/pages/public/LandingPricing';
import Login from '@/pages/public/Login';
import Register from '@/pages/public/Register';
import VerifyEmail from '@/pages/public/VerifyEmail';
import ForgotPassword from '@/pages/public/ForgotPassword';
import ResetPassword from '@/pages/public/ResetPassword';
import OAuthCallback from '@/pages/public/OAuthCallback';
import Dashboard from '@/pages/private/Dashboard';
import Profile from '@/pages/private/Profile';
import Billing from '@/pages/private/Billing';
import PhoneVerify from '@/pages/private/PhoneVerify';
import MfaSetup from '@/pages/private/MfaSetup';
import MfaChallenge from '@/pages/private/MfaChallenge';

/**
 * Application router definition.
 * Preconditions: pages exported.
 * Postconditions: routes mapped to layouts.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPricing /> },
      { path: 'pricing', element: <LandingPricing /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'verify-email', element: <VerifyEmail /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'oauth/callback', element: <OAuthCallback /> },
      { path: 'verify-phone', element: <PhoneVerify /> },
      { path: 'setup-mfa', element: <MfaSetup /> },
      { path: 'mfa-challenge', element: <MfaChallenge /> }
    ]
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <PrivateLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'profile', element: <Profile /> },
      { path: 'billing', element: <Billing /> }
    ]
  },
  {
    path: '*',
    element: (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-display font-semibold">Page introuvable</h1>
      </div>
    )
  }
]);

export default router;
