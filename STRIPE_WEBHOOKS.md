# STRIPE_WEBHOOKS

## Raw body + signature
Stripe signe le payload brut. L’endpoint `/webhooks/stripe` utilise `express.raw({ type: 'application/json' })`
et vérifie `Stripe-Signature` via `STRIPE_WEBHOOK_SECRET`.

## Idempotency
Table `webhook_events` (event_id unique). Si event_id déjà traité → 200 no‑op.

## Events traités
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Anti‑fraude
Validation `price_id` + `currency` côté serveur. Mismatch → `webhook_events.status=failed` + audit `BILLING_WEBHOOK_MISMATCH`.

## Debug / staging
Conserver `webhook_events` + `audit_logs` pour analyse.

## Nginx hardening
Snippet recommandé: `ops/nginx/stripe_webhook.conf` (rate limit + timeouts + proxy headers).
