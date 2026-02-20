# DB_SCHEMA_BILLING

## Tables

### plans
- `code` (FREE|PREMIUM|VIP, unique)
- `stripe_price_id` (nullable pour FREE)
- `amount_cents`, `currency`, `interval`
- `is_active`, `features_json`

### stripe_customers
- `user_id` (unique FK users)
- `stripe_customer_id` (unique)

### subscriptions
- `user_id`, `plan_code`
- `status` (active/past_due/etc.)
- `stripe_subscription_id` (unique)
- `current_period_start`, `current_period_end`
- `cancel_at_period_end`, `canceled_at`

### payments
- `stripe_checkout_session_id` (unique, nullable)
- `stripe_invoice_id` (unique, nullable)
- `stripe_payment_intent_id` (unique, nullable)
- `amount_cents`, `currency`, `status`

### entitlements
- `user_id` (unique)
- `ai_generations_limit` (null = illimité)
- `ai_generations_used`
- `github_exports_limit` (null = illimité)
- `github_exports_used`
- `period_start`, `period_end`

### webhook_events
- `provider`, `event_id` (unique), `type`
- `received_at`, `processed_at`
- `status` (processed|ignored|failed)
- `error_message`

### role_grants
- `user_id`, `role` (premium|vip)
- `granted_at`, `revoked_at`
- unique index (user_id, role) where revoked_at IS NULL

## Contraintes clés
- Tous IDs Stripe uniques.
- `role_grants` garantit un seul grant actif par rôle/user.
- `webhook_events` garantit l’idempotency.
