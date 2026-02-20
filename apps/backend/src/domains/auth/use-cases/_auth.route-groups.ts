import { Router, type Request } from 'express';
import { z } from 'zod';
import { authRepository } from '../auth.repository';
import { env } from '../../../config/env';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME
} from '../../../config/auth';
import {
  cookieOAuthOptions,
  setAuthCookies,
  clearAuthCookies,
  setOnboardingCookie,
  clearOnboardingCookie,
  setMfaChallengeCookie,
  clearMfaChallengeCookie
} from '../../../utils/cookies';
import { issueCsrfToken } from '../../../middleware/csrf';
import { buildRateLimiter, accountKeyGenerator } from '../../../middleware/rateLimit';
import { buildOtpRateLimiter } from '../../../middleware/otpRateLimit';
import { ipKeyGenerator } from 'express-rate-limit';
import { writeAuditLog } from '../../../services/audit';
import {
  sendEmail,
  buildEmailVerificationLink,
  buildPasswordResetLink,
  buildEmailHtml,
  buildEmailText
} from '../../../services/email';
import { startPhoneVerification, checkPhoneVerification } from '../../../services/twilio';
import { generateTotpSecret, verifyTotpCode } from '../../../services/mfa';
import { verifyCaptchaToken } from '../../../services/captcha';
import { recordAuthAttempt, countRecentFailures } from '../../../services/authAttempts';
import { createSession, rotateSession, revokeAllSessions, revokeSession } from '../../../services/session';
import { maybeSendLoginAlert } from '../../../services/securityAlerts';
import { generateRandomToken, hashToken, encryptSecret, decryptSecret, hashBackupCode } from '../../../utils/crypto';
import {
  hashPassword,
  verifyPassword
} from '../../../utils/password';
import {
  verifyAccessToken,
  verifyChallengeToken,
  verifyEmailChangeToken,
  signActionConfirmationToken,
  verifyActionConfirmationToken
} from '../../../utils/jwt';
import { normalizePhoneE164, normalizeCountryCode, extractCountryFromLocale } from '../../../utils/phone';
import { normalizeEmail, normalizeUsername } from '../../../utils/normalize';
import { buildOAuthStart, exchangeOAuthCode, fetchOAuthProfile, getOAuthRedirectUri } from '../../../services/oauth';
import { getOtpRateLimits } from '../../../services/settings';
import { getMfaPolicy, isMfaRequired } from '../../../services/mfaPolicy';
import { AuthAttemptType, UserStatus, Prisma } from '@prisma/client';

const registerRouter = Router();
const loginRouter = Router();
const passwordRouter = Router();
const phoneRouter = Router();
const mfaRouter = Router();
const oauthRouter = Router();
const emailRouter = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  firstName: z.string().min(2).max(64),
  lastName: z.string().min(2).max(64),
  username: z.string().regex(USERNAME_REGEX),
  nationality: z.string().regex(/^[A-Za-z]{2}$/),
  captchaToken: z.string().optional()
});

const loginSchema = z
  .object({
    email: z.string().min(3).max(320).optional(),
    identifier: z.string().min(3).max(320).optional(),
    password: z.string().min(12).max(128),
    captchaToken: z.string().optional()
  })
  .refine((data) => Boolean(data.email || data.identifier), {
    message: 'identifier_required'
  });

const resetRequestSchema = z.object({
  email: z.string().email().max(320),
  captchaToken: z.string().optional()
});

const resendEmailSchema = z.object({
  email: z.string().email().max(320)
});

const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(12).max(128)
});

const actionConfirmationSchema = z.object({
  confirmation_token: z.string().min(10).max(4096)
});

const phoneStartSchema = z.object({
  phoneE164: z.string().min(6).max(32),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional()
});

const phoneCheckSchema = z.object({
  phoneE164: z.string().min(6).max(32),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  code: z.string().min(4).max(10)
});

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

async function resolveDefaultCountry(userId: string, requested?: string, acceptLanguage?: string) {
  const requestedCountry = normalizeCountryCode(requested);
  if (requestedCountry) return requestedCountry;

  const user = await authRepository.user.findUnique({
    where: { id: userId },
    select: { nationality: true, locale: true }
  });

  const nationality = normalizeCountryCode(user?.nationality ?? undefined);
  if (nationality) return nationality;

  const localeCountry = extractCountryFromLocale(user?.locale ?? undefined);
  if (localeCountry) return localeCountry;

  const acceptCountry = extractCountryFromLocale(acceptLanguage);
  if (acceptCountry) return acceptCountry;

  return null;
}

const mfaSetupConfirmSchema = z.object({
  code: z.string().min(6).max(8)
});

const mfaVerifySchema = z.object({
  code: z.string().min(6).max(8)
});

const oauthProviderSchema = z.enum(['google', 'github']);

const ipOnly = (req: Request) => ipKeyGenerator(req.ip || '0.0.0.0');

const loginAccountLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 5, keyGenerator: accountKeyGenerator });
const loginIpLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 5, keyGenerator: ipOnly });
const registerLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
const resetLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
const resendLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 3, keyGenerator: ipOnly });
const refreshLimiter = buildRateLimiter({ windowMs: 60 * 1000, limit: 10 });
const phoneStartLimiter = buildOtpRateLimiter('phoneStart');
const phoneCheckLimiter = buildOtpRateLimiter('phoneCheck');

function getRequestMeta(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null
  };
}

async function issueEmailVerification(params: { userId: string; email: string; requestId: string; ip?: string | null }) {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await authRepository.emailVerificationToken.create({
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt
    }
  });

  const verifyLink = buildEmailVerificationLink(rawToken);
  const emailTemplate = {
    title: 'Verifiez votre email',
    preview: 'Confirmez votre adresse pour activer votre compte.',
    intro: 'Merci pour votre inscription. Cliquez sur le bouton ci-dessous pour verifier votre adresse email.',
    actionLabel: 'Verifier mon email',
    actionUrl: verifyLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };

  let emailSent = true;
  try {
    await sendEmail({
      to: params.email,
      subject: 'Verification de votre email',
      text: buildEmailText(emailTemplate),
      html: buildEmailHtml(emailTemplate)
    });
  } catch {
    emailSent = false;
    await writeAuditLog({
      actorUserId: params.userId,
      actorIp: params.ip ?? null,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: params.userId,
      metadata: { email: params.email, reason: 'OAUTH_VERIFY' },
      requestId: params.requestId
    });
  }

  return emailSent;
}

