import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type ConfirmRevealModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmValue: string) => void;
  loading?: boolean;
  error?: string | null;
};

const REQUIRED_TEXT = 'AFFICHER';

function ConfirmRevealModal({ open, onOpenChange, onConfirm, loading, error }: ConfirmRevealModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) {
      setValue('');
    }
  }, [open]);

  const canConfirm = value.trim() === REQUIRED_TEXT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Confirmer l'affichage</DialogTitle>
      </DialogHeader>
      <DialogContent className="space-y-4">
        <p className="text-sm text-mutedForeground">
          Cette action revele une donnee sensible. Tapez <strong>{REQUIRED_TEXT}</strong> pour confirmer.
        </p>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="AFFICHER"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annuler
        </Button>
        <Button
          onClick={() => onConfirm(value.trim())}
          disabled={!canConfirm || loading}
        >
          {loading ? 'Traitement...' : 'Confirmer'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default ConfirmRevealModal;
