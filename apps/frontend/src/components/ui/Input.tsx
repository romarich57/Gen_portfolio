import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input component with base styling.
 * Preconditions: used inside a label or with aria-label.
 * Postconditions: renders input with consistent styling.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-lg border border-border bg-card px-4 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
