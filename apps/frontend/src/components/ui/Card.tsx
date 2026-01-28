import * as React from 'react';

import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Card container.
 * Preconditions: used to group related content.
 * Postconditions: renders styled card.
 */
function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-card/90 p-6 shadow-sm', className)}
      {...props}
    />
  );
}

export type CardSectionProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Card header section.
 * Preconditions: placed within Card.
 * Postconditions: renders spaced header.
 */
function CardHeader({ className, ...props }: CardSectionProps) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

/**
 * Card content section.
 * Preconditions: placed within Card.
 * Postconditions: renders body content.
 */
function CardContent({ className, ...props }: CardSectionProps) {
  return <div className={cn('space-y-3', className)} {...props} />;
}

/**
 * Card footer section.
 * Preconditions: placed within Card.
 * Postconditions: renders footer actions.
 */
function CardFooter({ className, ...props }: CardSectionProps) {
  return <div className={cn('mt-6 flex flex-wrap gap-3', className)} {...props} />;
}

export { Card, CardHeader, CardContent, CardFooter };
