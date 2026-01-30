import { Router } from 'express';
import { Prisma, PlanCode, Currency, SubscriptionStatus, PaymentStatus, WebhookStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { stripe } from '../services/stripeClient';
import { writeAuditLog } from '../services/audit';
import {
  applyRolesAndEntitlements,
  recordCheckoutPayment,
  recordInvoicePayment,
  upsertSubscription
} from '../services/billing';

const router = Router();

type DbClient = Prisma.TransactionClient | PrismaClient;

function toStripeEvent(reqBody: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(reqBody, signature, env.stripeWebhookSecret);
}

function mapSubscriptionStatus(status: string): SubscriptionStatus {
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
    default:
      return SubscriptionStatus.incomplete;
  }
}

async function resolvePlanByPrice(priceId: string, db?: DbClient) {
  const client = db ?? prisma;
  return client.plan.findFirst({ where: { stripePriceId: priceId, isActive: true } });
}

async function resolveUserByCustomer(stripeCustomerId: string, db?: DbClient) {
  const client = db ?? prisma;
  return client.stripeCustomer.findUnique({ where: { stripeCustomerId } });
}

async function handleCheckoutCompleted(event: Stripe.Event, db: DbClient) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== 'subscription') {
    return { status: 'ignored' as const };
  }

  const metadata = session.metadata || {};
  const userId = metadata.user_id;
  const planCode = metadata.plan_code as PlanCode | undefined;
  const currency = metadata.currency as Currency | undefined;

  if (!userId || !planCode || currency !== Currency.EUR) {
    await writeAuditLog(
      {
      actorUserId: null,
      actorIp: null,
      action: 'BILLING_WEBHOOK_MISMATCH',
      targetType: 'stripe_event',
      targetId: event.id,
      metadata: { reason: 'MISSING_METADATA' },
      requestId: null
    },
      db
    );
    return { status: 'failed' as const, errorMessage: 'MISSING_METADATA' };
  }

  if (!session.customer || typeof session.customer !== 'string') {
    return { status: 'failed' as const, errorMessage: 'MISSING_CUSTOMER' };
  }

  await db.stripeCustomer.upsert({
    where: { userId },
    update: { stripeCustomerId: session.customer },
    create: { userId, stripeCustomerId: session.customer }
  });

  await recordCheckoutPayment(
    {
      userId,
      checkoutSessionId: session.id,
      amountCents: session.amount_total ?? 0
    },
    db
  );

  await writeAuditLog(
    {
      actorUserId: userId,
      actorIp: null,
      action: 'BILLING_CHECKOUT_COMPLETED',
      targetType: 'stripe',
      targetId: session.id,
      metadata: { plan_code: planCode },
      requestId: null
    },
    db
  );

  return { status: 'processed' as const };
}

async function handleInvoicePaid(event: Stripe.Event, db: DbClient) {
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.currency?.toUpperCase() !== Currency.EUR) {
    await writeAuditLog(
      {
      actorUserId: null,
      actorIp: null,
      action: 'BILLING_WEBHOOK_MISMATCH',
      targetType: 'stripe_event',
      targetId: event.id,
      metadata: { reason: 'CURRENCY_MISMATCH' },
      requestId: null
    },
      db
    );
    return { status: 'failed' as const, errorMessage: 'CURRENCY_MISMATCH' };
  }

  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed' as const, errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subscriptionId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_SUBSCRIPTION' };
  }

  const line =
    invoice.lines?.data?.find((item) => item.type === 'subscription' && item.price?.id) ??
    invoice.lines?.data?.find((item) => item.price?.id);
  const priceId = line?.price?.id;
  if (!priceId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_PRICE' };
  }

  const plan = await resolvePlanByPrice(priceId, db);
  if (!plan || plan.currency !== Currency.EUR) {
    await writeAuditLog(
      {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_WEBHOOK_MISMATCH',
      targetType: 'stripe_event',
      targetId: event.id,
      metadata: { reason: 'PRICE_MISMATCH', price_id: priceId },
      requestId: null
    },
      db
    );
    return { status: 'failed' as const, errorMessage: 'PRICE_MISMATCH' };
  }

  const periodStart = new Date((line?.period?.start ?? invoice.period_start ?? 0) * 1000);
  const periodEnd = new Date((line?.period?.end ?? invoice.period_end ?? 0) * 1000);
  const existingSub = await db.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId }
  });

  await upsertSubscription(
    {
      userId: customer.userId,
      stripeSubscriptionId: subscriptionId,
      planCode: plan.code,
      status: SubscriptionStatus.active,
      currency: Currency.EUR,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: existingSub?.cancelAtPeriodEnd ?? false
    },
    db
  );

  await recordInvoicePayment(
    {
      userId: customer.userId,
      invoiceId: invoice.id,
      paymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null,
      amountCents: invoice.amount_paid ?? 0,
      status: PaymentStatus.succeeded
    },
    db
  );

  const { roleChanges } = await applyRolesAndEntitlements(
    {
      userId: customer.userId,
      planCode: plan.code,
      periodStart,
      periodEnd,
      reason: 'invoice.paid'
    },
    db
  );

  await writeAuditLog(
    {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_PAYMENT_SUCCEEDED',
      targetType: 'subscription',
      targetId: subscriptionId,
      metadata: { plan_code: plan.code },
      requestId: null
    },
    db
  );

  for (const role of roleChanges.granted) {
    await writeAuditLog(
      {
        actorUserId: customer.userId,
        actorIp: null,
        action: 'BILLING_ROLE_GRANTED',
        targetType: 'role',
        targetId: role,
        metadata: { plan_code: plan.code },
        requestId: null
      },
      db
    );
  }
  for (const role of roleChanges.revoked) {
    await writeAuditLog(
      {
        actorUserId: customer.userId,
        actorIp: null,
        action: 'BILLING_ROLE_REVOKED',
        targetType: 'role',
        targetId: role,
        metadata: { plan_code: plan.code },
        requestId: null
      },
      db
    );
  }

  await writeAuditLog(
    {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_ENTITLEMENTS_UPDATED',
      targetType: 'entitlement',
      targetId: customer.userId,
      metadata: { plan_code: plan.code },
      requestId: null
    },
    db
  );

  return { status: 'processed' as const };
}

