import * as React from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-mutedForeground">Console admin</p>
        <h1 className="mt-2 text-3xl font-display font-semibold">{title}</h1>
        {description ? <p className={cn('mt-2 max-w-2xl text-mutedForeground')}>{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export default PageHeader;
