import { createBrowserRouter } from 'react-router-dom';

import PublicLayout from './layout/PublicLayout';
import PrivateLayout from './layout/PrivateLayout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import ResumeLanding from '@/pages/public/ResumeLanding';
import ResumePricing from '@/pages/public/ResumePricing';
import Login from '@/pages/public/Login';
import Register from '@/pages/public/Register';
import VerifyEmail from '@/pages/public/VerifyEmail';
import VerifyRecoveryEmail from '@/pages/public/VerifyRecoveryEmail';
import VerifyEmailChange from '@/pages/public/VerifyEmailChange';
import CancelEmailChange from '@/pages/public/CancelEmailChange';
import VerifyOAuthLink from '@/pages/public/VerifyOAuthLink';
import SecurityRevokeSessions from '@/pages/public/SecurityRevokeSessions';
import SecurityAcknowledgeAlert from '@/pages/public/SecurityAcknowledgeAlert';
import ForgotPassword from '@/pages/public/ForgotPassword';
import ResetPassword from '@/pages/public/ResetPassword';
import OAuthCallback from '@/pages/public/OAuthCallback';
import Terms from '@/pages/public/Terms';
import Privacy from '@/pages/public/Privacy';
import Dashboard from '@/pages/private/Dashboard';
import ResumeBuilder from '@/pages/private/ResumeBuilder';
import ResumeEditor from '@/pages/private/ResumeEditor';
import Templates from '@/pages/private/Templates';
import Profile from '@/pages/private/Profile';
import Sessions from '@/pages/private/Sessions';
import Billing from '@/pages/private/Billing';
import BillingSuccess from '@/pages/private/BillingSuccess';
import PhoneVerify from '@/pages/private/PhoneVerify';
import MfaSetup from '@/pages/private/MfaSetup';
import MfaChallenge from '@/pages/private/MfaChallenge';
import ServiceStatus from '@/pages/private/ServiceStatus';
import CompleteProfile from '@/pages/private/CompleteProfile';
import WIP from '@/pages/public/WIP';

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
      { index: true, element: <ResumeLanding /> },
      { path: 'pricing', element: <ResumePricing /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'verify-email', element: <VerifyEmail /> },
      { path: 'verify-email-change', element: <VerifyEmailChange /> },
      { path: 'auth/verify-email-change', element: <VerifyEmailChange /> },
      { path: 'cancel-email-change', element: <CancelEmailChange /> },
      { path: 'verify-recovery-email', element: <VerifyRecoveryEmail /> },
      { path: 'verify-oauth-link', element: <VerifyOAuthLink /> },
      { path: 'security/revoke-sessions', element: <SecurityRevokeSessions /> },
      { path: 'security/acknowledge-alert', element: <SecurityAcknowledgeAlert /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'oauth/callback', element: <OAuthCallback /> },
      { path: 'setup-mfa', element: <MfaSetup /> },
      { path: 'terms', element: <Terms /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'mfa-challenge', element: <MfaChallenge /> },
      { path: 'wip', element: <WIP /> }
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
      { path: 'builder', element: <ResumeBuilder /> },
      { path: 'generation', element: <ResumeBuilder /> },
      { path: 'editor/:resumeId', element: <ResumeEditor /> },
      { path: 'templates', element: <Templates /> },
      { path: 'complete-profile', element: <CompleteProfile /> },
      { path: 'profile', element: <Profile /> },
      { path: 'sessions', element: <Sessions /> },
      { path: 'verify-phone', element: <PhoneVerify /> },
      { path: 'billing', element: <Billing /> },
      { path: 'billing/success', element: <BillingSuccess /> },
      { path: 'admin/status', element: <ServiceStatus /> }
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