async function handleInvoiceFailed(event: Stripe.Event, db: DbClient) {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed' as const, errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (subscriptionId) {
    await db.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: SubscriptionStatus.past_due }
    });
  }

  await recordInvoicePayment(
    {
      userId: customer.userId,
      invoiceId: invoice.id,
      paymentIntentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null,
      amountCents: invoice.amount_due ?? 0,
      status: PaymentStatus.failed
    },
    db
  );

  await writeAuditLog(
    {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_PAYMENT_FAILED',
      targetType: 'subscription',
      targetId: subscriptionId ?? 'unknown',
      metadata: {},
      requestId: null
    },
    db
  );

  return { status: 'processed' as const };
}

async function handleSubscriptionUpdated(event: Stripe.Event, db: DbClient) {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed' as const, errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_PRICE' };
  }

  if (subscription.items.data[0]?.price?.currency?.toUpperCase() !== Currency.EUR) {
    await writeAuditLog(
      {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_WEBHOOK_MISMATCH',
      targetType: 'stripe_event',
      targetId: event.id,
      metadata: { reason: 'CURRENCY_MISMATCH' },
      requestId: null
    },
      db
    );
    return { status: 'failed' as const, errorMessage: 'CURRENCY_MISMATCH' };
  }

  const plan = await resolvePlanByPrice(priceId, db);
  if (!plan) {
    await writeAuditLog(
      {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_WEBHOOK_MISMATCH',
      targetType: 'stripe_event',
      targetId: event.id,
      metadata: { reason: 'PRICE_MISMATCH', price_id: priceId },
      requestId: null
    },
      db
    );
    return { status: 'failed' as const, errorMessage: 'PRICE_MISMATCH' };
  }

  await upsertSubscription(
    {
      userId: customer.userId,
      stripeSubscriptionId: subscription.id,
      planCode: plan.code,
      status: mapSubscriptionStatus(subscription.status),
      currency: Currency.EUR,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null
    },
    db
  );

  await writeAuditLog(
    {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_SUB_UPDATED',
      targetType: 'subscription',
      targetId: subscription.id,
      metadata: { plan_code: plan.code },
      requestId: null
    },
    db
  );

  return { status: 'processed' as const };
}

async function handleSubscriptionDeleted(event: Stripe.Event, db: DbClient) {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed' as const, errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed' as const, errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  await upsertSubscription(
    {
      userId: customer.userId,
      stripeSubscriptionId: subscription.id,
      planCode: PlanCode.FREE,
      status: SubscriptionStatus.canceled,
      currency: Currency.EUR,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: new Date()
    },
    db
  );

  const { roleChanges } = await applyRolesAndEntitlements(
    {
      userId: customer.userId,
      planCode: PlanCode.FREE,
      periodStart,
      periodEnd,
      reason: 'subscription.deleted'
    },
    db
  );

  await writeAuditLog(
    {
      actorUserId: customer.userId,
      actorIp: null,
      action: 'BILLING_SUB_ENDED',
      targetType: 'subscription',
      targetId: subscription.id,
      metadata: {},
      requestId: null
    },
    db
  );

  for (const role of roleChanges.revoked) {
    await writeAuditLog(
      {
        actorUserId: customer.userId,
        actorIp: null,
        action: 'BILLING_ROLE_REVOKED',
        targetType: 'role',
        targetId: role,
        metadata: {},
        requestId: null
      },
      db
    );
  }

  return { status: 'processed' as const };
}

router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'SIGNATURE_MISSING' });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = toStripeEvent(req.body, signature);
  } catch (err) {
    res.status(400).json({ error: 'SIGNATURE_INVALID' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) {
      return { duplicate: true };
    }

    let record;
    try {
      record = await tx.webhookEvent.create({
        data: {
          provider: 'stripe',
          eventId: event.id,
          type: event.type,
          status: WebhookStatus.processed
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { duplicate: true };
      }
      throw err;
    }

    let outcome: { status: 'processed' | 'ignored' | 'failed'; errorMessage?: string };
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          outcome = await handleCheckoutCompleted(event, tx);
          break;
        case 'invoice.paid':
          outcome = await handleInvoicePaid(event, tx);
          break;
        case 'invoice.payment_failed':
          outcome = await handleInvoiceFailed(event, tx);
          break;
        case 'customer.subscription.updated':
          outcome = await handleSubscriptionUpdated(event, tx);
          break;
        case 'customer.subscription.deleted':
          outcome = await handleSubscriptionDeleted(event, tx);
          break;
        default:
          outcome = { status: 'ignored' };
      }
    } catch (err) {
      outcome = { status: 'failed', errorMessage: 'PROCESSING_ERROR' };
    }

    await tx.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: outcome.status as WebhookStatus,
        processedAt: new Date(),
        errorMessage: outcome.errorMessage ?? null
      }
    });

    return { duplicate: false };
  });

  if (result.duplicate) {
    res.status(200).json({ received: true });
    return;
  }

  res.status(200).json({ received: true });
});

export { router as webhookRouter };
