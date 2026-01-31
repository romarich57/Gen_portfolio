import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { requireAdmin, requireSuperAdmin } from '../middleware/adminAuth';
import { writeAuditLog } from '../services/audit';
import { encodeCursor, decodeCursor } from '../utils/pagination';
import { getBillingStatus } from '../services/billing';
import { applyRolesAndEntitlements, upsertSubscription } from '../services/billing';
import { stripe } from '../services/stripeClient';
import { PlanCode, SubscriptionStatus, Currency, UserStatus, UserRole, Prisma, GdprExportStatus, BillingInterval } from '@prisma/client';
import { adjustCredits, getCreditsSummary } from '../services/credits';
import { requestExport } from '../services/gdprExport';
import { requestDeletion, processDeletionJob } from '../services/gdprDeletion';
import { hashToken, generateRandomToken } from '../utils/crypto';
import { buildEmailHtml, buildEmailText, sendEmail, buildPasswordResetLink } from '../services/email';
import { revokeAllSessions } from '../services/session';

const router = Router();

router.use(requireAdmin);

const ROLE_ORDER: UserRole[] = ['super_admin', 'admin', 'vip', 'premium', 'user'];

function resolvePrimaryRole(roles: UserRole[] | string[]): UserRole {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return 'user';
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const localSafe = local.length <= 2 ? `${local[0] ?? ''}***` : `${local.slice(0, 2)}***`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const domainSuffix = domainParts.slice(1).join('.') || '';
  const domainSafe = domainName.length <= 2 ? `${domainName[0] ?? ''}***` : `${domainName.slice(0, 2)}***`;
  return `${localSafe}@${domainSafe}${domainSuffix ? `.${domainSuffix}` : ''}`;
}

const adminMeResponse = (user: { id: string; email: string; roles: UserRole[] }) => ({
  admin: {
    id: user.id,
    email_masked: maskEmail(user.email),
    role: resolvePrimaryRole(user.roles)
  },
  ui: {
    lang: 'fr'
  }
});

router.get('/me', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  res.json({ ...adminMeResponse({ id: user.id, email: user.email, roles: user.roles as UserRole[] }), request_id: req.id });
});

function dateRangeFilter(from?: string, to?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) {
      range.gte = parsed;
    }
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) {
      range.lte = parsed;
    }
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

async function countUsersByRole(role: UserRole) {
  return prisma.user.count({ where: { roles: { has: role } } });
}

async function buildTimeseries(days: number, query: (from: Date, to: Date) => Promise<number>) {
  const results: Array<{ date: string; value: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i + 1));
    const value = await query(start, end);
    results.push({ date: start.toISOString().slice(0, 10), value });
  }
  return results;
}

