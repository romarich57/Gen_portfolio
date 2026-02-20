import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function SidebarItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 text-sm font-black uppercase tracking-[0.1em] font-mono transition-all border-r-2 group',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <span className={cn('transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}>
        {icon}
      </span>
      {label}
    </button>
  );
}

export function OAuthProviderItem({
  name,
  connected,
  icon,
  disconnecting,
  onDisconnect,
  onConnect
}: {
  name: string;
  connected?: boolean;
  icon: ReactNode;
  disconnecting?: boolean;
  onDisconnect?: () => void;
  onConnect?: () => void;
}) {
  return (
    <Card className="border-border/50 group hover:border-primary/20 transition-all">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          {icon}
          <div>
            <h4 className="font-bold uppercase tracking-tight">{name}</h4>
            <p className="text-xs text-muted-foreground font-mono italic">
              {connected ? 'Connecté' : 'Non connecté'}
            </p>
          </div>
        </div>
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white rounded-none uppercase font-mono text-[9px] font-black tracking-widest"
            onClick={onDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Déconnexion...' : 'Déconnecter'}
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-none uppercase font-mono text-[9px] font-black tracking-widest"
            onClick={onConnect}
          >
            Connecter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
