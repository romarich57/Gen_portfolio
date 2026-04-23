import { Prisma, WebhookStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { stripe } from '../../../services/stripeClient';
import {
  type StripeWebhookProcessResult,
  type StripeWebhookOutcome
} from './stripe-webhook-shared.service';
import {
  handleCheckoutCompleted,
  handleInvoiceFailed,
  handleInvoicePaid
} from './stripe-webhook-checkout-invoice.service';
import {
  handleSubscriptionDeleted,
  handleSubscriptionUpdated
} from './stripe-webhook-subscriptions.service';

export function toStripeEvent(reqBody: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(reqBody, signature, env.stripeWebhookSecret);
}

function ignoredWebhook(): StripeWebhookOutcome {
  return { status: 'ignored' };
}

export async function processStripeEvent(event: Stripe.Event): Promise<StripeWebhookProcessResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) {
      return { duplicate: true, outcome: ignoredWebhook() };
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { duplicate: true, outcome: ignoredWebhook() };
      }
      throw error;
    }

    let outcome: StripeWebhookOutcome;
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
          outcome = ignoredWebhook();
      }
    } catch {
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

    return { duplicate: false, outcome };
  });
}
