import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Signup from '../../pages/Signup';
import { AuthProvider } from '../../contexts/AuthContext';

describe('Signup Page Component', () => {
  it('should render application form headings and required fields', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Signup />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Apply for an account — verified by GEU administrators/i)).toBeInTheDocument();
    expect(screen.getByText(/Full Name \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Email \*/i)).toBeInTheDocument();
  });
});
