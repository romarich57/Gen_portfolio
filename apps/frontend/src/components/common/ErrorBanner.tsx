import React from 'react';

import { cn } from '@/lib/utils';

export type ErrorBannerProps = {
  message: string;
  className?: string;
};

/**
 * Error banner for user-facing messages.
 * Preconditions: message is neutral and non-sensitive.
 * Postconditions: renders an accessible error panel.
 */
function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive',
        className
      )}
    >
      {message}
    </div>
  );
}

export default ErrorBanner;
