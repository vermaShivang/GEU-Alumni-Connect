import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import { AuthProvider } from '../../contexts/AuthContext';

describe('Login Page Component', () => {
  it('should render username/email and password inputs along with submit button', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByPlaceholderText(/alumni\.username or you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/GEU Alumni Connect/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LOGIN/i })).toBeInTheDocument();
  });

  it('should update inputs when user types', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    const identifierInput = screen.getByPlaceholderText(/alumni\.username or you@example\.com/i) as HTMLInputElement;
    fireEvent.change(identifierInput, { target: { value: 'testuser' } });
    expect(identifierInput.value).toBe('testuser');
  });
});
