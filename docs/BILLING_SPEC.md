# BILLING_SPEC

## Endpoints

### GET /billing/plans
Auth: oui (cookies).
Retour: `code`, `name`, `amount_cents`, `currency`, `interval`, `features`, `is_active`.
Ne jamais exposer `stripe_price_id`.

### POST /billing/checkout-session
Auth: oui. CSRF: oui. Rate‑limit: 3/min/user + 10/min/IP (+ captcha adaptatif).
Input:
```json
{ "planCode": "PREMIUM", "captchaToken": "optional" }
```
Process:
- Valide plan actif, pas FREE
- Crée/charge Stripe customer
- Crée Stripe Checkout Session (subscription) avec `automatic_tax.enabled=true`
Output: `checkout_url`
Audit: `BILLING_CHECKOUT_CREATED`
Rôle **jamais** attribué ici.

### POST /billing/portal
Auth: oui. CSRF: oui. Rate‑limit: 5/min/user.
Output: `portal_url`
Audit: `BILLING_PORTAL_OPENED`

### GET /billing/status
Auth: oui.
Retour: `plan_code`, `status`, `period_start`, `period_end`, `cancel_at_period_end`, `entitlements`, `roles`.

## Flows
- Subscribe/upgrade/downgrade via Checkout + webhooks.
- Cancel: accès conservé jusqu’à `current_period_end` (Stripe).
- Expiry: via `customer.subscription.deleted` => FREE + rôles révoqués.

## Mapping rôles & quotas
- FREE → limit=1 projet/mois
- PREMIUM → role `premium`, limit=5
- VIP → role `vip`, limit illimité

## Sécurité
- Signature Stripe + raw body obligatoire.
- Idempotency via `webhook_events`.
- Attribution rôle uniquement via webhook.
