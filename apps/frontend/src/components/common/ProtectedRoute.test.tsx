import React from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import ProtectedRoute from './ProtectedRoute';
import { AuthContext, type AuthContextValue } from '@/app/providers/AuthBootstrap';

const createAuthValue = (overrides: Partial<AuthContextValue>): AuthContextValue => ({
  user: null,
  loading: false,
  csrfToken: null,
  refreshUser: async () => null,
  setUser: () => {},
  logout: async () => {},
  ...overrides
});

/**
 * Tests for ProtectedRoute.
 * Preconditions: router and auth context provided.
 * Postconditions: redirects or renders based on auth state.
 */
describe('ProtectedRoute', () => {
  it('redirects to login when unauthenticated', () => {
    const authValue = createAuthValue({ user: null, loading: false });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route path="/login" element={<div>Login</div>} />
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <div>Secret</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    const authValue = createAuthValue({
      user: {
        id: '1',
        email: 'a@b.c',
        roles: [],
        first_name: 'Ada',
        last_name: 'Lovelace',
        username: 'ada_l',
        nationality: 'FR',
        locale: null,
        avatar_url: null,
        mfa_enabled: true,
        mfa_required: false,
        onboarding_completed_at: new Date().toISOString(),
        deleted_at: null
      },
      loading: false
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route
              path="/private"
              element={
                <ProtectedRoute>
                  <div>Secret</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('redirects to complete-profile when profile is incomplete', () => {
    const authValue = createAuthValue({
      user: {
        id: '2',
        email: 'onb@b.c',
        roles: [],
        first_name: null,
        last_name: null,
        username: null,
        nationality: null,
        locale: null,
        avatar_url: null,
        mfa_enabled: false,
        mfa_required: false,
        onboarding_completed_at: null,
        deleted_at: null
      }
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard', '/complete-profile']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
            <Route path="/complete-profile" element={<div>Complete Profile</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Complete Profile')).toBeInTheDocument();
  });

  it('redirects to setup-mfa when MFA is required', () => {
    const authValue = createAuthValue({
      user: {
        id: '3',
        email: 'mfa@b.c',
        roles: [],
        first_name: 'Mfa',
        last_name: 'User',
        username: 'mfa_user',
        nationality: 'FR',
        locale: null,
        avatar_url: null,
        mfa_enabled: false,
        mfa_required: true,
        onboarding_completed_at: new Date().toISOString(),
        deleted_at: null
      }
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard', '/setup-mfa']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
            <Route path="/setup-mfa" element={<div>Setup MFA</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Setup MFA')).toBeInTheDocument();
  });
});
