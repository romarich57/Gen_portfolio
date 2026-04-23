import {
  BillingInterval,
  Currency,
  PlanCode,
  SubscriptionStatus,
  type Prisma
} from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import { applyRolesAndEntitlements, upsertSubscription } from '../../../services/billing';
import { adjustCredits, getCreditsSummary } from '../../../services/credits';
import { stripe } from '../../../services/stripeClient';

type ActorContext = {
  actorUserId?: string | null | undefined;
  actorIp?: string | null | undefined;
};

export async function listPlans() {
  const plans = await prisma.plan.findMany({ orderBy: { amountCents: 'asc' } });
  return plans.map((plan) => ({
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
  }));
}

export async function createPlan(
  input: {
    code: 'FREE' | 'PREMIUM' | 'VIP';
    name_fr: string;
    price_eur_cents: number;
    project_limit?: number | null | undefined;
    credits_monthly?: number | null | undefined;
    create_stripe?: boolean | undefined;
  },
  actor: ActorContext,
  requestId: string
) {
  let stripeProductId: string | null = null;
  let stripePriceId: string | null = null;

  if (input.create_stripe) {
    if (env.isTest) {
      stripeProductId = `prod_test_${input.code}`;
      stripePriceId = `price_test_${input.code}`;
    } else {
      const product = await stripe.products.create({ name: input.name_fr, metadata: { plan_code: input.code } });
      stripeProductId = product.id;
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: input.price_eur_cents,
        currency: 'eur',
        recurring: { interval: 'month' },
        metadata: { plan_code: input.code }
      });
      stripePriceId = price.id;
    }
  }

  const plan = await prisma.plan.create({
    data: {
      code: input.code as PlanCode,
      name: input.name_fr,
      currency: Currency.EUR,
      amountCents: input.price_eur_cents,
      interval: BillingInterval.month,
      projectLimit: input.project_limit ?? null,
      creditsMonthly: input.credits_monthly ?? null,
      stripeProductId,
      stripePriceId,
      isActive: true
    }
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_PLAN_CREATED',
    targetType: 'plan',
    targetId: plan.id,
    metadata: { code: plan.code },
    requestId
  });

  return plan.id;
}

export async function updatePlan(
  planId: string,
  input: {
    name_fr?: string | undefined;
    price_eur_cents?: number | undefined;
    project_limit?: number | null | undefined;
    credits_monthly?: number | null | undefined;
    is_active?: boolean | undefined;
    create_new_price?: boolean | undefined;
  },
  actor: ActorContext,
  requestId: string
) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error('NOT_FOUND');
  }

  const updates: Prisma.PlanUpdateInput = {};
  if (input.name_fr) updates.name = input.name_fr;
  if (typeof input.project_limit !== 'undefined') updates.projectLimit = input.project_limit ?? null;
  if (typeof input.credits_monthly !== 'undefined') updates.creditsMonthly = input.credits_monthly ?? null;
  if (typeof input.is_active !== 'undefined') updates.isActive = input.is_active;

  if (typeof input.price_eur_cents === 'number') {
    updates.amountCents = input.price_eur_cents;
    if (input.create_new_price) {
      if (!plan.stripeProductId) {
        const product = env.isTest
          ? { id: `prod_test_${plan.code}` }
          : await stripe.products.create({ name: input.name_fr ?? plan.name, metadata: { plan_code: plan.code } });
        updates.stripeProductId = product.id;
      }

      if (env.isTest) {
        updates.stripePriceId = `price_test_${plan.code}_${Date.now()}`;
      } else {
        const price = await stripe.prices.create({
          product: (updates.stripeProductId as string) ?? plan.stripeProductId!,
          unit_amount: input.price_eur_cents,
          currency: 'eur',
          recurring: { interval: 'month' },
          metadata: { plan_code: plan.code }
        });
        updates.stripePriceId = price.id;
      }
    }
  }

  await prisma.plan.update({ where: { id: plan.id }, data: updates });

  const auditUpdates = Object.fromEntries(Object.entries(input).filter(([, value]) => typeof value !== 'undefined'));
  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_PLAN_UPDATED',
    targetType: 'plan',
    targetId: plan.id,
    metadata: { updates: auditUpdates },
    requestId
  });
}

