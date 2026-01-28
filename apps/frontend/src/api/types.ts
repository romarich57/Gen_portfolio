export type UserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  nationality: string | null;
  locale: string | null;
  roles: string[];
  avatar_url: string | null;
  onboarding_completed_at: string | null;
  deleted_at: string | null;
};

export type OnboardingStatus = {
  completed: boolean;
  missing_fields: string[];
  onboarding_completed_at: string | null;
};

export type BillingStatus = {
  plan_code: 'FREE' | 'PREMIUM' | 'VIP';
  status: string | null;
  period_start: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  entitlements: {
    projects_limit: number | null;
    projects_used: number;
    period_start: string | null;
    period_end: string | null;
  } | null;
  roles: string[];
};

export type ApiOk = { ok: true };
