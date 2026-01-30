import dotenv from 'dotenv';

type EnvConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  logLevel: string;
  trustProxy: number;
  isProduction: boolean;
  isTest: boolean;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  mfaChallengeSecret: string;
  tokenHashSecret: string;
  backupCodePepper: string;
  mfaMasterKey: string;
  cookieSigningSecret: string;
  appBaseUrl: string;
  appUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
  twilioVerifyMode: 'live' | 'mock';
  twilioMessagingServiceSid: string | null;
  twilioSmsFrom: string | null;
  oauthGoogleClientId: string;
  oauthGoogleClientSecret: string;
  oauthGithubClientId: string;
  oauthGithubClientSecret: string;
  oauthRedirectBaseUrl: string;
  oauthGoogleRedirectUri: string | null;
  oauthGithubRedirectUri: string | null;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripeTaxEnabled: boolean;
  stripeCustomerPortalConfigurationId: string | null;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Bucket: string;
  s3ForcePathStyle: boolean;
  s3UseSsl: boolean;
  s3PresignPutTtlSeconds: number;
  s3PresignGetTtlSeconds: number;
  captchaProvider: string;
  captchaSecret: string | null;
  cookieDomain: string | null;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  idleTimeoutMinutes: number;
  reauthMaxHours: number;
  httpsEnabled: boolean;
  httpsCertPath: string | null;
  httpsKeyPath: string | null;
  serviceStatusCronEnabled: boolean;
  serviceStatusCronIntervalSeconds: number;
  serviceStatusCacheTtlSeconds: number;
  serviceStatusAlertEmail: string | null;
  serviceStatusAlertSlackWebhook: string | null;
  serviceStatusAlertCooldownMinutes: number;
  serviceStatusHistoryLimit: number;
  securityTokenCleanupCronEnabled: boolean;
  securityTokenCleanupCronIntervalMinutes: number;
  redisUrl: string | null;
};

let cached: EnvConfig | null = null;