export async function createStripeCoupon(
  input: {
    percent_off?: number | undefined;
    amount_off?: number | undefined;
    duration: 'once' | 'repeating' | 'forever';
    code: string;
  },
  actor: ActorContext,
  requestId: string
) {
  if (!input.percent_off && !input.amount_off) {
    throw new Error('VALIDATION_ERROR');
  }

  if (env.isTest) {
    await writeAuditLog({
      actorUserId: actor.actorUserId ?? null,
      actorIp: actor.actorIp ?? null,
      action: 'ADMIN_COUPON_CREATED',
      targetType: 'stripe',
      targetId: input.code,
      metadata: { duration: input.duration },
      requestId
    });
    return {
      coupon_id: `coupon_test_${input.code}`,
      promo_code_id: `promo_${input.code}`
    };
  }

  const couponPayload: Record<string, unknown> = { duration: input.duration };
  if (typeof input.percent_off === 'number') {
    couponPayload.percent_off = input.percent_off;
  }
  if (typeof input.amount_off === 'number') {
    couponPayload.amount_off = input.amount_off;
    couponPayload.currency = 'eur';
  }

  const coupon = await stripe.coupons.create(couponPayload);
  const promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: input.code
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_COUPON_CREATED',
    targetType: 'stripe',
    targetId: coupon.id,
    metadata: { promotion_code: promo.id, code: input.code },
    requestId
  });

  return { coupon_id: coupon.id, promo_code_id: promo.id };
}

export async function changeUserSubscription(
  userId: string,
  input: { plan_code: 'FREE' | 'PREMIUM' | 'VIP'; proration?: boolean | undefined },
  actor: ActorContext,
  requestId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const plan = await prisma.plan.findFirst({ where: { code: input.plan_code as PlanCode } });
  if (!plan) {
    throw new Error('PLAN_NOT_FOUND');
  }

  const existing = await prisma.subscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } });
  let stripeSubscriptionId = existing?.stripeSubscriptionId ?? null;

  if (!env.isTest) {
    if (plan.code !== PlanCode.FREE && !plan.stripePriceId) {
      throw new Error('PLAN_NOT_CONFIGURED');
    }

    if (stripeSubscriptionId) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ price: plan.stripePriceId! }],
        proration_behavior: input.proration === false ? 'none' : 'create_prorations'
      });
    } else if (plan.code !== PlanCode.FREE) {
      const customer = await prisma.stripeCustomer.findUnique({ where: { userId: user.id } });
      if (!customer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }
      const subscription = await stripe.subscriptions.create({
        customer: customer.stripeCustomerId,
        items: [{ price: plan.stripePriceId! }],
        proration_behavior: input.proration === false ? 'none' : 'create_prorations'
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
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_SUBSCRIPTION_CHANGED',
    targetType: 'subscription',
    targetId: user.id,
    metadata: { plan_code: plan.code },
    requestId
  });
}

export async function getUserCredits(userId: string) {
  const summary = await getCreditsSummary(userId);
  if (!summary) {
    throw new Error('NOT_FOUND');
  }
  return { balance: summary.balance, ledger: summary.ledger };
}

export async function adjustUserCredits(
  userId: string,
  delta: number,
  reason: string,
  actor: ActorContext,
  requestId: string
) {
  const result = await adjustCredits({
    userId,
    delta,
    reason,
    adminId: actor.actorUserId ?? null
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_CREDITS_ADJUSTED',
    targetType: 'user',
    targetId: userId,
    metadata: { delta, reason },
    requestId
  });

  return result.balance;
}
