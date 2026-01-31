import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Register from './Register';
import { BrowserRouter } from 'react-router-dom';

const mockRegister = vi.fn();
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
    register: (...args: unknown[]) => mockRegister(...args),
    resendEmailVerification: vi.fn()
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
    useAuth: () => ({ csrfToken: 'csrf-token' })
}));

describe('Register Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders register form', () => {
        render(
            <BrowserRouter>
                <Register />
            </BrowserRouter>
        );
        expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Mot de passe$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Confirmer le mot de passe/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Prenom/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Nom$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Pseudo/i)).toBeInTheDocument();
    });

    it('shows error if passwords do not match', async () => {
        render(
            <BrowserRouter>
                <Register />
            </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText(/^Mot de passe$/i), { target: { value: 'Password1234' } });
        fireEvent.change(screen.getByLabelText(/Confirmer le mot de passe/i), { target: { value: 'mismatch' } });
        fireEvent.change(screen.getByLabelText(/Prenom/i), { target: { value: 'Ada' } });
        fireEvent.change(screen.getByLabelText(/^Nom$/i), { target: { value: 'Lovelace' } });
        fireEvent.change(screen.getByLabelText(/Pseudo/i), { target: { value: 'ada_l' } });
        fireEvent.change(screen.getByRole('combobox', { name: /Nationalite/i }), { target: { value: 'FR' } });
        fireEvent.click(screen.getByRole('checkbox'));

        const form = screen.getByLabelText(/Email/i).closest('form');
        if (!form) {
            throw new Error('Form not found');
        }
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText(/ne correspondent pas/i)).toBeInTheDocument();
        });
        expect(mockRegister).not.toHaveBeenCalled();
    });

    it('submits form on valid input', async () => {
        mockRegister.mockResolvedValueOnce({ ok: true });

        render(
            <BrowserRouter>
                <Register />
            </BrowserRouter>
        );

        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText(/^Mot de passe$/i), { target: { value: 'Password1234' } });
        fireEvent.change(screen.getByLabelText(/Confirmer le mot de passe/i), { target: { value: 'Password1234' } });
        fireEvent.change(screen.getByLabelText(/Prenom/i), { target: { value: 'Ada' } });
        fireEvent.change(screen.getByLabelText(/^Nom$/i), { target: { value: 'Lovelace' } });
        fireEvent.change(screen.getByLabelText(/Pseudo/i), { target: { value: 'ada_l' } });
        fireEvent.change(screen.getByRole('combobox', { name: /Nationalite/i }), { target: { value: 'FR' } });

        const terms = screen.getByRole('checkbox');
        fireEvent.click(terms);

        fireEvent.click(screen.getByRole('button', { name: /Lancer mon Brief/i }));

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith({
                email: 'new@example.com',
                password: 'Password1234',
                firstName: 'Ada',
                lastName: 'Lovelace',
                username: 'ada_l',
                nationality: 'FR'
            });
        });
    });
});