async function enforceCaptchaIfNeeded(params: {
  type: AuthAttemptType;
  email?: string | null;
  ip?: string | null;
  captchaToken?: string | undefined;
}) {
  const failures = await countRecentFailures({
    type: params.type,
    email: params.email ?? null,
    ip: params.ip ?? null,
    windowMinutes: 10
  });

  if (failures < 3) return { required: false, valid: true };

  const valid = await verifyCaptchaToken(params.captchaToken, params.ip ?? undefined);
  return { required: true, valid };
}

registerRouter.get('/csrf', issueCsrfToken);

registerRouter.post('/register', registerLimiter, async (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const email = normalizeEmail(parseResult.data.email);
  const username = normalizeUsername(parseResult.data.username);
  const { password, firstName, lastName, nationality } = parseResult.data;
  const meta = getRequestMeta(req);

  await writeAuditLog({
    actorUserId: null,
    actorIp: meta.ip,
    action: 'REGISTER_ATTEMPT',
    targetType: 'user',
    targetId: null,
    metadata: { email },
    requestId: req.id
  });

  const existing = await authRepository.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (existing) {
    await writeAuditLog({
      actorUserId: existing.id,
      actorIp: meta.ip,
      action: 'REGISTER_ALREADY_EXISTS',
      targetType: 'user',
      targetId: existing.id,
      metadata: { email },
      requestId: req.id
    });

    res.status(201).json({ message: 'If the account exists, a verification email has been sent.' });
    return;
  }

  const existingUsername = await authRepository.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } }
  });
  if (existingUsername) {
    await writeAuditLog({
      actorUserId: existingUsername.id,
      actorIp: meta.ip,
      action: 'REGISTER_USERNAME_CONFLICT',
      targetType: 'user',
      targetId: existingUsername.id,
      metadata: { email },
      requestId: req.id
    });
    res.status(201).json({ message: 'If the account exists, a verification email has been sent.' });
    return;
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await authRepository.user.create({
      data: {
        email,
        passwordHash,
        status: UserStatus.pending_email,
        roles: ['user'],
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username,
        nationality: nationality.toUpperCase(),
        onboardingCompletedAt: new Date()
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta?.target : [];
      if (target.includes('username')) {
        res.status(201).json({ message: 'If the account exists, a verification email has been sent.' });
        return;
      }
      res.status(201).json({ message: 'If the account exists, a verification email has been sent.' });
      return;
    }
    throw err;
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await authRepository.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const verifyLink = buildEmailVerificationLink(rawToken);
  const emailTemplate = {
    title: 'Verifiez votre email',
    preview: 'Confirmez votre adresse pour activer votre compte.',
    intro: 'Merci pour votre inscription. Cliquez sur le bouton ci-dessous pour verifier votre adresse email.',
    actionLabel: 'Verifier mon email',
    actionUrl: verifyLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };
  let emailSent = true;
  try {
    await sendEmail({
      to: email,
      subject: 'Verification de votre email',
      text: buildEmailText(emailTemplate),
      html: buildEmailHtml(emailTemplate)
    });
  } catch {
    emailSent = false;
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: user.id,
      metadata: { reason: 'REGISTER_VERIFY_EMAIL' },
      requestId: req.id
    });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip,
    action: 'REGISTER_SUCCESS',
    targetType: 'user',
    targetId: user.id,
    metadata: { email },
    requestId: req.id
  });

  res.status(201).json({
    message: 'If the account exists, a verification email has been sent.',
    ...(env.isTest ? { test_token: rawToken, email_sent: emailSent } : {}),
    ...(!env.isProduction ? { email_sent: emailSent } : {})
  });
});

emailRouter.post('/email/resend', resendLimiter, async (req, res) => {
  const parseResult = resendEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const email = normalizeEmail(parseResult.data.email);
  const meta = getRequestMeta(req);

  const user = await authRepository.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (!user || user.emailVerifiedAt) {
    res.status(200).json({
      message: 'If the account exists, a verification email has been sent.',
      request_id: req.id
    });
    return;
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await authRepository.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  const verifyLink = buildEmailVerificationLink(rawToken);
  const resendTemplate = {
    title: 'Verifier votre email',
    preview: 'Confirmez votre adresse pour activer votre compte.',
    intro: 'Voici votre nouveau lien de verification. Cliquez ci-dessous pour finaliser votre inscription.',
    actionLabel: 'Verifier mon email',
    actionUrl: verifyLink,
    outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
  };
  let resendSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verification de votre email',
      text: buildEmailText(resendTemplate),
      html: buildEmailHtml(resendTemplate)
    });
  } catch {
    resendSent = false;
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'EMAIL_SEND_FAILED',
      targetType: 'user',
      targetId: user.id,
      metadata: { reason: 'EMAIL_RESEND' },
      requestId: req.id
    });
  }

  if (resendSent) {
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'EMAIL_VERIFICATION_RESEND',
      targetType: 'user',
      targetId: user.id,
      metadata: {},
      requestId: req.id
    });
  }

  res.status(200).json({
    message: 'If the account exists, a verification email has been sent.',
    request_id: req.id,
    ...(env.isTest ? { test_token: rawToken, email_sent: resendSent } : {}),
    ...(!env.isProduction ? { email_sent: resendSent } : {})
  });
});

