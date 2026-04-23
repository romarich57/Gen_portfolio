import {
  Currency,
  PlanCode
} from '@prisma/client';
import type Stripe from 'stripe';
import { writeAuditLog } from '../../../services/audit';
import { applyRolesAndEntitlements, upsertSubscription } from '../../../services/billing';
import {
  type DbClient,
  type StripeWebhookOutcome,
  ensureEuroCurrency,
  mapSubscriptionStatus,
  resolvePlanByPrice,
  resolveUserByCustomer
} from './stripe-webhook-shared.service';

export async function handleSubscriptionUpdated(event: Stripe.Event, db: DbClient): Promise<StripeWebhookOutcome> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed', errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed', errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    return { status: 'failed', errorMessage: 'MISSING_PRICE' };
  }

  if (!ensureEuroCurrency(subscription.items.data[0]?.price?.currency)) {
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
    return { status: 'failed', errorMessage: 'CURRENCY_MISMATCH' };
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
    return { status: 'failed', errorMessage: 'PRICE_MISMATCH' };
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

  const { roleChanges } = await applyRolesAndEntitlements(
    {
      userId: customer.userId,
      planCode: plan.code,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
      reason: 'subscription.updated'
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

  return { status: 'processed' };
}

export async function handleSubscriptionDeleted(event: Stripe.Event, db: DbClient): Promise<StripeWebhookOutcome> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!stripeCustomerId) {
    return { status: 'failed', errorMessage: 'MISSING_CUSTOMER' };
  }

  const customer = await resolveUserByCustomer(stripeCustomerId, db);
  if (!customer) {
    return { status: 'failed', errorMessage: 'CUSTOMER_NOT_FOUND' };
  }

  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  await upsertSubscription(
    {
      userId: customer.userId,
      stripeSubscriptionId: subscription.id,
      planCode: PlanCode.FREE,
      status: 'canceled',
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

  return { status: 'processed' };
}
