import * as React from 'react';

import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Label component for form controls.
 * Preconditions: htmlFor matches input id when used.
 * Postconditions: renders accessible label.
 */
function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export default Label;
