import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { stripe } from './stripeClient';
import { logger } from '../middleware/logger';
import { PlanCode, Currency, PaymentStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import type { PrismaClient, Prisma, Plan } from '@prisma/client';
import { ensureFreeEntitlements, applyEntitlements } from './entitlements';
import { syncRolesForPlan } from './roleGrants';

type DbClient = Prisma.TransactionClient | PrismaClient;

type StripePlanOverride = {
  priceId: string | null;
  productId: string | null;
};

type CheckoutDebugDetails = Record<string, string | number | boolean | null>;

class CheckoutError extends Error {
  code: string;
  details: CheckoutDebugDetails | undefined;

  constructor(code: string, details?: CheckoutDebugDetails) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

export { CheckoutError };

// Plan hierarchy for upgrade/downgrade detection (higher = better)
const PLAN_HIERARCHY: Record<PlanCode, number> = {
  [PlanCode.FREE]: 0,
  [PlanCode.PREMIUM]: 1,
  [PlanCode.VIP]: 2
};

export type PlanChangeType = 'upgrade' | 'downgrade' | 'same' | 'new';

export function getPlanChangeType(currentPlan: PlanCode, targetPlan: PlanCode): PlanChangeType {
  const currentLevel = PLAN_HIERARCHY[currentPlan];
  const targetLevel = PLAN_HIERARCHY[targetPlan];

  if (targetLevel > currentLevel) return 'upgrade';
  if (targetLevel < currentLevel) return 'downgrade';
  return 'same';
}

function buildStripeErrorDetails(error: unknown): CheckoutDebugDetails | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const anyError = error as {
    type?: string;
    code?: string;
    message?: string;
    param?: string;
    requestId?: string;
    raw?: { requestId?: string };
  };
  const details: CheckoutDebugDetails = {};
  if (anyError.type) details.stripe_type = anyError.type;
  if (anyError.code) details.stripe_code = anyError.code;
  if (anyError.message) details.stripe_message = anyError.message;
  if (anyError.param) details.stripe_param = anyError.param;
  const requestId = anyError.requestId ?? anyError.raw?.requestId;
  if (requestId) details.stripe_request_id = requestId;
  return Object.keys(details).length > 0 ? details : undefined;
}

async function isStripePriceActive(priceId: string): Promise<boolean> {
  if (env.isTest) return true;
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product =
      typeof price.product === 'object' && price.product !== null ? (price.product as { active?: boolean }) : null;
    if (product && product.active === false) return false;
    return price.active === true;
  } catch {
    return false;
  }
}

async function ensureActiveStripePrice(plan: Plan): Promise<Plan> {
  if (env.isTest) return plan;
  let productId = plan.stripeProductId;
  let productActive = true;

  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      productActive = product.active;
    } catch {
      productActive = false;
    }
  }

  if (!productId || !productActive) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { plan_code: plan.code }
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.amountCents,
    currency: 'eur',
    recurring: { interval: 'month' },
    metadata: { plan_code: plan.code }
  });

  return prisma.plan.update({
    where: { id: plan.id },
    data: {
      stripeProductId: productId,
      stripePriceId: price.id
    }
  });
}

function getStripeOverride(planCode: PlanCode): StripePlanOverride {
  if (planCode === PlanCode.PREMIUM) {
    return {
      priceId: env.stripePriceIdPremium,
      productId: env.stripeProductIdPremium
    };
  }
  if (planCode === PlanCode.VIP) {
    return {
      priceId: env.stripePriceIdVip,
      productId: env.stripeProductIdVip
    };
  }
  return { priceId: null, productId: null };
}

async function applyStripeOverride(plan: Plan): Promise<Plan> {
  const override = getStripeOverride(plan.code);
  if (!override.priceId && !override.productId) return plan;

  if (override.priceId && !(await isStripePriceActive(override.priceId))) {
    logger.warn({ planCode: plan.code }, 'Stripe price override inactive, skipping');
    return plan;
  }

  const update: Prisma.PlanUpdateInput = {};
  if (override.priceId && override.priceId !== plan.stripePriceId) {
    update.stripePriceId = override.priceId;
  }
  if (override.productId && override.productId !== plan.stripeProductId) {
    update.stripeProductId = override.productId;
  }
  if (Object.keys(update).length === 0) return plan;

  return prisma.plan.update({ where: { id: plan.id }, data: update });
}