loginRouter.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const identifierRaw = (parseResult.data.email ?? parseResult.data.identifier ?? '').trim();
  const password = parseResult.data.password;
  const captchaToken = parseResult.data.captchaToken;
  const meta = getRequestMeta(req);
  const identifierLooksEmail = identifierRaw.includes('@');
  const normalizedIdentifierEmail = identifierLooksEmail ? normalizeEmail(identifierRaw) : null;
  const normalizedIdentifierUsername = normalizeUsername(identifierRaw);

  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.login,
    email: identifierLooksEmail ? (normalizedIdentifierEmail ?? identifierRaw) : null,
    ip: meta.ip ?? null,
    captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
    return;
  }

  let user = null as Awaited<ReturnType<typeof authRepository.user.findUnique>>;
  if (identifierLooksEmail) {
    user = await authRepository.user.findFirst({
      where: { email: { equals: normalizedIdentifierEmail ?? identifierRaw, mode: 'insensitive' } }
    });
    if (!user) {
      user = await authRepository.user.findFirst({
        where: { username: { equals: normalizedIdentifierUsername, mode: 'insensitive' } }
      });
    }
  } else {
    user = await authRepository.user.findFirst({
      where: { username: { equals: normalizedIdentifierUsername, mode: 'insensitive' } }
    });
    if (!user) {
      user = await authRepository.user.findFirst({
        where: { email: { equals: normalizeEmail(identifierRaw), mode: 'insensitive' } }
      });
    }
  }
  if (!user || !user.passwordHash || user.status === UserStatus.banned || user.deletedAt) {
    await recordAuthAttempt({
      type: AuthAttemptType.login,
      email: identifierLooksEmail ? (normalizedIdentifierEmail ?? identifierRaw) : null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId: user?.id ?? null
    });
    await writeAuditLog({
      actorUserId: user?.id ?? null,
      actorIp: meta.ip,
      action: 'LOGIN_FAIL',
      targetType: 'user',
      targetId: user?.id ?? null,
      metadata: { identifier: identifierRaw, reason: 'USER_NOT_FOUND_OR_BANNED' },
      requestId: req.id
    });
    res.status(401).json({ error: 'INVALID_CREDENTIALS', request_id: req.id });
    return;
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) {
    await recordAuthAttempt({
      type: AuthAttemptType.login,
      email: user.email,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId: user.id
    });
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'LOGIN_FAIL',
      targetType: 'user',
      targetId: user.id,
      metadata: { identifier: identifierRaw, reason: 'PASSWORD_INVALID' },
      requestId: req.id
    });
    res.status(401).json({ error: 'INVALID_CREDENTIALS', request_id: req.id });
    return;
  }

  await recordAuthAttempt({
    type: AuthAttemptType.login,
    email: user.email,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId: user.id
  });

  if (!user.emailVerifiedAt) {
    res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', request_id: req.id });
    return;
  }

  if (user.status !== UserStatus.active) {
    await authRepository.user.update({
      where: { id: user.id },
      data: { status: UserStatus.active }
    });
  }

  const policy = await getMfaPolicy();
  if (isMfaRequired(user, policy) && !user.mfaEnabled) {
    const session = await createSession({
      userId: user.id,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });
    setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
    setOnboardingCookie(res, user.id, 'mfa');
    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'MFA_SETUP_REQUIRED',
      targetType: 'user',
      targetId: user.id,
      metadata: {},
      requestId: req.id
    });
    res.status(403).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
    return;
  }

  if (user.mfaEnabled) {
    setMfaChallengeCookie(res, user.id);
    res.status(200).json({ error: 'MFA_CHALLENGE_REQUIRED', request_id: req.id });
    return;
  }

  let knownDevice = false;
  if (meta.ip && meta.userAgent) {
    const existingSession = await authRepository.session.findFirst({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, ip: meta.ip, userAgent: meta.userAgent }
    });
    knownDevice = Boolean(existingSession);
  }

  const { accessToken, refreshToken } = await createSession({
    userId: user.id,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  setAuthCookies(res, { accessToken, refreshToken });
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip,
    action: 'LOGIN_SUCCESS',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  await maybeSendLoginAlert({
    userId: user.id,
    email: user.email,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    emailEnabled: user.securityAlertEmailEnabled,
    smsEnabled: user.securityAlertSmsEnabled,
    requestId: req.id,
    knownDevice
  });

  res.json({ ok: true, request_id: req.id });
});

loginRouter.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (refreshToken) {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await authRepository.session.findUnique({ where: { refreshTokenHash } });
    if (session) {
      await revokeSession(session.id);
      await writeAuditLog({
        actorUserId: session.userId,
        actorIp: req.ip ?? null,
        action: 'LOGOUT',
        targetType: 'session',
        targetId: session.id,
        metadata: {},
        requestId: req.id
      });
    }
  }

  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);
  res.status(204).send();
});

loginRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ error: 'REFRESH_TOKEN_MISSING', request_id: req.id });
    return;
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await authRepository.session.findUnique({ where: { refreshTokenHash } });
  if (!session) {
    res.status(401).json({ error: 'REFRESH_TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (session.revokedAt) {
    res.status(401).json({ error: 'REFRESH_TOKEN_REVOKED', request_id: req.id });
    return;
  }

  if (session.rotatedAt) {
    await revokeAllSessions(session.userId);
    await writeAuditLog({
      actorUserId: session.userId,
      actorIp: req.ip ?? null,
      action: 'REFRESH_REUSE_DETECTED',
      targetType: 'session',
      targetId: session.id,
      metadata: {},
      requestId: req.id
    });
    clearAuthCookies(res);
    res.status(401).json({ error: 'REFRESH_REUSE_DETECTED', request_id: req.id });
    return;
  }

  const now = new Date();
  if (session.expiresAt < now) {
    res.status(401).json({ error: 'REFRESH_TOKEN_EXPIRED', request_id: req.id });
    return;
  }

  const idleTimeoutMs = env.idleTimeoutMinutes * 60 * 1000;
  const reauthMaxMs = env.reauthMaxHours * 60 * 60 * 1000;

  if (now.getTime() - session.lastUsedAt.getTime() > idleTimeoutMs) {
    await revokeSession(session.id);
    res.status(401).json({ error: 'SESSION_IDLE_TIMEOUT', request_id: req.id });
    return;
  }

  if (now.getTime() - session.createdAt.getTime() > reauthMaxMs) {
    await revokeSession(session.id);
    res.status(401).json({ error: 'SESSION_REAUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await authRepository.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== UserStatus.active || user.deletedAt) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const policy = await getMfaPolicy();
  if (isMfaRequired(user, policy) && !user.mfaEnabled) {
    const meta = getRequestMeta(req);
    const { accessToken, refreshToken: newRefreshToken } = await rotateSession({
      sessionId: session.id,
      userId: session.userId,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });

    setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
    setOnboardingCookie(res, user.id, 'mfa');
    res.status(403).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
    return;
  }

  const meta = getRequestMeta(req);
  const { accessToken, refreshToken: newRefreshToken } = await rotateSession({
    sessionId: session.id,
    userId: session.userId,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });

  await writeAuditLog({
    actorUserId: session.userId,
    actorIp: meta.ip,
    action: 'REFRESH_ROTATED',
    targetType: 'session',
    targetId: session.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

emailRouter.get('/email/verify', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = hashToken(token);
  const record = await authRepository.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'email_verify',
      sourceTokenHash: tokenHash
    },
    5
  );

  res.setHeader('Cache-Control', 'no-store');
  res.json({ confirmation_token: confirmationToken, request_id: req.id });
});

emailRouter.post('/email/verify', async (req, res) => {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyActionConfirmationToken(parseResult.data.confirmation_token);
  } catch {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_verify') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = payload.sourceTokenHash;
  const record = await authRepository.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const user = await authRepository.user.update({
    where: { id: record.userId },
    data: {
      emailVerifiedAt: new Date(),
      status: UserStatus.active
    }
  });

  await authRepository.emailVerificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: req.ip ?? null,
    action: 'EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

emailRouter.get('/recovery-email/verify', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = hashToken(token);
  const record = await authRepository.recoveryEmailToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'recovery_email_verify',
      sourceTokenHash: tokenHash
    },
    5
  );

  res.setHeader('Cache-Control', 'no-store');
  res.json({ confirmation_token: confirmationToken, request_id: req.id });
});

emailRouter.post('/recovery-email/verify', async (req, res) => {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyActionConfirmationToken(parseResult.data.confirmation_token);
  } catch {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'recovery_email_verify') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = payload.sourceTokenHash;
  const record = await authRepository.recoveryEmailToken.findUnique({ where: { tokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await authRepository.$transaction([
    authRepository.recoveryEmailToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    }),
    authRepository.user.update({
      where: { id: record.userId },
      data: {
        recoveryEmail: record.email,
        recoveryEmailVerifiedAt: new Date(),
        recoveryEmailPending: null
      }
    })
  ]);

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: req.ip ?? null,
    action: 'RECOVERY_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

emailRouter.get('/security/revoke-sessions', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = hashToken(token);
  const record = await authRepository.securityActionToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.action !== 'REVOKE_SESSIONS') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'security_revoke_sessions',
      sourceTokenHash: tokenHash
    },
    5
  );

  res.setHeader('Cache-Control', 'no-store');
  res.json({ confirmation_token: confirmationToken, request_id: req.id });
});

emailRouter.post('/security/revoke-sessions', async (req, res) => {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyActionConfirmationToken(parseResult.data.confirmation_token);
  } catch {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'security_revoke_sessions') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = payload.sourceTokenHash;
  const record = await authRepository.securityActionToken.findUnique({ where: { tokenHash } });
  if (
    !record ||
    record.userId !== payload.sub ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    record.action !== 'REVOKE_SESSIONS'
  ) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const now = new Date();
  await authRepository.$transaction([
    authRepository.securityActionToken.update({
      where: { id: record.id },
      data: { usedAt: now }
    }),
    authRepository.session.updateMany({
      where: { userId: record.userId },
      data: { revokedAt: now }
    })
  ]);

  clearAuthCookies(res);
  clearOnboardingCookie(res);
  clearMfaChallengeCookie(res);

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: req.ip ?? null,
    action: 'SESSIONS_REVOKED_FROM_ALERT',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

emailRouter.get('/security/acknowledge-alert', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = hashToken(token);
  const record = await authRepository.securityActionToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.action !== 'ACK_ALERT') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: 'security_acknowledge_alert',
      sourceTokenHash: tokenHash
    },
    5
  );

  res.setHeader('Cache-Control', 'no-store');
  res.json({ confirmation_token: confirmationToken, request_id: req.id });
});

emailRouter.post('/security/acknowledge-alert', async (req, res) => {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyActionConfirmationToken(parseResult.data.confirmation_token);
  } catch {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'security_acknowledge_alert') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const tokenHash = payload.sourceTokenHash;
  const record = await authRepository.securityActionToken.findUnique({ where: { tokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date() || record.action !== 'ACK_ALERT') {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  await authRepository.securityActionToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: req.ip ?? null,
    action: 'SECURITY_ALERT_ACKNOWLEDGED',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

passwordRouter.post('/password/reset/request', resetLimiter, async (req, res) => {
  const parseResult = resetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const email = normalizeEmail(parseResult.data.email);
  const { captchaToken } = parseResult.data;
  const meta = getRequestMeta(req);
  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.login,
    email,
    ip: meta.ip ?? null,
    captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
    return;
  }

  const user = await authRepository.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (user) {
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await authRepository.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const resetLink = buildPasswordResetLink(rawToken);
    const resetTemplate = {
      title: 'Reinitialiser votre mot de passe',
      preview: 'Demande de reinitialisation de mot de passe.',
      intro: 'Nous avons recu une demande de reinitialisation. Cliquez sur le bouton ci-dessous.',
      actionLabel: 'Reinitialiser le mot de passe',
      actionUrl: resetLink,
      outro: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."
    };
    let resetSent = true;
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reinitialisation du mot de passe',
        text: buildEmailText(resetTemplate),
        html: buildEmailHtml(resetTemplate)
      });
    } catch {
      resetSent = false;
      await writeAuditLog({
        actorUserId: user.id,
        actorIp: meta.ip,
        action: 'EMAIL_SEND_FAILED',
        targetType: 'user',
        targetId: user.id,
        metadata: { reason: 'RESET_REQUEST' },
        requestId: req.id
      });
    }

    await writeAuditLog({
      actorUserId: user.id,
      actorIp: meta.ip,
      action: 'RESET_REQUESTED',
      targetType: 'user',
      targetId: user.id,
      metadata: { email, exists: true, email_sent: resetSent },
      requestId: req.id
    });
  } else {
    await writeAuditLog({
      actorUserId: null,
      actorIp: meta.ip,
      action: 'RESET_REQUESTED',
      targetType: 'user',
      targetId: null,
      metadata: { email, exists: false },
      requestId: req.id
    });
  }

  res.json({ message: 'If the account exists, a reset email has been sent.' });
});

passwordRouter.post('/password/reset/confirm', async (req, res) => {
  const parseResult = resetConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { token, newPassword } = parseResult.data;
  const tokenHash = hashToken(token);
  const record = await authRepository.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await authRepository.user.update({
    where: { id: record.userId },
    data: { passwordHash }
  });

  await authRepository.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  await revokeAllSessions(record.userId);

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: req.ip ?? null,
    action: 'PASSWORD_RESET_SUCCESS',
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId: req.id
  });

  clearAuthCookies(res);
  res.json({ ok: true, request_id: req.id });
});

