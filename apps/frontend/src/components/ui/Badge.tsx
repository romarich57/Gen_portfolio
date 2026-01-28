import * as React from 'react';

import { cn } from '@/lib/utils';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement>;

/**
 * Badge component for small labels.
 * Preconditions: used for status/labels.
 * Postconditions: renders small pill badge.
 */
function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-mutedForeground',
        className
      )}
      {...props}
    />
  );
}

export default Badge;