router.get('/overview', async (req, res) => {
  const [totalUsers, totalFree, totalPremium, totalVip, totalActiveSubs, exports24h] = await Promise.all([
    prisma.user.count(),
    countUsersByRole('user'),
    countUsersByRole('premium'),
    countUsersByRole('vip'),
    prisma.subscription.count({ where: { status: SubscriptionStatus.active } }),
    prisma.gdprExport.count({ where: { requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
  ]);

  const signups7 = await buildTimeseries(7, (from, to) =>
    prisma.user.count({ where: { createdAt: { gte: from, lt: to } } })
  );

  const upgrades7 = await buildTimeseries(7, (from, to) =>
    prisma.roleGrant.count({ where: { grantedAt: { gte: from, lt: to }, role: { in: ['premium', 'vip'] } } })
  );

  const churn7 = await buildTimeseries(7, (from, to) =>
    prisma.subscription.count({ where: { status: SubscriptionStatus.canceled, updatedAt: { gte: from, lt: to } } })
  );

  res.json({
    totals: {
      total_users: totalUsers,
      total_users_free: totalFree,
      total_users_premium: totalPremium,
      total_users_vip: totalVip,
      total_active_subscriptions: totalActiveSubs,
      total_exports_24h: exports24h
    },
    timeseries: {
      signups_per_day: signups7,
      upgrades_per_day: upgrades7,
      churn_per_day: churn7
    },
    request_id: req.id
  });
});

const usersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(['user', 'premium', 'vip', 'admin', 'super_admin']).optional(),
  status: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

router.get('/users', async (req, res) => {
  const parseResult = usersQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { q, role, status, created_from, created_to, limit, cursor } = parseResult.data;
  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } }
    ];
  }

  if (role) {
    where.roles = { has: role as UserRole };
  }

  if (status) {
    if (status === 'deleted') {
      where.deletedAt = { not: null };
    } else {
      where.status = status as UserStatus;
    }
  }

  const dateRange = dateRangeFilter(created_from, created_to);
  if (dateRange) {
    where.createdAt = dateRange;
  }

  const cursorPayload = decodeCursor(cursor);
  if (cursorPayload) {
    const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...andFilters,
      {
        OR: [
          { createdAt: { lt: cursorPayload.createdAt } },
          { createdAt: cursorPayload.createdAt, id: { lt: cursorPayload.id } }
        ]
      }
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1
  });

  const hasMore = users.length > limit;
  const items = (hasMore ? users.slice(0, limit) : users).map((user) => ({
    id: user.id,
    username: user.username,
    role: resolvePrimaryRole(user.roles as UserRole[]),
    status: user.deletedAt ? 'deleted' : user.status,
    created_at: user.createdAt,
    email_masked: maskEmail(user.email),
    flags: { email_verified: Boolean(user.emailVerifiedAt) }
  }));

  const nextItem = hasMore ? users[limit] : null;
  const nextCursor = nextItem ? encodeCursor({ createdAt: nextItem.createdAt, id: nextItem.id }) : null;

  res.json({ items, nextCursor, request_id: req.id });
});

router.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const billing = await getBillingStatus(user.id);
  const sessionsCount = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });

  res.json({
    id: user.id,
    profile: {
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username,
      nationality: user.nationality,
      status: user.deletedAt ? 'deleted' : user.status,
      roles: user.roles,
      created_at: user.createdAt,
      email_masked: maskEmail(user.email)
    },
    billing,
    sessions_count: sessionsCount,
    credits_balance: user.creditsBalance,
    flags: {
      email_verified: Boolean(user.emailVerifiedAt),
      phone_verified: Boolean(user.phoneVerifiedAt),
      mfa_enabled: Boolean(user.mfaEnabled),
      deleted: Boolean(user.deletedAt)
    },
    request_id: req.id
  });
});

const revealSchema = z.object({
  fields: z.array(z.string()).min(1),
  confirm: z.string()
});