phoneRouter.post('/phone/start', phoneStartLimiter, async (req, res) => {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  let userId: string | null = null;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = payload.sub;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }

    try {
      const payload = verifyChallengeToken(token);
      if (payload.type !== 'onboarding' || payload.stage !== 'phone') {
        res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
        return;
      }
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
      return;
    }
  }
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const parseResult = phoneStartSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const acceptLanguage = normalizeHeader(req.headers['accept-language']);
  const defaultCountry = await resolveDefaultCountry(userId, parseResult.data.country, acceptLanguage);
  const normalizedPhone = normalizePhoneE164(parseResult.data.phoneE164, {
    defaultCountry: defaultCountry ?? null
  });
  if (!normalizedPhone) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }
  const phoneE164 = normalizedPhone.normalized;
  const meta = getRequestMeta(req);

  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.phone_start,
    email: null,
    ip: meta.ip ?? null,
    captchaToken: req.body?.captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
    return;
  }

  await authRepository.phoneVerification.updateMany({
    where: { userId, phoneE164, status: 'pending' },
    data: { status: 'expired' }
  });

  let verification;
  try {
    verification = await startPhoneVerification(phoneE164);
  } catch {
    await recordAuthAttempt({
      type: AuthAttemptType.phone_start,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip,
      action: 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164, reason: 'PROVIDER_ERROR' },
      requestId: req.id
    });
    res.status(502).json({ error: 'PHONE_VERIFY_FAILED', request_id: req.id });
    return;
  }

  await authRepository.phoneVerification.create({
    data: {
      userId,
      phoneE164,
      providerSid: verification.sid,
      status: 'pending',
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  await recordAuthAttempt({
    type: AuthAttemptType.phone_start,
    email: null,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: meta.ip,
    action: 'PHONE_VERIFY_START',
    targetType: 'user',
    targetId: userId,
    metadata: { phone: phoneE164 },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

phoneRouter.post('/phone/check', phoneCheckLimiter, async (req, res) => {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  let userId: string | null = null;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = payload.sub;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }

    try {
      const payload = verifyChallengeToken(token);
      if (payload.type !== 'onboarding' || payload.stage !== 'phone') {
        res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
        return;
      }
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
      return;
    }
  }
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const parseResult = phoneCheckSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const acceptLanguage = normalizeHeader(req.headers['accept-language']);
  const defaultCountry = await resolveDefaultCountry(userId, parseResult.data.country, acceptLanguage);
  const normalizedPhone = normalizePhoneE164(parseResult.data.phoneE164, {
    defaultCountry: defaultCountry ?? null
  });
  if (!normalizedPhone) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }
  const phoneE164 = normalizedPhone.normalized;
  const { code } = parseResult.data;
  const meta = getRequestMeta(req);

  const captchaCheck = await enforceCaptchaIfNeeded({
    type: AuthAttemptType.phone_check,
    email: null,
    ip: meta.ip ?? null,
    captchaToken: req.body?.captchaToken
  });

  if (captchaCheck.required && !captchaCheck.valid) {
    res.status(403).json({ error: 'CAPTCHA_REQUIRED', captcha_required: true, request_id: req.id });
    return;
  }

  const limits = await getOtpRateLimits();
  const maxAttempts = limits.phoneCheck.maxAttempts;

  const existingVerification = await authRepository.phoneVerification.findFirst({
    where: { userId, phoneE164, status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });

  if (!existingVerification) {
    res.status(400).json({ error: 'PHONE_VERIFY_NOT_STARTED', request_id: req.id });
    return;
  }

  if (existingVerification.expiresAt < new Date()) {
    await authRepository.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: 'expired' }
    });
    res.status(400).json({ error: 'PHONE_VERIFY_EXPIRED', request_id: req.id });
    return;
  }

  if (existingVerification.attempts >= maxAttempts) {
    await authRepository.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: 'denied' }
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip,
      action: 'PHONE_VERIFY_LOCKED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164 },
      requestId: req.id
    });
    res.status(429).json({ error: 'PHONE_VERIFY_LOCKED', request_id: req.id });
    return;
  }

  let verification;
  try {
    verification = await checkPhoneVerification(phoneE164, code);
  } catch {
    await recordAuthAttempt({
      type: AuthAttemptType.phone_check,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });
    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip,
      action: 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164, reason: 'PROVIDER_ERROR' },
      requestId: req.id
    });
    res.status(502).json({ error: 'PHONE_VERIFY_FAILED', request_id: req.id });
    return;
  }
  const status = verification.status;
  const nextAttempts = existingVerification.attempts + 1;

  if (status !== 'approved') {
    const locked = nextAttempts >= maxAttempts;
    await authRepository.phoneVerification.update({
      where: { id: existingVerification.id },
      data: { status: locked ? 'denied' : 'pending', attempts: nextAttempts }
    });

    await recordAuthAttempt({
      type: AuthAttemptType.phone_check,
      email: null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      success: false,
      userId
    });

    await writeAuditLog({
      actorUserId: userId,
      actorIp: meta.ip,
      action: locked ? 'PHONE_VERIFY_LOCKED' : 'PHONE_VERIFY_FAILED',
      targetType: 'user',
      targetId: userId,
      metadata: { phone: phoneE164 },
      requestId: req.id
    });

    res.status(locked ? 429 : 400).json({
      error: locked ? 'PHONE_VERIFY_LOCKED' : 'PHONE_VERIFY_FAILED',
      request_id: req.id
    });
    return;
  }

  await authRepository.phoneVerification.update({
    where: { id: existingVerification.id },
    data: { status: 'approved', attempts: nextAttempts }
  });

  await authRepository.user.update({
    where: { id: userId },
    data: {
      phoneVerifiedAt: new Date(),
      status: UserStatus.active
    }
  });

  await recordAuthAttempt({
    type: AuthAttemptType.phone_check,
    email: null,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    success: true,
    userId
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: meta.ip,
    action: 'PHONE_VERIFIED',
    targetType: 'user',
    targetId: userId,
    metadata: { phone: phoneE164 },
    requestId: req.id
  });

  const sessionToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!sessionToken) {
    const user = await authRepository.user.findUnique({ where: { id: userId } });
    if (user) {
      const session = await createSession({
        userId: user.id,
        roles: user.roles as unknown as string[],
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null
      });
      setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
    }
  }

  clearOnboardingCookie(res);
  res.json({ ok: true, request_id: req.id });
});

mfaRouter.post('/mfa/setup/start', async (req, res) => {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  let userId: string | null = null;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = payload.sub;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }

    try {
      const payload = verifyChallengeToken(token);
      if (payload.type !== 'onboarding' || payload.stage !== 'mfa') {
        res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
        return;
      }
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
      return;
    }
  }
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await authRepository.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const { secret, otpauthUrl } = generateTotpSecret(user.email);
  const encrypted = encryptSecret(secret);

  await authRepository.mfaFactor.deleteMany({
    where: { userId: user.id, enabledAt: null }
  });

  await authRepository.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'totp',
      secretEncrypted: encrypted
    }
  });

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: req.ip ?? null,
    action: 'MFA_SETUP_START',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ otpauthUrl, request_id: req.id });
});

