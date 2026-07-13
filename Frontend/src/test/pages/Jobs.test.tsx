import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Jobs from '../../pages/Jobs';
import { AuthProvider } from '../../contexts/AuthContext';

describe('Jobs Page Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  it('should render Job Board search bar and post job button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <Jobs />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
    expect(screen.getByText(/Post a Job/i)).toBeInTheDocument();
  });
});
