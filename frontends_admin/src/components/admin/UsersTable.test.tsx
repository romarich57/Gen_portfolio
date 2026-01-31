import { render, screen, fireEvent } from '@testing-library/react';
import { UsersFiltersForm } from './UsersTable';

describe('UsersFiltersForm', () => {
  it('updates filters on change', () => {
    const handleChange = vi.fn();
    render(
      <UsersFiltersForm
        value={{ q: '', role: '', status: '', created_from: '', created_to: '' }}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Recherche/i), { target: { value: 'romaric' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'romaric' })
    );

    fireEvent.change(screen.getByLabelText(/Role/i), { target: { value: 'vip' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'vip' })
    );
  });
});