mfaRouter.post('/mfa/setup/confirm', async (req, res) => {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  let userId: string | null = null;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = payload.sub;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    const token = req.cookies?.[ONBOARDING_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
      return;
    }

    try {
      const payload = verifyChallengeToken(token);
      if (payload.type !== 'onboarding' || payload.stage !== 'mfa') {
        res.status(403).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
        return;
      }
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'ONBOARDING_INVALID', request_id: req.id });
      return;
    }
  }
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const parseResult = mfaSetupConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { code } = parseResult.data;
  const factor = await authRepository.mfaFactor.findFirst({
    where: { userId, enabledAt: null },
    orderBy: { createdAt: 'desc' }
  });

  if (!factor) {
    res.status(400).json({ error: 'MFA_SETUP_REQUIRED', request_id: req.id });
    return;
  }

  const secret = decryptSecret(factor.secretEncrypted);
  const valid = verifyTotpCode(code, secret);
  if (!valid) {
    res.status(400).json({ error: 'MFA_CODE_INVALID', request_id: req.id });
    return;
  }

  const backupCodes = Array.from({ length: 8 }, () => generateRandomToken(8));
  const backupCodeHashes = backupCodes.map((codeValue) => ({
    userId,
    codeHash: hashBackupCode(codeValue)
  }));

  await authRepository.$transaction([
    authRepository.mfaFactor.update({
      where: { id: factor.id },
      data: { enabledAt: new Date(), lastUsedAt: new Date() }
    }),
    authRepository.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, status: UserStatus.active }
    }),
    authRepository.backupCode.createMany({ data: backupCodeHashes })
  ]);

  const user = await authRepository.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const meta = getRequestMeta(req);

  const session = await createSession({
    userId: user.id,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
  clearOnboardingCookie(res);

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip,
    action: 'MFA_ENABLED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ backupCodes, request_id: req.id });
});