export async function syncStripePlanOverridesFromEnv(): Promise<void> {
  const overrides = [
    { code: PlanCode.PREMIUM, ...getStripeOverride(PlanCode.PREMIUM) },
    { code: PlanCode.VIP, ...getStripeOverride(PlanCode.VIP) }
  ].filter((entry) => entry.priceId || entry.productId);

  if (overrides.length === 0) return;

  const plans = await prisma.plan.findMany({
    where: { code: { in: overrides.map((entry) => entry.code) } }
  });

  for (const override of overrides) {
    const plan = plans.find((item) => item.code === override.code);
    if (!plan) {
      logger.warn({ planCode: override.code }, 'Stripe plan override skipped: plan missing');
      continue;
    }
    const updated = await applyStripeOverride(plan);
    if (updated.stripePriceId !== plan.stripePriceId || updated.stripeProductId !== plan.stripeProductId) {
      logger.info({ planCode: override.code }, 'Stripe plan override applied');
    }
  }
}

function mapStripeCheckoutError(error: unknown): string {
  if (error && typeof error === 'object') {
    const type = (error as { type?: string }).type;
    const param = (error as { param?: string }).param;
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message ?? '';
    if (type === 'StripeInvalidRequestError' && param === 'line_items[0][price]') {
      return 'PLAN_NOT_CONFIGURED';
    }
    if (code === 'customer_tax_location_invalid') {
      return 'STRIPE_ADDRESS_REQUIRED';
    }
    if (typeof message === 'string' && message.includes('automatic_tax')) {
      return 'STRIPE_TAX_NOT_ENABLED';
    }
  }
  return 'STRIPE_ERROR';
}

function mapStripeSubscriptionStatus(status?: string | null): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return SubscriptionStatus.trialing;
    case 'active':
      return SubscriptionStatus.active;
    case 'past_due':
      return SubscriptionStatus.past_due;
    case 'canceled':
      return SubscriptionStatus.canceled;
    case 'unpaid':
      return SubscriptionStatus.unpaid;
    case 'paused':
      return SubscriptionStatus.paused;
    case 'incomplete_expired':
      return SubscriptionStatus.incomplete_expired;
    case 'incomplete':
      return SubscriptionStatus.incomplete;
    default:
      return SubscriptionStatus.active;
  }
}

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

export async function getActiveSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.active, SubscriptionStatus.trialing, SubscriptionStatus.past_due] }
    },
    orderBy: { updatedAt: 'desc' }
  });
  return subscription;
}