router.post('/users/:id/reveal', async (req, res) => {
  const parseResult = revealSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  if (parseResult.data.confirm !== 'AFFICHER') {
    res.status(403).json({ error: 'CONFIRM_REQUIRED', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const response: Record<string, string> = {};
  if (parseResult.data.fields.includes('email')) {
    response.email_full = user.email;
  }

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_REVEAL_SENSITIVE',
    targetType: 'user',
    targetId: user.id,
    metadata: { fields: parseResult.data.fields },
    requestId: req.id
  });

  res.json({ ...response, request_id: req.id });
});

const roleSchema = z.object({
  role: z.enum(['user', 'premium', 'vip', 'admin', 'super_admin'])
});

router.patch('/users/:id/role', async (req, res) => {
  const parseResult = roleSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const desired = parseResult.data.role as UserRole;
  const actorRoles = req.user?.roles ?? [];
  const actorIsSuper = actorRoles.includes('super_admin');

  if ((desired === 'admin' || desired === 'super_admin') && !actorIsSuper) {
    res.status(403).json({ error: 'FORBIDDEN', request_id: req.id });
    return;
  }

  if (!actorIsSuper && (target.roles as UserRole[]).some((r) => r === 'admin' || r === 'super_admin')) {
    res.status(403).json({ error: 'FORBIDDEN', request_id: req.id });
    return;
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { roles: [desired] }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_ROLE_CHANGED',
    targetType: 'user',
    targetId: target.id,
    metadata: { role: desired },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

const statusSchema = z.object({
  status_action: z.enum(['ban', 'unban', 'deactivate', 'reactivate'])
});

router.patch('/users/:id/status', async (req, res) => {
  const parseResult = statusSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const action = parseResult.data.status_action;
  const nextStatus = action === 'ban' || action === 'deactivate' ? UserStatus.banned : UserStatus.active;

  await prisma.user.update({
    where: { id: user.id },
    data: { status: nextStatus }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_STATUS_CHANGED',
    targetType: 'user',
    targetId: user.id,
    metadata: { status_action: action, status: nextStatus },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

const passwordResetSchema = z.object({
  mode: z.enum(['force_reset', 'send_link'])
});

router.post('/users/:id/password/reset', async (req, res) => {
  const parseResult = passwordResetSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const mode = parseResult.data.mode;
  let emailSent = false;

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  if (mode === 'force_reset') {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: null }
    });
    await revokeAllSessions(user.id);
  }

  try {
    const resetLink = buildPasswordResetLink(rawToken);
    await sendEmail({
      to: user.email,
      subject: 'Reinitialisation de mot de passe',
      text: buildEmailText({
        title: 'Reinitialisation de mot de passe',
        intro: 'Cliquez sur le lien pour reinitialiser votre mot de passe.',
        actionLabel: 'Reinitialiser',
        actionUrl: resetLink,
        preview: 'Reinitialisation du mot de passe.',
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      }),
      html: buildEmailHtml({
        title: 'Reinitialisation de mot de passe',
        intro: 'Cliquez sur le lien pour reinitialiser votre mot de passe.',
        actionLabel: 'Reinitialiser',
        actionUrl: resetLink,
        preview: 'Reinitialisation du mot de passe.',
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      })
    });
    emailSent = true;
  } catch {
    emailSent = false;
  }

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_PASSWORD_RESET_TRIGGERED',
    targetType: 'user',
    targetId: user.id,
    metadata: { mode, email_sent: emailSent },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/users/:id/email/verify/force', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), status: user.status === UserStatus.banned ? user.status : UserStatus.active }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_FORCE_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/users/:id/email/verify/revoke', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: null, status: user.status === UserStatus.banned ? user.status : UserStatus.pending_email }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_REVOKE_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

const sessionsRevokeSchema = z.object({
  mode: z.enum(['all', 'current']).optional()
});

router.post('/users/:id/sessions/revoke', async (req, res) => {
  const parseResult = sessionsRevokeSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const mode = parseResult.data.mode ?? 'all';
  if (mode === 'current') {
    const latest = await prisma.session.findFirst({
      where: { userId: user.id, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' }
    });
    if (latest) {
      await prisma.session.update({ where: { id: latest.id }, data: { revokedAt: new Date() } });
    }
  } else {
    await revokeAllSessions(user.id);
  }

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_SESSIONS_REVOKED',
    targetType: 'user',
    targetId: user.id,
    metadata: { mode },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/users/:id/gdpr/export', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const exportRecord = await requestExport({ userId: user.id });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_GDPR_EXPORT_REQUESTED',
    targetType: 'gdpr_export',
    targetId: exportRecord.id,
    metadata: {},
    requestId: req.id
  });

  res.json({ ok: true, export_id: exportRecord.id, request_id: req.id });
});

router.post('/users/:id/delete', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const deletion = await requestDeletion(user.id);

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_SOFT_DELETE',
    targetType: 'user',
    targetId: user.id,
    metadata: { deletion_id: deletion.id },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.post('/users/:id/purge', async (req, res) => {
  const deletion = await prisma.deletionRequest.findFirst({
    where: { userId: req.params.id },
    orderBy: { requestedAt: 'desc' }
  });
  if (!deletion) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  if (deletion.scheduledFor > new Date()) {
    res.status(409).json({ error: 'PURGE_NOT_READY', request_id: req.id });
    return;
  }

  await processDeletionJob({ userId: deletion.userId, deletionRequestId: deletion.id });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_PURGE',
    targetType: 'user',
    targetId: deletion.userId,
    metadata: { deletion_id: deletion.id },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.get('/plans', async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { amountCents: 'asc' } });
  res.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name_fr: plan.name,
      currency: plan.currency,
      monthly_price_eur_cents: plan.amountCents,
      project_limit: plan.projectLimit,
      credits_monthly: plan.creditsMonthly,
      stripe_product_id: plan.stripeProductId,
      stripe_price_id: plan.stripePriceId,
      is_active: plan.isActive,
      interval: plan.interval,
      features: plan.features
    })),
    request_id: req.id
  });
});

