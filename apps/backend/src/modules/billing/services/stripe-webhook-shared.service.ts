import { Currency, SubscriptionStatus, type Prisma, type PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../../../db/prisma';

export type DbClient = Prisma.TransactionClient | PrismaClient;

export function mapSubscriptionStatus(status: string): SubscriptionStatus {
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

export async function resolvePlanByPrice(priceId: string, db?: DbClient) {
  const client = db ?? prisma;
  return client.plan.findFirst({ where: { stripePriceId: priceId, isActive: true } });
}

export async function resolveUserByCustomer(stripeCustomerId: string, db?: DbClient) {
  const client = db ?? prisma;
  return client.stripeCustomer.findUnique({ where: { stripeCustomerId } });
}

export function ensureEuroCurrency(currency: string | null | undefined) {
  return currency?.toUpperCase() === Currency.EUR;
}

export type StripeWebhookOutcome = {
  status: 'processed' | 'ignored' | 'failed';
  errorMessage?: string | undefined;
};

export type StripeWebhookProcessResult = {
  duplicate: boolean;
  outcome: StripeWebhookOutcome;
};

export type StripeEventHandler = (event: Stripe.Event, db: DbClient) => Promise<StripeWebhookOutcome>;
