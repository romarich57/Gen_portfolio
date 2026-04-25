import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import Dashboard from './Dashboard';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'dashboard.title': 'Mes CV',
        'dashboard.subtitle': 'Créez, reprenez et exportez vos CV depuis un espace sécurisé.',
        'dashboard.empty': 'Aucun CV sauvegardé',
        'dashboard.create': 'Créer un CV',
        'dashboard.import': 'Importer un texte',
        'dashboard.open': 'Ouvrir'
      };
      return labels[key] ?? key;
    },
    i18n: { language: 'fr' }
  })
}));

vi.mock('@/app/providers/AuthBootstrap', () => ({
  useAuth: () => ({
    user: {
      id: '123',
      email: 'test@example.com',
      username: 'tester',
      roles: ['user']
    }
  })
}));

vi.mock('@/api/resumes', () => ({
  listResumes: async () => ({ resumes: [] }),
  createResume: async () => ({ resume: { id: 'resume-1' } })
}));

function renderWithQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>
  );
}

describe('Dashboard Page', () => {
  it('renders the CV dashboard and current user', async () => {
    renderWithQueryClient();

    expect(await screen.findByText(/Mes CV/i)).toBeInTheDocument();
    expect(screen.getByText(/tester/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucun CV sauvegardé/i)).toBeInTheDocument();
  });
});
