import { Link } from 'react-router-dom';
import type { UserSummary } from '@/api/admin';
import Badge, { type BadgeProps } from '@/components/admin/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

export type UsersFilters = {
  q: string;
  role: string;
  status: string;
  created_from: string;
  created_to: string;
};

type UsersFiltersProps = {
  value: UsersFilters;
  onChange: (value: UsersFilters) => void;
};

export function UsersFiltersForm({ value, onChange }: UsersFiltersProps) {
  const update = (key: keyof UsersFilters, nextValue: string) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <Card className="mb-6">
      <CardContent className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <Label htmlFor="search">Recherche</Label>
          <Input
            id="search"
            placeholder="Email ou pseudo"
            value={value.q}
            onChange={(event) => update('q', event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
            value={value.role}
            onChange={(event) => update('role', event.target.value)}
          >
            <option value="">Tous</option>
            <option value="user">User</option>
            <option value="premium">Premium</option>
            <option value="vip">VIP</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <div>
          <Label htmlFor="status">Statut</Label>
          <select
            id="status"
            className="mt-2 h-11 w-full rounded-2xl border border-border bg-card px-3 text-sm"
            value={value.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">Tous</option>
            <option value="active">Actif</option>
            <option value="banned">Banni</option>
            <option value="pending_email">Email en attente</option>
            <option value="pending_phone">Telephone en attente</option>
            <option value="pending_mfa">MFA en attente</option>
            <option value="deleted">Supprime</option>
          </select>
        </div>
        <div>
          <Label htmlFor="created_from">Depuis</Label>
          <Input
            id="created_from"
            type="date"
            value={value.created_from}
            onChange={(event) => update('created_from', event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="created_to">Jusqu'au</Label>
          <Input
            id="created_to"
            type="date"
            value={value.created_to}
            onChange={(event) => update('created_to', event.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type UsersTableProps = {
  items: UserSummary[];
  loading?: boolean;
};

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'active') return 'success';
  if (status === 'banned') return 'danger';
  if (status.startsWith('pending')) return 'warning';
  if (status === 'deleted') return 'neutral';
  return 'info';
}

function roleVariant(role: string): BadgeProps['variant'] {
  if (role === 'vip') return 'info';
  if (role === 'premium') return 'success';
  if (role === 'admin' || role === 'super_admin') return 'warning';
  return 'neutral';
}

export default function UsersTable({ items, loading }: UsersTableProps) {
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-mutedForeground">
              <th className="pb-3">Utilisateur</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Statut</th>
              <th className="pb-3">Creation</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id} className="border-t border-border/60">
                <td className="py-4">
                  <Link className="font-semibold text-primary hover:underline" to={`/users/${user.id}`}>
                    {user.username ?? 'Sans pseudo'}
                  </Link>
                </td>
                <td className="py-4 text-mutedForeground">{user.email_masked ?? '—'}</td>
                <td className="py-4">
                  <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                </td>
                <td className="py-4">
                  <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                </td>
                <td className="py-4 text-mutedForeground">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && items.length === 0 ? (
          <div className="py-6 text-center text-mutedForeground">Chargement...</div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="py-6 text-center text-mutedForeground">Aucun resultat.</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
