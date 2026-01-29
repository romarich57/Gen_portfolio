import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { setCsrfErrorHandler } from '@/api/http';

type ToastType = 'info' | 'success' | 'error';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  React.useEffect(() => {
    setCsrfErrorHandler(() => {
      showToast('Session CSRF expiree. Rechargez la page.', 'error');
    });
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
              toast.type === 'error'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : toast.type === 'success'
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card/90 text-foreground'
            ].join(' ')}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export { ToastProvider, useToast };
