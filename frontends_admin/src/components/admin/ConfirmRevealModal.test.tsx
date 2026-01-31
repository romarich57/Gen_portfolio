import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmRevealModal from './ConfirmRevealModal';

describe('ConfirmRevealModal', () => {
  it('requires correct confirmation text', () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmRevealModal
        open
        onOpenChange={() => undefined}
        onConfirm={handleConfirm}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /Confirmer/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('AFFICHER'), { target: { value: 'AFFICHER' } });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledWith('AFFICHER');
  });
});
