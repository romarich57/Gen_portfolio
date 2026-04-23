import {
  Currency,
  PaymentStatus,
  type PlanCode,
  SubscriptionStatus
} from '@prisma/client';
import type Stripe from 'stripe';
import { writeAuditLog } from '../../../services/audit';
import {
  applyRolesAndEntitlements,
  recordCheckoutPayment,
  recordInvoicePayment,
  upsertSubscription
} from '../../../services/billing';
import {
  type DbClient,
  type StripeWebhookOutcome,
  ensureEuroCurrency,
  resolvePlanByPrice,
  resolveUserByCustomer
} from './stripe-webhook-shared.service';

export async function handleCheckoutCompleted(event: Stripe.Event, db: DbClient): Promise<StripeWebhookOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== 'subscription') {
    return { status: 'ignored' };
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
    return { status: 'failed', errorMessage: 'MISSING_METADATA' };
  }

  if (!session.customer || typeof session.customer !== 'string') {
    return { status: 'failed', errorMessage: 'MISSING_CUSTOMER' };
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

  return { status: 'processed' };
}

export async function handleInvoicePaid(event: Stripe.Event, db: DbClient): Promise<StripeWebhookOutcome> {
  const invoice = event.data.object as Stripe.Invoice;
  if (!ensureEuroCurrency(invoice.currency)) {
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
    return { status: 'failed', errorMessage: 'CURRENCY_MISMATCH' };
  }

  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed', errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed', errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subscriptionId) {
    return { status: 'failed', errorMessage: 'MISSING_SUBSCRIPTION' };
  }

  const line =
    invoice.lines?.data?.find((item) => item.type === 'subscription' && item.price?.id) ??
    invoice.lines?.data?.find((item) => item.price?.id);
  const priceId = line?.price?.id;
  if (!priceId) {
    return { status: 'failed', errorMessage: 'MISSING_PRICE' };
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
    return { status: 'failed', errorMessage: 'PRICE_MISMATCH' };
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

  return { status: 'processed' };
}

export async function handleInvoiceFailed(event: Stripe.Event, db: DbClient): Promise<StripeWebhookOutcome> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed', errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed', errorMessage: 'CUSTOMER_NOT_FOUND' };
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

  return { status: 'processed' };
}
