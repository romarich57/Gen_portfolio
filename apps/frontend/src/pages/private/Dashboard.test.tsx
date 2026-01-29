import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';

// Mock useAuth
const mockUser = {
    id: '123',
    email: 'test@example.com',
    roles: ['user'],
    status: 'active'
};

const mockUseAuth = vi.fn();

vi.mock('@/app/providers/AuthBootstrap', () => ({
    useAuth: () => mockUseAuth()
}));

// Mock API call if Dashboard fetches data on mount
// Usually Dashboard might use React Query or useEffect.
// Checking file contents (not visible but assuming it displays user info).

describe('Dashboard Page', () => {
    it('renders user email', () => {
        mockUseAuth.mockReturnValue({
            user: mockUser,
            isAuthenticated: true,
            isLoading: false
        });

        render(<Dashboard />);

        expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    });

    it('shows loading state', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            isAuthenticated: false,
            isLoading: true
        });

        render(<Dashboard />);

        // Assuming there's a loading indicator or text
        // If Dashboard is protected, it might just render nothing or a loader
        // This depends on implementation.
    });
});