const planCreateSchema = z.object({
  code: z.enum(['FREE', 'PREMIUM', 'VIP']),
  name_fr: z.string().min(2).max(64),
  price_eur_cents: z.number().int().min(0),
  project_limit: z.number().int().nullable().optional(),
  credits_monthly: z.number().int().nullable().optional(),
  create_stripe: z.boolean().optional()
});

router.post('/plans', requireSuperAdmin, async (req, res) => {
  const parseResult = planCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { code, name_fr, price_eur_cents, project_limit, credits_monthly, create_stripe } = parseResult.data;

  let stripeProductId: string | null = null;
  let stripePriceId: string | null = null;

  if (create_stripe) {
    if (env.isTest) {
      stripeProductId = `prod_test_${code}`;
      stripePriceId = `price_test_${code}`;
    } else {
      const product = await stripe.products.create({ name: name_fr, metadata: { plan_code: code } });
      stripeProductId = product.id;
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: price_eur_cents,
        currency: 'eur',
        recurring: { interval: 'month' },
        metadata: { plan_code: code }
      });
      stripePriceId = price.id;
    }
  }

  const plan = await prisma.plan.create({
    data: {
      code: code as PlanCode,
      name: name_fr,
      currency: Currency.EUR,
      amountCents: price_eur_cents,
      interval: BillingInterval.month,
      projectLimit: project_limit ?? null,
      creditsMonthly: credits_monthly ?? null,
      stripeProductId: stripeProductId ?? null,
      stripePriceId: stripePriceId ?? null,
      isActive: true
    }
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_PLAN_CREATED',
    targetType: 'plan',
    targetId: plan.id,
    metadata: { code: plan.code },
    requestId: req.id
  });

  res.status(201).json({ id: plan.id, request_id: req.id });
});

const planUpdateSchema = z.object({
  name_fr: z.string().min(2).max(64).optional(),
  price_eur_cents: z.number().int().min(0).optional(),
  project_limit: z.number().int().nullable().optional(),
  credits_monthly: z.number().int().nullable().optional(),
  is_active: z.boolean().optional(),
  create_new_price: z.boolean().optional()
});

