import * as React from 'react';
import { cn } from '@/lib/utils';

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-border bg-card text-cardForeground shadow-xl"
      >
        <button
          type="button"
          aria-label="Fermer"
          className="absolute right-4 top-4 text-sm text-mutedForeground"
          onClick={() => onOpenChange(false)}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border px-6 py-5', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;
}

function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-3 px-6 py-5', className)} {...props} />;
}

export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter };
