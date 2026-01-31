import { apiRequest } from './http';

export type AdminMe = {
  admin: {
    id: string;
    email_masked: string | null;
    role: string;
  };
  ui: { lang: string };
};

export function getAdminMe() {
  return apiRequest<AdminMe>('/api/admin/me');
}

export type OverviewResponse = {
  totals: {
    total_users: number;
    total_users_free: number;
    total_users_premium: number;
    total_users_vip: number;
    total_active_subscriptions: number;
    total_exports_24h: number;
  };
  timeseries: {
    signups_per_day: Array<{ date: string; value: number }>;
    upgrades_per_day: Array<{ date: string; value: number }>;
    churn_per_day: Array<{ date: string; value: number }>;
  };
};

export function getOverview() {
  return apiRequest<OverviewResponse>('/api/admin/overview');
}

export type UserSummary = {
  id: string;
  username: string | null;
  role: string;
  status: string;
  created_at: string;
  email_masked: string | null;
  flags: { email_verified: boolean };
};

export type UsersResponse = {
  items: UserSummary[];
  nextCursor: string | null;
};

export function getUsers(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return apiRequest<UsersResponse>(`/api/admin/users?${query.toString()}`);
}

export type UserDetailsResponse = {
  id: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    nationality: string | null;
    status: string;
    roles: string[];
    created_at: string;
    email_masked: string | null;
  };
  billing: {
    plan_code: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    cancel_at_period_end: boolean;
    entitlements: {
      projects_limit: number | null;
      projects_used: number;
      period_start: string | null;
      period_end: string | null;
    };
    roles: string[];
  };
  sessions_count: number;
  credits_balance: number;
  flags: {
    email_verified: boolean;
    phone_verified: boolean;
    mfa_enabled: boolean;
    deleted: boolean;
  };
};

export function getUserDetails(id: string) {
  return apiRequest<UserDetailsResponse>(`/api/admin/users/${id}`);
}

export function revealSensitive(id: string, fields: string[], confirm: string) {
  return apiRequest<{ email_full?: string }>(`/api/admin/users/${id}/reveal`, {
    method: 'POST',
    body: JSON.stringify({ fields, confirm })
  });
}

export function updateUserRole(id: string, role: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export function updateUserStatus(id: string, status_action: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status_action })
  });
}

export function triggerPasswordReset(id: string, mode: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/password/reset`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
}

export function forceVerifyEmail(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/email/verify/force`, {
    method: 'POST'
  });
}

export function revokeVerifyEmail(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/email/verify/revoke`, {
    method: 'POST'
  });
}

export function revokeSessions(id: string, mode = 'all') {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/sessions/revoke`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
}

export function requestGdprExport(id: string) {
  return apiRequest<{ ok: boolean; export_id: string }>(`/api/admin/users/${id}/gdpr/export`, {
    method: 'POST'
  });
}

export function softDeleteUser(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/delete`, { method: 'POST' });
}

export function purgeUser(id: string) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/purge`, { method: 'POST' });
}

export type PlanAdmin = {
  id: string;
  code: string;
  name_fr: string;
  currency: string;
  monthly_price_eur_cents: number;
  project_limit: number | null;
  credits_monthly: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  interval: string;
  features?: unknown;
};

export function getPlans() {
  return apiRequest<{ plans: PlanAdmin[] }>(`/api/admin/plans`);
}

export function createPlan(payload: {
  code: string;
  name_fr: string;
  price_eur_cents: number;
  project_limit?: number | null;
  credits_monthly?: number | null;
  create_stripe?: boolean;
}) {
  return apiRequest<{ id: string }>(`/api/admin/plans`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updatePlan(id: string, payload: Record<string, unknown>) {
  return apiRequest<{ ok: boolean }>(`/api/admin/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function createCoupon(payload: {
  percent_off?: number;
  amount_off?: number;
  duration: string;
  code: string;
}) {
  return apiRequest<{ coupon_id: string; promo_code_id: string }>(`/api/admin/stripe/coupons`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function changeSubscription(id: string, payload: { plan_code: string; proration?: boolean }) {
  return apiRequest<{ ok: boolean }>(`/api/admin/users/${id}/subscription/change`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type CreditsSummary = {
  balance: number;
  ledger: Array<{
    id: string;
    delta: number;
    reason: string;
    created_at: string;
    created_by_admin_id: string | null;
  }>;
};

export function getCredits(id: string) {
  return apiRequest<CreditsSummary>(`/api/admin/users/${id}/credits`);
}

export function adjustCreditsApi(id: string, payload: { delta: number; reason: string }) {
  return apiRequest<{ balance: number }>(`/api/admin/users/${id}/credits/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type AuditItem = {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: unknown;
};

export type AuditResponse = {
  items: AuditItem[];
  nextCursor: string | null;
};

export function getAudit(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return apiRequest<AuditResponse>(`/api/admin/audit?${query.toString()}`);
}

export type ExportItem = {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  ready_at: string | null;
  expires_at: string | null;
};

export type ExportsResponse = {
  items: ExportItem[];
  nextCursor: string | null;
};

export function getExports(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  return apiRequest<ExportsResponse>(`/api/admin/exports?${query.toString()}`);
}
