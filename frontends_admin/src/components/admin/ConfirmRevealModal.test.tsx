import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
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