function parseTrustProxy(value?: string): number {
  if (!value) return 0;
  if (value === 'true') return 1;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function loadEnv(): EnvConfig {
  if (cached) return cached;

  dotenv.config();

  const required = [
    'DATABASE_URL',
    'CORS_ORIGINS',
    'ACCESS_TOKEN_SECRET',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'MFA_CHALLENGE_SECRET',
    'TOKEN_HASH_SECRET',
    'BACKUP_CODE_PEPPER',
    'MFA_MASTER_KEY',
    'COOKIE_SIGNING_SECRET',
    'APP_BASE_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_VERIFY_SERVICE_SID',
    'OAUTH_GOOGLE_CLIENT_ID',
    'OAUTH_GOOGLE_CLIENT_SECRET',
    'OAUTH_GITHUB_CLIENT_ID',
    'OAUTH_GITHUB_CLIENT_SECRET',
    'OAUTH_REDIRECT_BASE_URL',
    'APP_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_TAX_ENABLED',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'S3_FORCE_PATH_STYLE',
    'S3_USE_SSL',
    'S3_PRESIGN_PUT_TTL_SECONDS',
    'S3_PRESIGN_GET_TTL_SECONDS'
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (process.env.CAPTCHA_PROVIDER && process.env.CAPTCHA_PROVIDER !== 'none' && !process.env.CAPTCHA_SECRET) {
    // eslint-disable-next-line no-console
    console.error('CAPTCHA_SECRET is required when CAPTCHA_PROVIDER is enabled.');
    process.exit(1);
  }

  if (process.env.STRIPE_TAX_ENABLED !== 'true') {
    // eslint-disable-next-line no-console
    console.error('STRIPE_TAX_ENABLED must be true for billing.');
    process.exit(1);
  }

  const presignPutTtl = parseNumber(process.env.S3_PRESIGN_PUT_TTL_SECONDS, 120);
  const presignGetTtl = parseNumber(process.env.S3_PRESIGN_GET_TTL_SECONDS, 120);
  if (presignPutTtl < 60 || presignPutTtl > 120) {
    // eslint-disable-next-line no-console
    console.error('S3_PRESIGN_PUT_TTL_SECONDS must be between 60 and 120.');
    process.exit(1);
  }
  if (presignGetTtl !== 120) {
    // eslint-disable-next-line no-console
    console.error('S3_PRESIGN_GET_TTL_SECONDS must be 120.');
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const redisUrl = process.env.REDIS_URL ?? null;
  if (isProduction && !redisUrl) {
    // eslint-disable-next-line no-console
    console.error('REDIS_URL is required in production for rate limiting.');
    process.exit(1);
  }
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const protocol = parsed.protocol;
      if (!['redis:', 'rediss:'].includes(protocol)) {
        throw new Error('REDIS_URL must use redis:// or rediss://');
      }
      if (isProduction && protocol !== 'rediss:') {
        throw new Error('REDIS_URL must use rediss:// in production.');
      }
      if (isProduction && !parsed.password) {
        throw new Error('REDIS_URL must include a password in production.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid REDIS_URL.';
      // eslint-disable-next-line no-console
      console.error(message);
      process.exit(1);
    }
  }
  const port = Number(process.env.PORT || 4000);
  const corsOrigins = process.env.CORS_ORIGINS!.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const serviceStatusCronIntervalSeconds = parseNumber(
    process.env.SERVICE_STATUS_CRON_INTERVAL_SECONDS,
    300
  );
  if (serviceStatusCronIntervalSeconds < 60 || serviceStatusCronIntervalSeconds > 3600) {
    // eslint-disable-next-line no-console
    console.error('SERVICE_STATUS_CRON_INTERVAL_SECONDS must be between 60 and 3600.');
    process.exit(1);
  }

  const serviceStatusCacheTtlSeconds = parseNumber(process.env.SERVICE_STATUS_CACHE_TTL_SECONDS, 300);
  if (serviceStatusCacheTtlSeconds < 30 || serviceStatusCacheTtlSeconds > 3600) {
    // eslint-disable-next-line no-console
    console.error('SERVICE_STATUS_CACHE_TTL_SECONDS must be between 30 and 3600.');
    process.exit(1);
  }

  const serviceStatusAlertCooldownMinutes = parseNumber(process.env.SERVICE_STATUS_ALERT_COOLDOWN_MINUTES, 30);
  if (serviceStatusAlertCooldownMinutes < 5 || serviceStatusAlertCooldownMinutes > 240) {
    // eslint-disable-next-line no-console
    console.error('SERVICE_STATUS_ALERT_COOLDOWN_MINUTES must be between 5 and 240.');
    process.exit(1);
  }

  const serviceStatusHistoryLimit = parseNumber(process.env.SERVICE_STATUS_HISTORY_LIMIT, 100);
  if (serviceStatusHistoryLimit < 10 || serviceStatusHistoryLimit > 1000) {
    // eslint-disable-next-line no-console
    console.error('SERVICE_STATUS_HISTORY_LIMIT must be between 10 and 1000.');
    process.exit(1);
  }

  const securityTokenCleanupInterval = parseNumber(
    process.env.SECURITY_TOKEN_CLEANUP_CRON_INTERVAL_MINUTES,
    60
  );
  if (securityTokenCleanupInterval < 5 || securityTokenCleanupInterval > 1440) {
    // eslint-disable-next-line no-console
    console.error('SECURITY_TOKEN_CLEANUP_CRON_INTERVAL_MINUTES must be between 5 and 1440.');
    process.exit(1);
  }

  cached = {
    nodeEnv,
    port,
    databaseUrl: process.env.DATABASE_URL!,
    corsOrigins,
    logLevel: process.env.LOG_LEVEL || 'info',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    isProduction,
    isTest: nodeEnv === 'test',
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,
    mfaChallengeSecret: process.env.MFA_CHALLENGE_SECRET!,
    tokenHashSecret: process.env.TOKEN_HASH_SECRET!,
    backupCodePepper: process.env.BACKUP_CODE_PEPPER!,
    mfaMasterKey: process.env.MFA_MASTER_KEY!,
    cookieSigningSecret: process.env.COOKIE_SIGNING_SECRET!,
    appBaseUrl: process.env.APP_BASE_URL!,
    appUrl: process.env.APP_URL!,
    smtpHost: process.env.SMTP_HOST!,
    smtpPort: parseNumber(process.env.SMTP_PORT, 587),
    smtpUser: process.env.SMTP_USER!,
    smtpPass: process.env.SMTP_PASS!,
    smtpFrom: process.env.SMTP_FROM!,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID!,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN!,
    twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID!,
    twilioVerifyMode: process.env.TWILIO_VERIFY_MODE === 'mock' ? 'mock' : 'live',
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? null,
    twilioSmsFrom: process.env.TWILIO_SMS_FROM ?? null,
    oauthGoogleClientId: process.env.OAUTH_GOOGLE_CLIENT_ID!,
    oauthGoogleClientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET!,
    oauthGithubClientId: process.env.OAUTH_GITHUB_CLIENT_ID!,
    oauthGithubClientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET!,
    oauthRedirectBaseUrl: process.env.OAUTH_REDIRECT_BASE_URL!,
    oauthGoogleRedirectUri: process.env.OAUTH_GOOGLE_REDIRECT_URI || null,
    oauthGithubRedirectUri: process.env.OAUTH_GITHUB_REDIRECT_URI || null,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    stripeTaxEnabled: process.env.STRIPE_TAX_ENABLED === 'true',
    stripeCustomerPortalConfigurationId: process.env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID || null,
    s3Endpoint: process.env.S3_ENDPOINT!,
    s3Region: process.env.S3_REGION!,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID!,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    s3Bucket: process.env.S3_BUCKET!,
    s3ForcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, true),
    s3UseSsl: parseBoolean(process.env.S3_USE_SSL, true),
    s3PresignPutTtlSeconds: presignPutTtl,
    s3PresignGetTtlSeconds: presignGetTtl,
    captchaProvider: process.env.CAPTCHA_PROVIDER || 'none',
    captchaSecret: process.env.CAPTCHA_SECRET || null,
    cookieDomain: process.env.COOKIE_DOMAIN || null,
    accessTokenTtlMinutes: parseNumber(process.env.ACCESS_TOKEN_TTL_MINUTES, 15),
    refreshTokenTtlDays: parseNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
    idleTimeoutMinutes: parseNumber(process.env.IDLE_TIMEOUT_MINUTES, 30),
    reauthMaxHours: parseNumber(process.env.REAUTH_MAX_HOURS, 12),
    httpsEnabled: process.env.HTTPS_ENABLED === 'true',
    httpsCertPath: process.env.HTTPS_CERT_PATH || null,
    httpsKeyPath: process.env.HTTPS_KEY_PATH || null,
    serviceStatusCronEnabled: parseBoolean(process.env.SERVICE_STATUS_CRON_ENABLED, true),
    serviceStatusCronIntervalSeconds,
    serviceStatusCacheTtlSeconds,
    serviceStatusAlertEmail: process.env.SERVICE_STATUS_ALERT_EMAIL || null,
    serviceStatusAlertSlackWebhook: process.env.SERVICE_STATUS_ALERT_SLACK_WEBHOOK || null,
    serviceStatusAlertCooldownMinutes,
    serviceStatusHistoryLimit,
    securityTokenCleanupCronEnabled: parseBoolean(process.env.SECURITY_TOKEN_CLEANUP_CRON_ENABLED, true),
    securityTokenCleanupCronIntervalMinutes: securityTokenCleanupInterval,
    redisUrl
  };

  if (cached.twilioVerifyMode !== 'live' && cached.twilioVerifyMode !== 'mock') {
    // eslint-disable-next-line no-console
    console.error('TWILIO_VERIFY_MODE must be "live" or "mock".');
    process.exit(1);
  }

  if (cached.isProduction && cached.twilioVerifyMode !== 'live') {
    // eslint-disable-next-line no-console
    console.error('TWILIO_VERIFY_MODE=mock is not allowed in production.');
    process.exit(1);
  }

  const validateRedirectUri = (value: string | null, label: string) => {
    if (!value) return;
    try {
      const parsed = new URL(value);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error(`${label} must be a valid URL.`);
      process.exit(1);
    }
  };

  validateRedirectUri(cached.oauthGoogleRedirectUri, 'OAUTH_GOOGLE_REDIRECT_URI');
  validateRedirectUri(cached.oauthGithubRedirectUri, 'OAUTH_GITHUB_REDIRECT_URI');

  return cached;
}

export const env = loadEnv();
