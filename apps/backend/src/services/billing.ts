import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { stripe } from './stripeClient';
import { PlanCode, Currency, PaymentStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ensureFreeEntitlements, applyEntitlements } from './entitlements';
import { syncRolesForPlan } from './roleGrants';

type DbClient = Prisma.TransactionClient | PrismaClient;

export async function getPlans() {
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { amountCents: 'asc' } });
  return plans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    amount_cents: plan.amountCents,
    currency: plan.currency,
    interval: plan.interval,
    features: plan.features,
    is_active: plan.isActive
  }));
}

async function ensureStripeCustomer(params: { userId: string; email: string }) {
  const existing = await prisma.stripeCustomer.findUnique({ where: { userId: params.userId } });
  if (existing) return existing.stripeCustomerId;

  const customerId = env.isTest
    ? `cus_test_${params.userId}`
    : (await stripe.customers.create({ email: params.email, metadata: { user_id: params.userId } })).id;

  await prisma.stripeCustomer.create({
    data: {
      userId: params.userId,
      stripeCustomerId: customerId
    }
  });

  return customerId;
}

export async function createCheckoutSession(params: { userId: string; userEmail: string; planCode: PlanCode | string }) {
  const plan = await prisma.plan.findFirst({
    where: { code: params.planCode as PlanCode, isActive: true }
  });

  if (!plan || plan.code === PlanCode.FREE) {
    throw new Error('PLAN_INVALID');
  }

  if (!plan.stripePriceId || plan.currency !== Currency.EUR) {
    throw new Error('PLAN_NOT_CONFIGURED');
  }

  const stripeCustomerId = await ensureStripeCustomer({ userId: params.userId, email: params.userEmail });

  if (env.isTest) {
    return { url: `https://stripe.test/checkout/${plan.code}` };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    automatic_tax: { enabled: env.stripeTaxEnabled },
    success_url: `${env.appUrl}/billing/success`,
    cancel_url: `${env.appUrl}/billing/cancel`,
    metadata: {
      user_id: params.userId,
      plan_code: plan.code,
      currency: plan.currency,
      env: env.nodeEnv
    },
    client_reference_id: params.userId,
    subscription_data: {
      metadata: {
        user_id: params.userId,
        plan_code: plan.code
      }
    }
  });

  if (!session.url) {
    throw new Error('CHECKOUT_URL_MISSING');
  }
  return { url: session.url };
}

export async function createPortalSession(params: { userId: string }) {
  const customer = await prisma.stripeCustomer.findUnique({ where: { userId: params.userId } });
  if (!customer) {
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  if (env.isTest) {
    return { url: `https://stripe.test/portal/${customer.stripeCustomerId}` };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${env.appUrl}/settings/billing`,
    ...(env.stripeCustomerPortalConfigurationId
      ? { configuration: env.stripeCustomerPortalConfigurationId }
      : {})
  });

  return { url: session.url };
}

export async function getBillingStatus(userId: string) {
  const [user, subscription, entitlement] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.subscription.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    prisma.entitlement.findUnique({ where: { userId } })
  ]);

  const roles = user?.roles ?? [UserRole.user];
  const planCode = subscription?.planCode ?? PlanCode.FREE;
  const status = subscription?.status ?? SubscriptionStatus.active;
  const periodStart = subscription?.currentPeriodStart ?? entitlement?.periodStart;
  const periodEnd = subscription?.currentPeriodEnd ?? entitlement?.periodEnd;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  let resolvedEntitlement = entitlement;
  if (!resolvedEntitlement) {
    resolvedEntitlement = await ensureFreeEntitlements(userId);
  }

  return {
    plan_code: planCode,
    status,
    period_start: periodStart ?? resolvedEntitlement?.periodStart ?? null,
    period_end: periodEnd ?? resolvedEntitlement?.periodEnd ?? null,
    cancel_at_period_end: cancelAtPeriodEnd,
    entitlements: {
      projects_limit: resolvedEntitlement?.projectsLimit ?? 1,
      projects_used: resolvedEntitlement?.projectsUsed ?? 0,
      period_start: resolvedEntitlement?.periodStart ?? null,
      period_end: resolvedEntitlement?.periodEnd ?? null
    },
    roles
  };
}

export async function recordCheckoutPayment(params: {
  userId: string;
  checkoutSessionId: string;
  amountCents: number;
}, db?: DbClient) {
  const client = db ?? prisma;
  return client.payment.upsert({
    where: { stripeCheckoutSessionId: params.checkoutSessionId },
    update: {
      status: PaymentStatus.pending,
      amountCents: params.amountCents,
      currency: Currency.EUR
    },
    create: {
      userId: params.userId,
      stripeCheckoutSessionId: params.checkoutSessionId,
      amountCents: params.amountCents,
      currency: Currency.EUR,
      status: PaymentStatus.pending
    }
  });
}

export async function recordInvoicePayment(params: {
  userId: string;
  invoiceId: string;
  paymentIntentId: string | null;
  amountCents: number;
  status: PaymentStatus;
}, db?: DbClient) {
  const client = db ?? prisma;
  return client.payment.upsert({
    where: { stripeInvoiceId: params.invoiceId },
    update: {
      status: params.status,
      amountCents: params.amountCents,
      currency: Currency.EUR,
      stripePaymentIntentId: params.paymentIntentId ?? null
    },
    create: {
      userId: params.userId,
      stripeInvoiceId: params.invoiceId,
      stripePaymentIntentId: params.paymentIntentId ?? null,
      amountCents: params.amountCents,
      currency: Currency.EUR,
      status: params.status
    }
  });
}

export async function upsertSubscription(params: {
  userId: string;
  stripeSubscriptionId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  currency: Currency;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
}, db?: DbClient) {
  const client = db ?? prisma;
  return client.subscription.upsert({
    where: { stripeSubscriptionId: params.stripeSubscriptionId },
    update: {
      planCode: params.planCode,
      status: params.status,
      currency: params.currency,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      canceledAt: params.canceledAt ?? null
    },
    create: {
      userId: params.userId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      planCode: params.planCode,
      status: params.status,
      currency: params.currency,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      canceledAt: params.canceledAt ?? null
    }
  });
}

export async function applyRolesAndEntitlements(params: {
  userId: string;
  planCode: PlanCode;
  periodStart: Date;
  periodEnd: Date;
  reason: string;
}, db?: DbClient) {
  const roleChanges = await syncRolesForPlan(
    {
      userId: params.userId,
      planCode: params.planCode,
      reason: params.reason
    },
    db
  );
  const entitlement = await applyEntitlements(
    {
      userId: params.userId,
      planCode: params.planCode,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd
    },
    db
  );

  return { roleChanges, entitlement };
}