router.patch('/plans/:planId', requireSuperAdmin, async (req, res) => {
  const parseResult = planUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const planId = req.params.planId;
  if (!planId || Array.isArray(planId)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const updates: Prisma.PlanUpdateInput = {};
  const data = parseResult.data;
  if (data.name_fr) updates.name = data.name_fr;
  if (typeof data.project_limit !== 'undefined') updates.projectLimit = data.project_limit ?? null;
  if (typeof data.credits_monthly !== 'undefined') updates.creditsMonthly = data.credits_monthly ?? null;
  if (typeof data.is_active !== 'undefined') updates.isActive = data.is_active;

  if (typeof data.price_eur_cents === 'number') {
    updates.amountCents = data.price_eur_cents;
    if (data.create_new_price) {
      if (!plan.stripeProductId) {
        const product = env.isTest
          ? { id: `prod_test_${plan.code}` }
          : await stripe.products.create({ name: data.name_fr ?? plan.name, metadata: { plan_code: plan.code } });
        updates.stripeProductId = product.id;
      }

      if (!env.isTest) {
        const price = await stripe.prices.create({
          product: (updates.stripeProductId as string) ?? plan.stripeProductId!,
          unit_amount: data.price_eur_cents,
          currency: 'eur',
          recurring: { interval: 'month' },
          metadata: { plan_code: plan.code }
        });
        updates.stripePriceId = price.id;
      } else {
        updates.stripePriceId = `price_test_${plan.code}_${Date.now()}`;
      }
    }
  }

  await prisma.plan.update({ where: { id: plan.id }, data: updates });

  const auditUpdates = Object.fromEntries(
    Object.entries(parseResult.data).filter(([, value]) => typeof value !== 'undefined')
  );

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_PLAN_UPDATED',
    targetType: 'plan',
    targetId: plan.id,
    metadata: { updates: auditUpdates },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

const couponSchema = z.object({
  percent_off: z.number().int().min(1).max(100).optional(),
  amount_off: z.number().int().min(1).optional(),
  duration: z.enum(['once', 'repeating', 'forever']),
  code: z.string().min(3).max(40)
});

router.post('/stripe/coupons', requireSuperAdmin, async (req, res) => {
  const parseResult = couponSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { percent_off, amount_off, duration, code } = parseResult.data;
  if (!percent_off && !amount_off) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  if (env.isTest) {
    await writeAuditLog({
      actorUserId: req.user?.id ?? null,
      actorIp: req.ip ?? null,
      action: 'ADMIN_COUPON_CREATED',
      targetType: 'stripe',
      targetId: code,
      metadata: { duration },
      requestId: req.id
    });
    res.status(201).json({ coupon_id: `coupon_test_${code}`, promo_code_id: `promo_${code}`, request_id: req.id });
    return;
  }

  const couponPayload: Record<string, unknown> = { duration };
  if (typeof percent_off === 'number') {
    couponPayload.percent_off = percent_off;
  }
  if (typeof amount_off === 'number') {
    couponPayload.amount_off = amount_off;
    couponPayload.currency = 'eur';
  }

  const coupon = await stripe.coupons.create(couponPayload);
  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_COUPON_CREATED',
    targetType: 'stripe',
    targetId: coupon.id,
    metadata: { promotion_code: promo.id, code },
    requestId: req.id
  });

  res.status(201).json({ coupon_id: coupon.id, promo_code_id: promo.id, request_id: req.id });
});

const subscriptionChangeSchema = z.object({
  plan_code: z.enum(['FREE', 'PREMIUM', 'VIP']),
  proration: z.boolean().optional()
});

router.post('/users/:id/subscription/change', async (req, res) => {
  const parseResult = subscriptionChangeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }

  const plan = await prisma.plan.findFirst({ where: { code: parseResult.data.plan_code as PlanCode } });
  if (!plan) {
    res.status(404).json({ error: 'PLAN_NOT_FOUND', request_id: req.id });
    return;
  }

  const existing = await prisma.subscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } });
  let stripeSubscriptionId = existing?.stripeSubscriptionId ?? null;

  if (!env.isTest) {
    if (plan.code !== PlanCode.FREE && !plan.stripePriceId) {
      res.status(400).json({ error: 'PLAN_NOT_CONFIGURED', request_id: req.id });
      return;
    }

    if (stripeSubscriptionId) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ price: plan.stripePriceId! }],
        proration_behavior: parseResult.data.proration === false ? 'none' : 'create_prorations'
      });
    } else if (plan.code !== PlanCode.FREE) {
      const customer = await prisma.stripeCustomer.findUnique({ where: { userId: user.id } });
      if (!customer) {
        res.status(400).json({ error: 'CUSTOMER_NOT_FOUND', request_id: req.id });
        return;
      }
      const subscription = await stripe.subscriptions.create({
        customer: customer.stripeCustomerId,
        items: [{ price: plan.stripePriceId! }],
        proration_behavior: parseResult.data.proration === false ? 'none' : 'create_prorations'
      });
      stripeSubscriptionId = subscription.id;
    }
  }

  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const subId = stripeSubscriptionId ?? `sub_test_${user.id}`;

  await upsertSubscription({
    userId: user.id,
    stripeSubscriptionId: subId,
    planCode: plan.code,
    status: plan.code === PlanCode.FREE ? SubscriptionStatus.canceled : SubscriptionStatus.active,
    currency: Currency.EUR,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false
  });

  await applyRolesAndEntitlements({
    userId: user.id,
    planCode: plan.code,
    periodStart,
    periodEnd,
    reason: 'admin.subscription.change'
  });

  await writeAuditLog({
    actorUserId: req.user?.id ?? null,
    actorIp: req.ip ?? null,
    action: 'ADMIN_SUBSCRIPTION_CHANGED',
    targetType: 'subscription',
    targetId: user.id,
    metadata: { plan_code: plan.code },
    requestId: req.id
  });

  res.json({ ok: true, request_id: req.id });
});

