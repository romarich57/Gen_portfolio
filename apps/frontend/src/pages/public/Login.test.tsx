import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>
    };
});

vi.mock('@/api/auth', () => ({
    login: (...args: unknown[]) => mockLogin(...args),
    startOAuth: vi.fn(),
    resendEmailVerification: vi.fn()
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
    useAuth: () => ({ csrfToken: 'csrf-token', refreshUser: vi.fn() })
}));

// Mock useAuth context if needed, but Login page uses direct API usually?
// Checking Login.tsx: import { login... } from '@/api/auth';
// It also calls useAuth() to maybe set user? No, usually Login calls API then reloads or redirects.
// Let's assume Login.tsx calls `login` from api/auth.

describe('Login Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login form', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );
        expect(screen.getByLabelText(/Email ou pseudo/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Mot de passe/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
    });

    it('handles input changes', () => {
        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );

        const emailInput = screen.getByLabelText(/Email ou pseudo/i);
        const passwordInput = screen.getByLabelText(/Mot de passe/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(emailInput).toHaveValue('test@example.com');
        expect(passwordInput).toHaveValue('password123');
    });

    it('submits form with correct values', async () => {
        mockLogin.mockResolvedValueOnce({ success: true }); // Mock success

        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText(/Email ou pseudo/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Mot de passe/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith({ identifier: 'test@example.com', password: 'password123' });
        });
    });

    it('displays error message on failure', async () => {
        mockLogin.mockRejectedValueOnce({ code: 'INVALID_CREDENTIALS' });

        render(
            <BrowserRouter>
                <Login />
            </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText(/Email ou pseudo/i), { target: { value: 'wrong@example.com' } });
        fireEvent.change(screen.getByLabelText(/Mot de passe/i), { target: { value: 'wrongpass' } });

        fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

        await waitFor(() => {
            expect(screen.getByText(/Identifiants invalides/i)).toBeInTheDocument();
        });
    });
});
