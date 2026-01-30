import { before, afterEach, after } from 'node:test';
import { execSync } from 'node:child_process';
import { prisma } from '../../src/db/prisma';

const MIGRATE_FLAG = '__TEST_DB_MIGRATED__';

const TABLES = [
  'auth_attempts',
  'backup_codes',
  'mfa_factors',
  'phone_verifications',
  'password_reset_tokens',
  'email_verification_tokens',
  'recovery_email_tokens',
  'security_action_tokens',
  'sessions',
  'oauth_accounts',
  'users',
  'audit_logs',
  'feature_flags',
  'app_settings',
  'consents',
  'gdpr_exports',
  'deletion_requests',
  'jobs',
  'files',
  'data_subjects',
  'role_grants',
  'webhook_events',
  'entitlements',
  'payments',
  'subscriptions',
  'stripe_customers',
  'plans'
];

before(async () => {
  if (!(globalThis as Record<string, unknown>)[MIGRATE_FLAG]) {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env
    });
    (globalThis as Record<string, unknown>)[MIGRATE_FLAG] = true;
  }
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((name) => `"${name}"`).join(', ')} CASCADE;`);
});

after(async () => {
  await prisma.$disconnect();
});