mfaRouter.post('/mfa/verify', async (req, res) => {
  const token = req.cookies?.[MFA_CHALLENGE_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'MFA_CHALLENGE_REQUIRED', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyChallengeToken(token);
  } catch {
    res.status(401).json({ error: 'MFA_CHALLENGE_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'mfa') {
    res.status(403).json({ error: 'MFA_CHALLENGE_INVALID', request_id: req.id });
    return;
  }

  const parseResult = mfaVerifySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { code } = parseResult.data;
  const factor = await authRepository.mfaFactor.findFirst({
    where: { userId: payload.sub, enabledAt: { not: null } },
    orderBy: { createdAt: 'desc' }
  });

  if (!factor) {
    res.status(400).json({ error: 'MFA_NOT_CONFIGURED', request_id: req.id });
    return;
  }

  const secret = decryptSecret(factor.secretEncrypted);
  const valid = verifyTotpCode(code, secret);
  if (!valid) {
    const backupHash = hashBackupCode(code);
    const backup = await authRepository.backupCode.findFirst({
      where: { userId: payload.sub, codeHash: backupHash, usedAt: null }
    });

    if (!backup) {
      await writeAuditLog({
        actorUserId: payload.sub,
        actorIp: req.ip ?? null,
        action: 'MFA_CHALLENGE_FAIL',
        targetType: 'user',
        targetId: payload.sub,
        metadata: {},
        requestId: req.id
      });
      res.status(400).json({ error: 'MFA_CODE_INVALID', request_id: req.id });
      return;
    }

    await authRepository.backupCode.update({
      where: { id: backup.id },
      data: { usedAt: new Date() }
    });
  }

  await authRepository.mfaFactor.update({
    where: { id: factor.id },
    data: { lastUsedAt: new Date() }
  });

  const user = await authRepository.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const meta = getRequestMeta(req);
  let knownDevice = false;
  if (meta.ip && meta.userAgent) {
    const existingSession = await authRepository.session.findFirst({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, ip: meta.ip, userAgent: meta.userAgent }
    });
    knownDevice = Boolean(existingSession);
  }
  const session = await createSession({
    userId: user.id,
    roles: user.roles as unknown as string[],
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null
  });

  setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
  clearMfaChallengeCookie(res);

  await writeAuditLog({
    actorUserId: user.id,
    actorIp: meta.ip,
    action: 'MFA_CHALLENGE_SUCCESS',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  await maybeSendLoginAlert({
    userId: user.id,
    email: user.email,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    emailEnabled: user.securityAlertEmailEnabled,
    smsEnabled: user.securityAlertSmsEnabled,
    requestId: req.id,
    knownDevice
  });

  res.json({ ok: true, request_id: req.id });
});

oauthRouter.get('/oauth/:provider/start', async (req, res) => {
  const providerParse = oauthProviderSchema.safeParse(req.params.provider);
  if (!providerParse.success) {
    res.status(400).json({ error: 'OAUTH_PROVIDER_INVALID', request_id: req.id });
    return;
  }

  const { state, nonce, verifier, authorizationUrl } = buildOAuthStart(providerParse.data);

  res.cookie(`oauth_state_${providerParse.data}`, state, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });
  res.cookie(`oauth_nonce_${providerParse.data}`, nonce, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });
  res.cookie(`oauth_verifier_${providerParse.data}`, verifier, {
    ...cookieOAuthOptions(),
    maxAge: 10 * 60 * 1000,
    signed: true
  });

  await writeAuditLog({
    actorUserId: null,
    actorIp: req.ip ?? null,
    action: 'OAUTH_START',
    targetType: 'oauth',
    targetId: providerParse.data,
    metadata: {},
    requestId: req.id
  });

  res.redirect(authorizationUrl);
});

oauthRouter.get('/oauth/debug', async (req, res) => {
  const normalizeIp = (value: string) => (value.startsWith('::ffff:') ? value.slice(7) : value);
  const requestIp = normalizeIp(req.ip ?? '');
  const allowlist = new Set(env.oauthDebugIpAllowlist.map(normalizeIp));

  if (env.isProduction || !env.oauthDebugEnabled || !allowlist.has(requestIp)) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  res.json({
    google: {
      redirect_uri: getOAuthRedirectUri('google'),
      client_id: env.oauthGoogleClientId
    },
    github: {
      redirect_uri: getOAuthRedirectUri('github'),
      client_id: env.oauthGithubClientId
    },
    oauth_redirect_base_url: env.oauthRedirectBaseUrl,
    app_base_url: env.appBaseUrl,
    request_id: req.id
  });
});

oauthRouter.get('/oauth/:provider/callback', async (req, res) => {
  const redirectOAuthError = (reason?: string) => {
    const query = new URLSearchParams({
      status: 'error',
      request_id: req.id,
      ...(reason ? { reason } : {})
    }).toString();
    res.redirect(`${env.appBaseUrl}/oauth/callback?${query}`);
  };

  const providerParse = oauthProviderSchema.safeParse(req.params.provider);
  if (!providerParse.success) {
    redirectOAuthError();
    return;
  }

  const provider = providerParse.data;
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;

  if (!code || !state) {
    redirectOAuthError();
    return;
  }

  const stateCookie = req.signedCookies?.[`oauth_state_${provider}`] as string | undefined;
  const nonceCookie = req.signedCookies?.[`oauth_nonce_${provider}`] as string | undefined;
  const verifierCookie = req.signedCookies?.[`oauth_verifier_${provider}`] as string | undefined;

  if (!stateCookie || !nonceCookie || !verifierCookie || stateCookie !== state) {
    redirectOAuthError();
    return;
  }

  const nonceFromState = state.split('.')[1];
  if (!nonceFromState || nonceFromState !== nonceCookie) {
    redirectOAuthError();
    return;
  }

  const redirectUri = getOAuthRedirectUri(provider);

  res.clearCookie(`oauth_state_${provider}`, { ...cookieOAuthOptions(), signed: true });
  res.clearCookie(`oauth_nonce_${provider}`, { ...cookieOAuthOptions(), signed: true });
  res.clearCookie(`oauth_verifier_${provider}`, { ...cookieOAuthOptions(), signed: true });

  try {
    const token = await exchangeOAuthCode({
      provider,
      code,
      codeVerifier: verifierCookie,
      redirectUri
    });

    const profile = await fetchOAuthProfile({ provider, accessToken: token.accessToken });
    if (!profile.email) {
      redirectOAuthError();
      return;
    }

    const normalizedEmail = normalizeEmail(profile.email);
    let user = await authRepository.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    const emailVerified = profile.emailVerified || Boolean(user?.emailVerifiedAt);

    if (!emailVerified) {
      if (!user) {
        user = await authRepository.user.create({
          data: {
            email: normalizedEmail,
            status: UserStatus.pending_email,
            roles: ['user']
          }
        });
      }

      await authRepository.oAuthAccount.upsert({
        where: {
          oauth_accounts_provider_provider_user_id_key: {
            provider,
            providerUserId: profile.providerUserId
          }
        },
        update: {
          userId: user.id,
          emailAtProvider: normalizedEmail
        },
        create: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });

      await issueEmailVerification({
        userId: user.id,
        email: normalizedEmail,
        requestId: req.id,
        ip: req.ip ?? null
      });

      await writeAuditLog({
        actorUserId: user.id,
        actorIp: req.ip ?? null,
        action: 'OAUTH_EMAIL_UNVERIFIED',
        targetType: 'user',
        targetId: user.id,
        metadata: { provider },
        requestId: req.id
      });

      redirectOAuthError('email_not_verified');
      return;
    }

    if (user) {
      if (!user.emailVerifiedAt || user.status !== UserStatus.active) {
        await authRepository.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            status: UserStatus.active
          }
        });
      }

      await authRepository.oAuthAccount.upsert({
        where: {
          oauth_accounts_provider_provider_user_id_key: {
            provider,
            providerUserId: profile.providerUserId
          }
        },
        update: {
          userId: user.id,
          emailAtProvider: normalizedEmail
        },
        create: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });

      await writeAuditLog({
        actorUserId: user.id,
        actorIp: req.ip ?? null,
        action: 'OAUTH_LINKED',
        targetType: 'user',
        targetId: user.id,
        metadata: { provider },
        requestId: req.id
      });
    } else {
      user = await authRepository.user.create({
        data: {
          email: normalizedEmail,
          status: UserStatus.active,
          emailVerifiedAt: new Date(),
          roles: ['user']
        }
      });

      await authRepository.oAuthAccount.create({
        data: {
          provider,
          providerUserId: profile.providerUserId,
          userId: user.id,
          emailAtProvider: normalizedEmail
        }
      });

      await writeAuditLog({
        actorUserId: user.id,
        actorIp: req.ip ?? null,
        action: 'OAUTH_LINKED',
        targetType: 'user',
        targetId: user.id,
        metadata: { provider },
        requestId: req.id
      });

    }

    await writeAuditLog({
      actorUserId: user.id,
      actorIp: req.ip ?? null,
      action: 'OAUTH_CALLBACK_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      metadata: { provider },
      requestId: req.id
    });

    const redirectToFrontend = (next: string) => {
      const query = new URLSearchParams({ next }).toString();
      res.redirect(`${env.appBaseUrl}/oauth/callback?${query}`);
    };

    const hasProfileFields = Boolean(
      user.firstName && user.lastName && user.username && user.nationality
    );
    if (hasProfileFields && !user.onboardingCompletedAt) {
      user = await authRepository.user.update({
        where: { id: user.id },
        data: { onboardingCompletedAt: new Date(), status: UserStatus.active }
      });
    }

    const profileComplete = Boolean(user.onboardingCompletedAt);

    const policy = await getMfaPolicy();
    const mfaRequired = isMfaRequired(user, policy);

    if (profileComplete && mfaRequired && !user.mfaEnabled) {
      const meta = getRequestMeta(req);
      let knownDevice = false;
      if (meta.ip && meta.userAgent) {
        const existingSession = await authRepository.session.findFirst({
          where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, ip: meta.ip, userAgent: meta.userAgent }
        });
        knownDevice = Boolean(existingSession);
      }
      const session = await createSession({
        userId: user.id,
        roles: user.roles as unknown as string[],
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null
      });
      setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
      setOnboardingCookie(res, user.id, 'mfa');
      clearMfaChallengeCookie(res);
      await maybeSendLoginAlert({
        userId: user.id,
        email: user.email,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        emailEnabled: user.securityAlertEmailEnabled,
        smsEnabled: user.securityAlertSmsEnabled,
        requestId: req.id,
        knownDevice
      });
      redirectToFrontend('setup-mfa');
      return;
    }

    if (user.mfaEnabled && profileComplete) {
      setMfaChallengeCookie(res, user.id);
      redirectToFrontend('mfa-challenge');
      return;
    }

    const meta = getRequestMeta(req);
    let knownDevice = false;
    if (meta.ip && meta.userAgent) {
      const existingSession = await authRepository.session.findFirst({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, ip: meta.ip, userAgent: meta.userAgent }
      });
      knownDevice = Boolean(existingSession);
    }
    const session = await createSession({
      userId: user.id,
      roles: user.roles as unknown as string[],
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null
    });

    setAuthCookies(res, { accessToken: session.accessToken, refreshToken: session.refreshToken });
    clearOnboardingCookie(res);
    clearMfaChallengeCookie(res);
    await maybeSendLoginAlert({
      userId: user.id,
      email: user.email,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      emailEnabled: user.securityAlertEmailEnabled,
      smsEnabled: user.securityAlertSmsEnabled,
      requestId: req.id,
      knownDevice
    });
    redirectToFrontend(profileComplete ? 'dashboard' : 'complete-profile');
  } catch {
    await writeAuditLog({
      actorUserId: null,
      actorIp: req.ip ?? null,
      action: 'OAUTH_CALLBACK_FAIL',
      targetType: 'oauth',
      targetId: provider,
      metadata: {},
      requestId: req.id
    });

    redirectOAuthError();
  }
});