router.get('/users/:id/credits', async (req, res) => {
  const summary = await getCreditsSummary(req.params.id);
  if (!summary) {
    res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
    return;
  }
  res.json({ balance: summary.balance, ledger: summary.ledger, request_id: req.id });
});

const creditsAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(3).max(120)
});

router.post('/users/:id/credits/adjust', async (req, res) => {
  const parseResult = creditsAdjustSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  try {
    const result = await adjustCredits({
      userId: req.params.id,
      delta: parseResult.data.delta,
      reason: parseResult.data.reason,
      adminId: req.user?.id ?? null
    });

    await writeAuditLog({
      actorUserId: req.user?.id ?? null,
      actorIp: req.ip ?? null,
      action: 'ADMIN_CREDITS_ADJUSTED',
      targetType: 'user',
      targetId: req.params.id,
      metadata: { delta: parseResult.data.delta, reason: parseResult.data.reason },
      requestId: req.id
    });

    res.json({ balance: result.balance, request_id: req.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDITS_INSUFFICIENT') {
      res.status(400).json({ error: 'CREDITS_INSUFFICIENT', request_id: req.id });
      return;
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'NOT_FOUND', request_id: req.id });
      return;
    }
    throw error;
  }
});

const auditQuerySchema = z.object({
  userId: z.string().optional(),
  action_type: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

router.get('/audit', async (req, res) => {
  const parseResult = auditQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { userId, action_type, created_from, created_to, limit, cursor } = parseResult.data;
  const where: Prisma.AuditLogWhereInput = {};

  if (userId) {
    where.OR = [{ actorUserId: userId }, { targetId: userId }];
  }

  if (action_type) {
    where.action = action_type;
  }

  const range = dateRangeFilter(created_from, created_to);
  if (range) {
    where.timestamp = range;
  }

  const cursorPayload = decodeCursor(cursor);
  if (cursorPayload) {
    const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...andFilters,
      {
        OR: [
          { timestamp: { lt: cursorPayload.createdAt } },
          { timestamp: cursorPayload.createdAt, id: { lt: cursorPayload.id } }
        ]
      }
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit + 1
  });

  const hasMore = logs.length > limit;
  const items = (hasMore ? logs.slice(0, limit) : logs).map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    actor_user_id: log.actorUserId,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    metadata: log.metadata
  }));

  const nextLog = hasMore ? logs[limit] : null;
  const nextCursor = nextLog ? encodeCursor({ createdAt: nextLog.timestamp, id: nextLog.id }) : null;

  res.json({ items, nextCursor, request_id: req.id });
});

const exportsQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.nativeEnum(GdprExportStatus).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

router.get('/exports', async (req, res) => {
  const parseResult = exportsQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', request_id: req.id });
    return;
  }

  const { userId, status, created_from, created_to, limit, cursor } = parseResult.data;
  const where: Prisma.GdprExportWhereInput = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  const range = dateRangeFilter(created_from, created_to);
  if (range) where.requestedAt = range;

  const cursorPayload = decodeCursor(cursor);
  if (cursorPayload) {
    const andFilters = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...andFilters,
      {
        OR: [
          { requestedAt: { lt: cursorPayload.createdAt } },
          { requestedAt: cursorPayload.createdAt, id: { lt: cursorPayload.id } }
        ]
      }
    ];
  }

  const exports = await prisma.gdprExport.findMany({
    where,
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1
  });

  const hasMore = exports.length > limit;
  const items = (hasMore ? exports.slice(0, limit) : exports).map((exp) => ({
    id: exp.id,
    user_id: exp.userId,
    status: exp.status,
    requested_at: exp.requestedAt,
    ready_at: exp.readyAt,
    expires_at: exp.expiresAt
  }));
  const nextExport = hasMore ? exports[limit] : null;
  const nextCursor = nextExport ? encodeCursor({ createdAt: nextExport.requestedAt, id: nextExport.id }) : null;

  res.json({ items, nextCursor, request_id: req.id });
});

export { router as adminApiRouter };
