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
Note compatibilité: `scheduled_plan_code` peut encore être présent mais est **déprécié**.

## Flows
- Subscribe/upgrade/downgrade via Checkout + webhooks.
- Upgrade paid: changement Stripe immédiat.
- Downgrade paid→paid: changement Stripe immédiat (sans prorata).
- Downgrade paid→FREE: annulation Stripe immédiate, puis bascule FREE via webhook `customer.subscription.deleted`.
- Expiry: via `customer.subscription.deleted` => FREE + rôles révoqués.
- Source de vérité rôles/entitlements: **webhooks Stripe uniquement**.

## Configuration Stripe (obligatoire)
- Les plans PREMIUM/VIP doivent avoir un `stripe_price_id` valide.
- En dev, vous pouvez définir `STRIPE_PRICE_ID_PREMIUM` / `STRIPE_PRICE_ID_VIP` (et optionnellement `STRIPE_PRODUCT_ID_*`) puis relancer l’API.
- En prod, utilisez l’Admin App pour créer/mettre à jour les plans et leurs prix Stripe.

## Mapping rôles & quotas
- FREE → limit=1 projet/mois
- PREMIUM → role `premium`, limit=5
- VIP → role `vip`, limit illimité

## Sécurité
- Signature Stripe + raw body obligatoire.
- Idempotency via `webhook_events`.
- Attribution rôle uniquement via webhook.
- Accusés webhook:
  - `200` pour duplicate / ignored / mismatch métier non retryable
  - `500` uniquement pour `PROCESSING_ERROR` retryable
