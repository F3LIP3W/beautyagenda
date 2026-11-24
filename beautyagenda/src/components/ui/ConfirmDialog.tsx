import { useState } from 'react';
import { Modal } from './Modal.tsx';
import { Button } from './Button.tsx';

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onClose }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Voltar</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={run} loading={busy}>{confirmLabel}</Button>
      </>}>
      <p className="text-[15px] leading-relaxed text-zinc-600">{message}</p>
    </Modal>
  );
}