export async function changePlan(params: {
  userId: string;
  userEmail: string;
  targetPlanCode: PlanCode;
}): Promise<{
  changeType: PlanChangeType;
  checkoutUrl?: string;
  effectiveAt?: Date;
  message: string;
}> {
  const { userId, userEmail, targetPlanCode } = params;

  // Get current subscription
  const currentSubscription = await getActiveSubscription(userId);
  const currentPlanCode = currentSubscription?.planCode ?? PlanCode.FREE;

  // Determine change type
  const changeType = currentSubscription
    ? getPlanChangeType(currentPlanCode, targetPlanCode)
    : 'new';

  if (changeType === 'same') {
    return {
      changeType: 'same',
      message: 'Vous avez déjà ce plan.'
    };
  }

  // Handle switch to FREE (Cancellation)
  if (targetPlanCode === PlanCode.FREE) {
    if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
      return {
        changeType: 'same',
        message: 'Vous êtes déjà en plan gratuit.'
      };
    }

    // Schedule cancellation at period end
    await stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update local state to reflect pending cancellation
    await prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        cancelAtPeriodEnd: true,
        scheduledPlanCode: PlanCode.FREE
      }
    });

    return {
      changeType: 'downgrade',
      effectiveAt: currentSubscription.currentPeriodEnd,
      message: `Votre abonnement s'arrêtera le ${currentSubscription.currentPeriodEnd.toLocaleDateString('fr-FR')}.`
    };
  }

  // Get target plan
  const targetPlan = await prisma.plan.findFirst({
    where: { code: targetPlanCode, isActive: true }
  });

  if (!targetPlan) {
    throw new CheckoutError('PLAN_INVALID');
  }

  // If no subscription exists or upgrading from FREE, create new checkout session
  if (!currentSubscription || currentPlanCode === PlanCode.FREE) {
    const session = await createCheckoutSession({
      userId,
      userEmail,
      planCode: targetPlanCode
    });
    return {
      changeType: 'new',
      checkoutUrl: session.url,
      message: 'Redirection vers le paiement.'
    };
  }

  // Ensure target plan has Stripe price
  let planWithPrice = targetPlan;
  if (!planWithPrice.stripePriceId) {
    planWithPrice = await applyStripeOverride(planWithPrice);
  }
  if (!planWithPrice.stripePriceId) {
    planWithPrice = await ensureActiveStripePrice(planWithPrice);
  }
  if (!planWithPrice.stripePriceId) {
    throw new CheckoutError('PLAN_NOT_CONFIGURED');
  }

  // Get Stripe subscription
  const stripeSubscriptionId = currentSubscription.stripeSubscriptionId;

  if (!stripeSubscriptionId) {
    throw new CheckoutError('SUBSCRIPTION_INVALID');
  }

  if (env.isTest) {
    // Mock for tests
    return {
      changeType,
      effectiveAt: changeType === 'downgrade'
        ? currentSubscription.currentPeriodEnd
        : new Date(),
      message: changeType === 'upgrade'
        ? 'Plan mis à jour immédiatement.'
        : 'Plan sera rétrogradé à la fin de la période.'
    };
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const currentItemId = stripeSubscription.items.data[0]?.id;

    if (!currentItemId) {
      throw new CheckoutError('SUBSCRIPTION_INVALID');
    }

    if (changeType === 'upgrade') {
      // UPGRADE: Immediate with prorata
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{
          id: currentItemId,
          price: planWithPrice.stripePriceId
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          plan_code: targetPlanCode,
          change_type: 'upgrade'
        }
      });

      // Update local subscription immediately
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planCode: targetPlanCode,
          scheduledPlanCode: null // Clear any scheduled downgrade
        }
      });

      // Apply roles immediately for upgrade
      await applyRolesAndEntitlements({
        userId,
        planCode: targetPlanCode,
        periodStart: currentSubscription.currentPeriodStart,
        periodEnd: currentSubscription.currentPeriodEnd,
        reason: 'plan_upgrade'
      });

      logger.info({ userId, from: currentPlanCode, to: targetPlanCode }, 'Plan upgraded');

      return {
        changeType: 'upgrade',
        effectiveAt: new Date(),
        message: 'Plan mis à jour immédiatement avec prorata.'
      };
    } else {
      // DOWNGRADE: Schedule for next billing period
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{
          id: currentItemId,
          price: planWithPrice.stripePriceId
        }],
        proration_behavior: 'none',
        billing_cycle_anchor: 'unchanged',
        metadata: {
          plan_code: targetPlanCode,
          change_type: 'downgrade',
          scheduled_plan: targetPlanCode,
          effective_at: currentSubscription.currentPeriodEnd.toISOString()
        }
      });

      // Record scheduled downgrade
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: { scheduledPlanCode: targetPlanCode }
      });

      logger.info({
        userId,
        from: currentPlanCode,
        to: targetPlanCode,
        effectiveAt: currentSubscription.currentPeriodEnd
      }, 'Plan downgrade scheduled');

      return {
        changeType: 'downgrade',
        effectiveAt: currentSubscription.currentPeriodEnd,
        message: `Plan sera rétrogradé le ${currentSubscription.currentPeriodEnd.toLocaleDateString('fr-FR')}.`
      };
    }
  } catch (error) {
    logger.error({ error, userId }, 'Failed to change plan');
    throw new CheckoutError('STRIPE_ERROR', buildStripeErrorDetails(error));
  }
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
  const rawPlan = await prisma.plan.findFirst({
    where: { code: params.planCode as PlanCode, isActive: true }
  });

  if (!rawPlan || rawPlan.code === PlanCode.FREE) {
    throw new CheckoutError('PLAN_INVALID', {
      plan_code: String(params.planCode),
      reason: rawPlan ? 'FREE_PLAN' : 'NOT_FOUND'
    });
  }

  const plan = await applyStripeOverride(rawPlan);

  if (!plan.stripePriceId || plan.currency !== Currency.EUR) {
    throw new CheckoutError('PLAN_NOT_CONFIGURED', {
      plan_code: plan.code,
      currency: plan.currency,
      stripe_price_id: plan.stripePriceId ?? null,
      stripe_product_id: plan.stripeProductId ?? null
    });
  }

  const stripeCustomerId = await ensureStripeCustomer({ userId: params.userId, email: params.userEmail });

  if (env.isTest) {
    return { url: `https://stripe.test/checkout/${plan.code}` };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      automatic_tax: { enabled: env.stripeTaxEnabled },
      customer_update: { address: 'auto' },
      success_url: `${env.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/billing`,
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
  } catch (error) {
    if (!env.isProduction && error && typeof error === 'object') {
      const type = (error as { type?: string }).type;
      const param = (error as { param?: string }).param;
      if (type === 'StripeInvalidRequestError' && param === 'line_items[0][price]') {
        logger.warn({ planCode: plan.code }, 'Stripe price invalid/inactive, creating new price (dev)');
        const refreshedPlan = await ensureActiveStripePrice(plan);
        const retrySession = await stripe.checkout.sessions.create({
          mode: 'subscription',
          customer: stripeCustomerId,
          line_items: [{ price: refreshedPlan.stripePriceId!, quantity: 1 }],
          automatic_tax: { enabled: env.stripeTaxEnabled },
          customer_update: { address: 'auto' },
          success_url: `${env.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env.appUrl}/billing`,
          metadata: {
            user_id: params.userId,
            plan_code: refreshedPlan.code,
            currency: refreshedPlan.currency,
            env: env.nodeEnv
          },
          client_reference_id: params.userId,
          subscription_data: {
            metadata: {
              user_id: params.userId,
              plan_code: refreshedPlan.code
            }
          }
        });
        session = retrySession;
      } else {
        throw new CheckoutError(mapStripeCheckoutError(error), buildStripeErrorDetails(error));
      }
    } else {
      throw new CheckoutError(mapStripeCheckoutError(error), buildStripeErrorDetails(error));
    }
  }

  if (!session.url) {
    throw new CheckoutError('CHECKOUT_URL_MISSING');
  }
  return { url: session.url };
}