// ============================================
// OAuth Unlink Endpoint
// ============================================
const unlinkOAuthSchema = z.object({
  provider: z.enum(['google', 'github'])
});

oauthRouter.delete('/oauth/:provider', async (req, res) => {
  const parseResult = unlinkOAuthSchema.safeParse({ provider: req.params.provider });
  if (!parseResult.success) {
    res.status(400).json({ error: 'INVALID_PROVIDER', request_id: req.id });
    return;
  }

  const { provider } = parseResult.data;

  // Get user from access token
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!accessToken) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(accessToken);
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await authRepository.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      oauthAccounts: { select: { provider: true } }
    }
  });

  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  const oauthProviders = user.oauthAccounts.map((a: { provider: string }) => a.provider);
  const hasThisProvider = oauthProviders.includes(provider);

  if (!hasThisProvider) {
    res.status(400).json({ error: 'PROVIDER_NOT_LINKED', request_id: req.id });
    return;
  }

  const otherProvidersCount = oauthProviders.filter((p: string) => p !== provider).length;
  const hasPassword = Boolean(user.passwordHash);
  const hasVerifiedEmail = Boolean(user.emailVerifiedAt);

  // If this is the last OAuth provider and user has no password or unverified email
  if (otherProvidersCount === 0 && !hasPassword) {
    res.status(400).json({
      error: 'NEED_PASSWORD_FIRST',
      message: 'Vous devez définir un mot de passe avant de déconnecter ce provider.',
      request_id: req.id
    });
    return;
  }

  if (otherProvidersCount === 0 && !hasVerifiedEmail) {
    res.status(400).json({
      error: 'NEED_EMAIL_VERIFIED',
      message: 'Vous devez vérifier votre email avant de déconnecter ce provider.',
      request_id: req.id
    });
    return;
  }

  // Delete the OAuth account
  await authRepository.oAuthAccount.deleteMany({
    where: {
      userId,
      provider: provider as 'google' | 'github'
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'OAUTH_UNLINKED',
    targetType: 'oauth',
    targetId: provider,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

// ============================================
// Set Password for OAuth-only users
// ============================================
const setPasswordSchema = z.object({
  password: z.string().min(12).max(128),
  password_confirmation: z.string().min(12).max(128)
}).refine(data => data.password === data.password_confirmation, {
  message: 'passwords_do_not_match'
});

passwordRouter.post('/set-password', async (req, res) => {
  const parseResult = setPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parseResult.error.issues[0]?.message,
      request_id: req.id
    });
    return;
  }

  // Get user from access token
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!accessToken) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(accessToken);
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await authRepository.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  // Only allow if user doesn't have a password yet (OAuth-only user)
  if (user.passwordHash) {
    res.status(400).json({
      error: 'PASSWORD_ALREADY_SET',
      message: 'Vous avez déjà un mot de passe. Utilisez la réinitialisation.',
      request_id: req.id
    });
    return;
  }

  const passwordHash = await hashPassword(parseResult.data.password);
  await authRepository.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'PASSWORD_SET',
    targetType: 'user',
    targetId: userId,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

emailRouter.get('/email/change/verify', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  try {
    const payload = verifyEmailChangeToken(token);

    if (payload.type !== 'email_change' || !payload.newEmail) {
      res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
      return;
    }

    const { sub: userId, newEmail } = payload;

    // Verify user exists
    const user = await authRepository.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
      return;
    }

    // Verify new email is still available
    const existing = await authRepository.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      res.status(409).json({ error: 'EMAIL_UNAVAILABLE', message: 'Cet email est déjà pris.', request_id: req.id });
      return;
    }

    const confirmationToken = signActionConfirmationToken(
      {
        sub: userId,
        type: 'action_confirmation',
        action: 'email_change_verify',
        sourceTokenHash: hashToken(token),
        newEmail
      },
      5
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ confirmation_token: confirmationToken, request_id: req.id });
  } catch {
    res.status(400).json({ error: 'TOKEN_EXPIRED', request_id: req.id });
  }
});

emailRouter.post('/email/change/verify', async (req, res) => {
  const parseResult = actionConfirmationSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  let payload;
  try {
    payload = verifyActionConfirmationToken(parseResult.data.confirmation_token);
  } catch {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_change_verify' || !payload.newEmail) {
    res.status(400).json({ error: 'TOKEN_INVALID', request_id: req.id });
    return;
  }

  const { sub: userId, newEmail } = payload;

  const user = await authRepository.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'USER_NOT_FOUND', request_id: req.id });
    return;
  }

  const existing = await authRepository.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    res.status(409).json({ error: 'EMAIL_UNAVAILABLE', message: 'Cet email est déjà pris.', request_id: req.id });
    return;
  }

  await authRepository.user.update({
    where: { id: userId },
    data: {
      email: newEmail,
      emailVerifiedAt: new Date()
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: req.ip ?? null,
    action: 'EMAIL_CHANGED',
    targetType: 'user',
    targetId: userId,
    metadata: { new_email: newEmail },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

export const authRouteRouters = {
  registerRouter,
  loginRouter,
  passwordRouter,
  phoneRouter,
  mfaRouter,
  oauthRouter,
  emailRouter
};
