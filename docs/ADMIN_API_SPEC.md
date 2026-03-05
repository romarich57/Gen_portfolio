# Admin API Spec (Feature 05)

Base URL: `/api/admin`  
Auth: cookies HttpOnly + `credentials: "include"`  
CSRF: `X-CSRF-Token` + Origin/Referer strict sur toutes les routes state‑changing.

## Notes
- Roles admin: `admin`, `super_admin`.  
- Roles produit: `user`, `premium`, `vip`.  
- **Plan code**: l’existant backend utilise `PREMIUM` (pas `PRO`).  
- Rate limit dédié `/api/admin/*` (indépendant du limiter global):  
  - Read burst: `8 req / 10s` + read cooldown: `30 req / 60s`  
  - Write burst: `4 req / 10s` + write cooldown: `12 req / 60s`  
  - Clé: `userId + IP + method + routePattern` (stable, non dépendant des IDs concrets dans l’URL)  
  - Dépassement: `429 RATE_LIMITED`
- Namespace legacy `/admin/*` conservé en V1, mais protégé par le même limiter admin dédié (read/write burst + cooldown).

---

## GET /api/admin/me
Retourne l’admin connecté (masqué).

Response:
```
{
  "admin": { "id": "...", "email_masked": "su***@sa***.local", "role": "admin" },
  "ui": { "lang": "fr" },
  "request_id": "..."
}
```

## GET /api/admin/overview
Stats globales + timeseries (7 jours).

Response (extrait):
```
{
  "totals": {
    "total_users": 12,
    "total_users_free": 8,
    "total_users_premium": 3,
    "total_users_vip": 1,
    "total_active_subscriptions": 4,
    "total_exports_24h": 1
  },
  "timeseries": { "signups_per_day": [...], "upgrades_per_day": [...], "churn_per_day": [...] },
  "request_id": "..."
}
```

## GET /api/admin/users
Query: `q`, `role`, `status`, `created_from`, `created_to`, `limit`, `cursor`.

Response:
```
{
  "items": [
    {
      "id": "...",
      "username": "freeuser",
      "role": "user",
      "status": "active",
      "created_at": "2026-01-30T10:00:00Z",
      "email_masked": "fr***@sa***.local",
      "flags": { "email_verified": true }
    }
  ],
  "nextCursor": "...",
  "request_id": "..."
}
```

## GET /api/admin/users/:id
Details (non sensibles).

## POST /api/admin/users/:id/reveal
Body:
```
{ "fields": ["email"], "confirm": "AFFICHER" }
```
Response:
```
{ "email_full": "user@domain.com", "request_id": "..." }
```
Audit log: `ADMIN_REVEAL_SENSITIVE`.

## PATCH /api/admin/users/:id/role
Body: `{ "role": "user|premium|vip|admin|super_admin" }`
- `admin` ne peut pas attribuer admin/super_admin.
Audit: `ADMIN_ROLE_CHANGED`.

## PATCH /api/admin/users/:id/status
Body: `{ "status_action": "ban|unban|deactivate|reactivate" }`
Audit: `ADMIN_STATUS_CHANGED`.

## POST /api/admin/users/:id/password/reset
Body: `{ "mode": "force_reset|send_link" }`  
Audit: `ADMIN_PASSWORD_RESET_TRIGGERED`.

## POST /api/admin/users/:id/email/verify/force
Audit: `ADMIN_FORCE_EMAIL_VERIFIED`.

## POST /api/admin/users/:id/email/verify/revoke
Audit: `ADMIN_REVOKE_EMAIL_VERIFIED`.

## POST /api/admin/users/:id/sessions/revoke
Body: `{ "mode": "all|current" }`  
Audit: `ADMIN_SESSIONS_REVOKED`.

## POST /api/admin/users/:id/gdpr/export
Audit: `ADMIN_GDPR_EXPORT_REQUESTED`.

## POST /api/admin/users/:id/delete
Soft delete.  
Audit: `ADMIN_SOFT_DELETE`.

## POST /api/admin/users/:id/purge
Hard purge (si délai ok).  
Audit: `ADMIN_PURGE`.

---

## GET /api/admin/plans
Retourne les plans + mapping Stripe.

## POST /api/admin/plans (super_admin)
Body:
```
{
  "code": "FREE|PREMIUM|VIP",
  "name_fr": "Premium",
  "price_eur_cents": 1000,
  "project_limit": 5,
  "credits_monthly": 200,
  "create_stripe": true
}
```
Audit: `ADMIN_PLAN_CREATED`.

## PATCH /api/admin/plans/:planId (super_admin)
Permet: name, price, limits, activation, nouveau price Stripe.  
Audit: `ADMIN_PLAN_UPDATED`.

## POST /api/admin/stripe/coupons (super_admin)
Body: `{ percent_off | amount_off, duration, code }`  
Audit: `ADMIN_COUPON_CREATED`.

## POST /api/admin/users/:id/subscription/change
Body: `{ plan_code: "FREE|PREMIUM|VIP", proration?: boolean }`  
Audit: `ADMIN_SUBSCRIPTION_CHANGED`.

---

## GET /api/admin/users/:id/credits
Retourne balance + ledger.

## POST /api/admin/users/:id/credits/adjust
Body: `{ delta: int, reason: string }`  
Audit: `ADMIN_CREDITS_ADJUSTED`.

---

## GET /api/admin/audit
Filtres: `userId`, `action_type`, `created_from`, `created_to`, `limit`, `cursor`.

## GET /api/admin/exports
Filtres: `userId`, `status`, `created_from`, `created_to`, `limit`, `cursor`.