export async function syncCheckoutSession(params: { sessionId: string; userId: string }) {
  if (env.isTest) {
    return { ok: true };
  }

  const session = await stripe.checkout.sessions.retrieve(params.sessionId, {
    expand: ['subscription', 'customer', 'line_items.data.price']
  });

  if (session.mode !== 'subscription') {
    throw new CheckoutError('SESSION_INVALID');
  }

  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  if (!stripeCustomerId) {
    throw new CheckoutError('SESSION_INVALID', { reason: 'MISSING_CUSTOMER' });
  }

  const customer = await prisma.stripeCustomer.findUnique({ where: { stripeCustomerId } });
  if (!customer || customer.userId !== params.userId) {
    throw new CheckoutError('CHECKOUT_FORBIDDEN', { reason: 'CUSTOMER_MISMATCH' });
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
  if (!subscriptionId) {
    throw new CheckoutError('SUBSCRIPTION_INVALID');
  }

  const subscription =
    typeof session.subscription === 'object' && session.subscription
      ? session.subscription
      : await stripe.subscriptions.retrieve(subscriptionId);

  const priceId =
    subscription.items.data[0]?.price?.id ?? session.line_items?.data?.[0]?.price?.id ?? null;
  if (!priceId) {
    throw new CheckoutError('PLAN_NOT_CONFIGURED', { reason: 'MISSING_PRICE' });
  }

  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId, isActive: true } });
  if (!plan) {
    throw new CheckoutError('PLAN_NOT_CONFIGURED', { reason: 'PRICE_MISMATCH', price_id: priceId });
  }

  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  await upsertSubscription({
    userId: customer.userId,
    stripeSubscriptionId: subscriptionId,
    planCode: plan.code,
    status: mapStripeSubscriptionStatus(subscription.status),
    currency: Currency.EUR,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null
  });

  await applyRolesAndEntitlements({
    userId: customer.userId,
    planCode: plan.code,
    periodStart,
    periodEnd,
    reason: 'checkout.sync'
  });

  return {
    ok: true,
    plan_code: plan.code,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false
  };
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
  const scheduledPlanCode = subscription?.scheduledPlanCode ?? null;

  let resolvedEntitlement = entitlement;
  if (!resolvedEntitlement) {
    resolvedEntitlement = await ensureFreeEntitlements(userId);
  }

  return {
    plan_code: planCode,
    scheduled_plan_code: scheduledPlanCode,
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
  const existing = await client.subscription.findFirst({
    where: { stripeSubscriptionId: params.stripeSubscriptionId }
  });
  const shouldClearScheduled =
    existing?.scheduledPlanCode && existing.scheduledPlanCode === params.planCode;
  return client.subscription.upsert({
    where: { stripeSubscriptionId: params.stripeSubscriptionId },
    update: {
      planCode: params.planCode,
      status: params.status,
      currency: params.currency,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      canceledAt: params.canceledAt ?? null,
      ...(shouldClearScheduled ? { scheduledPlanCode: null } : {})
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
