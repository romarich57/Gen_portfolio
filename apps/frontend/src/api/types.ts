export type UserProfile = {
  id: string;
  email: string;
  has_password?: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  nationality: string | null;
  locale: string | null;
  roles: string[];
  avatar_url: string | null;
  mfa_enabled: boolean;
  mfa_required: boolean;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  recovery_email?: string | null;
  recovery_email_verified_at?: string | null;
  recovery_email_pending?: string | null;
  security_alert_email_enabled?: boolean;
  security_alert_sms_enabled?: boolean;
  backup_codes_remaining?: number;
  onboarding_completed_at: string | null;
  deleted_at: string | null;
  connected_accounts: string[];
};

export type SessionInfo = {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  current: boolean;
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
