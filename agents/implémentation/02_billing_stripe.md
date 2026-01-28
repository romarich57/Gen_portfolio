# Feature 02 — Billing Stripe (Subscriptions mensuelles + Stripe Tax + Customer Portal + Webhooks + Roles + Quotas)
Dépendances strictes: Feature 00 + Feature 01 VALIDÉES (headers/CORS/CSRF/rate-limit/audit/RBAC + auth cookies).

## Objectif
Implémenter un système de paiement Stripe **abonnement mensuel** avec sécurité maximale :
- 3 offres : FREE / PREMIUM / VIP
- Checkout Stripe créé côté backend (source of truth)
- TVA gérée via **Stripe Tax**
- Attribution des rôles :
  - `premium` = plan PREMIUM (10€/mois)
  - `vip` = plan VIP (30€/mois)
- Annulation : accès premium/vip reste actif jusqu’à fin de période (cancel_at_period_end)
- Upgrade/downgrade : **prorata automatique** géré par Stripe
- Stripe Customer Portal activé
- Quotas projets (mensuels) :
  - FREE = 1 projet / mois
  - PREMIUM = 5 projets / mois
  - VIP = illimité
- Audit logs complets
- Webhook idempotent (anti double traitement)
- Aucune attribution de rôle depuis le front (interdiction absolue)

Stack imposée:
- Backend: Node.js + Express
- DB: PostgreSQL + Prisma
- Sessions: cookies HttpOnly (Access JWT 15 min + Refresh opaque hashé DB, rotation, reuse detection)
- CSRF: Origin/Referer strict + X-CSRF-Token sur routes state-changing
- Reverse proxy: Nginx (OVH)
- Captcha adaptatif sur endpoints à risque
- Aucun secret en repo

---

## 0) Décisions verrouillées
- Payment model: Subscription mensuelle
- Currency V1: EUR uniquement
- TVA: Stripe Tax activé
- Plans:
  - FREE: 0€/mois — 1 projet/mois
  - PREMIUM: 10€/mois — 5 projets/mois — rôle `premium`
  - VIP: 30€/mois — illimité — rôle `vip`
- Upgrade/Downgrade: prorata automatique Stripe
- Cancel: actif jusqu’à fin de période (cancel_at_period_end = true)
- Stripe Customer Portal: OUI
- Webhook endpoint: /webhooks/stripe
- Source of truth: DB sync via webhooks (pas de “grant” via front)

---

## A) Livrables attendus (obligatoires)

### A1) Docs (à la racine)
1) `BILLING_SPEC.md`
- Endpoints (/billing/plans, /billing/checkout-session, /billing/portal, /billing/status)
- Codes erreurs neutres
- Flux complets: subscribe, upgrade, downgrade, cancel, expire
- Mapping rôles & quotas
- Sécurité: webhook, signature, idempotency, anti-fraude
- Politique: attribution rôle uniquement via webhook

2) `DB_SCHEMA_BILLING.md`
- Prisma schema + migrations
- Indices/uniques/FK
- Contraintes de cohérence Stripe IDs

3) `STRIPE_WEBHOOKS.md`
- Vérification signature + raw body
- Liste d’events traités
- Idempotency design (table webhook_events)
- Procédures debug (staging)
- Replay safe (no-op)

4) `STRIPE_TAX.md`
- Activation Stripe Tax
- Comment Stripe calcule TVA
- Paramètres Stripe obligatoires
- Points de contrôle (factures, pays, taxe)

### A2) Backend (Express)
- Module billing (routes `/billing/*`)
- Webhook `/webhooks/stripe`
- Services:
  - StripeClientService (SDK Stripe)
  - BillingService (règles business)
  - RoleGrantService (premium/vip)
  - EntitlementsService (quotas)
- Audit logs sur toutes transitions sensibles

### A3) Tests
- Webhook: signature invalid -> 400
- Webhook: replay event_id -> 200 no-op
- Webhook: invoice.paid valid -> DB update + role grant + entitlements
- Checkout: plan invalid -> 400 neutre
- Checkout: FREE -> refus (pas Stripe)
- Sécurité: CSRF requis sur POST /billing/* (sauf webhook)
- Rate limit checkout
- Non régression auth: sessions OK

---

## B) Modèle de données (Prisma) — strict

### B1) Tables minimales
1) `plans`
- id (uuid)
- code: "FREE" | "PREMIUM" | "VIP" (unique)
- name
- currency: "EUR"
- stripe_price_id (nullable pour FREE)
- amount_cents (0 pour FREE, 1000 pour PREMIUM, 3000 pour VIP)
- interval: "month"
- is_active: boolean
- features_json
- created_at, updated_at

2) `stripe_customers`
- user_id (unique FK users)
- stripe_customer_id (unique)
- created_at

3) `subscriptions`
- id
- user_id (FK)
- plan_code ("FREE"|"PREMIUM"|"VIP")  (ou plan_id FK)
- status (active|trialing|past_due|canceled|incomplete|unpaid|...)
- currency ("EUR")
- stripe_subscription_id (unique, nullable si FREE)
- current_period_start, current_period_end
- cancel_at_period_end (bool)
- canceled_at (nullable)
- created_at, updated_at

4) `payments`
- id
- user_id
- stripe_checkout_session_id (unique)
- stripe_invoice_id (unique nullable)
- stripe_payment_intent_id (unique nullable)
- amount_cents
- currency
- status (pending|succeeded|failed|refunded)
- created_at

5) `entitlements`
- user_id (unique FK)
- projects_limit (int nullable; null = illimité)
- projects_used (int)
- period_start, period_end (mensuel, aligné sur Stripe)
- updated_at

6) `webhook_events`
- id
- provider ("stripe")
- event_id (unique)
- type
- received_at
- processed_at
- status (processed|ignored|failed)
- error_message (nullable)

7) `role_grants` (si tu n’utilises pas un champ roles dans users)
- user_id
- role ("premium"|"vip")
- granted_at
- revoked_at (nullable)
- reason
- Contrainte logique: un seul grant actif par rôle et user

### B2) Règles sensibles
- Aucun plan/price/montant ne vient du front sans validation serveur.
- Tous IDs Stripe uniques en DB.
- Webhook idempotent obligatoire.
- Toute modif subscription/payment/role => audit log.

---

## C) Configuration Stripe (strict)
Variables env requises (validation au boot, sinon crash):
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_TAX_ENABLED=true
- APP_URL (pour success/cancel + portal return)
- STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID (optionnel si tu configures côté Stripe)

Notes:
- `.env.example` = placeholders uniquement
- Aucun secret commité

---

## D) Endpoints (Express) — strict

### D1) GET /billing/plans
Auth: OUI (cookies)
Retour:
- code, name, amount_cents, currency, interval, features, is_active
Ne jamais exposer stripe_price_id au front si pas nécessaire.
Pas d’audit obligatoire.

### D2) POST /billing/checkout-session
Auth: OUI
CSRF: OUI (Origin/Referer + X-CSRF-Token)
Rate limit: OUI (3/min/user + 10/min/IP) + captcha adaptatif si abus
Input JSON:
- plan_code: "PREMIUM" | "VIP"
Process:
1) Valider plan_code actif et != FREE
2) Récupérer/Créer stripe customer (table stripe_customers)
3) Créer Stripe Checkout Session (mode=subscription):
   - line_items: price = plans.stripe_price_id
   - metadata: user_id, plan_code, currency="EUR", env
   - automatic_tax: { enabled: true }
   - success_url = APP_URL + "/billing/success"
   - cancel_url  = APP_URL + "/billing/cancel"
4) Écrire audit log: BILLING_CHECKOUT_CREATED
Output:
- checkout_url

Règle d’or:
- Le rôle premium/vip n’est JAMAIS attribué ici.

### D3) POST /billing/portal
Auth: OUI
CSRF: OUI
Rate limit: 5/min/user
Process:
- créer Stripe Billing Portal session pour stripe_customer_id
- return_url = APP_URL + "/settings/billing"
Audit:
- BILLING_PORTAL_OPENED
Output:
- portal_url

### D4) GET /billing/status
Auth: OUI
Source: DB
Retour:
- plan_code, status, period_end, cancel_at_period_end
- projects_limit/projects_used + period_start/end
- roles effectifs (premium/vip)

---

## E) Webhook Stripe — POST /webhooks/stripe (PUBLIC)

### E1) Sécurité obligatoire
- Express doit exposer le **raw body** (Stripe exige la signature sur raw)
- Vérifier signature via STRIPE_WEBHOOK_SECRET
- Refuser signature invalide: 400
- Idempotency:
  - insérer dans webhook_events(event_id unique)
  - si duplicate => return 200 no-op
- Traitement DB en transaction (quand possible)
- Jamais de cookies, jamais de CSRF (endpoint public)

### E2) Events traités (minimum)
1) `checkout.session.completed`
- Vérifier metadata (user_id, plan_code, currency)
- Vérifier mode=subscription
- Upsert:
  - stripe_customer_id (si pas déjà)
  - payments status=pending (si tu veux tracer)
- Audit:
  - BILLING_CHECKOUT_COMPLETED
Note:
- Ne pas attribuer rôle sur cet event si la facture n’est pas payée.

2) `invoice.paid` (event principal de “paiement réussi”)
- Lire invoice.subscription, invoice.customer, invoice.currency, invoice.lines
- Vérifier currency == EUR
- Vérifier price_id dans invoice.lines correspond EXACTEMENT à ton plan_code attendu (mapping DB)
- Upsert subscriptions:
  - status=active
  - current_period_start/end depuis Stripe
  - cancel_at_period_end selon Stripe
- Upsert payment:
  - status=succeeded, amount_cents, invoice_id, payment_intent_id
- Appliquer rôles:
  - plan PREMIUM => grant premium, revoke vip
  - plan VIP => grant vip, revoke premium
- Appliquer entitlements (alignés sur period_start/end):
  - FREE: limit=1
  - PREMIUM: limit=5
  - VIP: limit=null
  - reset projects_used si nouvelle période
- Audit:
  - BILLING_PAYMENT_SUCCEEDED
  - BILLING_ROLE_GRANTED
  - BILLING_ENTITLEMENTS_UPDATED

3) `invoice.payment_failed`
- Marquer subscription status=past_due/unpaid
- Audit:
  - BILLING_PAYMENT_FAILED
Note:
- Ne pas révoquer immédiatement (on suit Stripe + fin de période).

4) `customer.subscription.updated`
- Mettre à jour status/period_end/cancel flags
- Audit:
  - BILLING_SUB_UPDATED

5) `customer.subscription.deleted`
- Abonnement terminé:
  - revoke premium/vip
  - set plan FREE ou status=canceled
  - entitlements FREE (limit=1)
- Audit:
  - BILLING_SUB_ENDED
  - BILLING_ROLE_REVOKED

### E3) Anti-fraude (obligatoire)
- La validation du plan se fait par `price_id` attendu (pas montant seulement).
- Si mismatch price_id ou currency => status=failed dans webhook_events + audit incident:
  - BILLING_WEBHOOK_MISMATCH

---

## F) Entitlements / quotas (mensuel)
Règles:
- FREE: projects_limit=1
- PREMIUM: projects_limit=5
- VIP: projects_limit=null (illimité)
- period_start/end = celles de Stripe subscription
- Reset projects_used=0 à chaque nouveau cycle Stripe

Implémenter:
- `applyEntitlements(user_id, plan_code, period_start, period_end)` (fonction unique)

---

## G) RBAC / sécurité routes billing
- Toutes routes `/billing/*` (sauf GET /billing/plans si tu le veux public) exigent auth + CSRF.
- Webhook est la seule route publique, mais signature + idempotency obligatoires.
- Ajouter permissions fines (si ton RBAC est prêt):
  - billing:read (status)
  - billing:checkout (create checkout)
  - billing:portal (open portal)

---

## H) Critères d’acceptation (DoD Feature 02)
- /billing/plans retourne FREE/PREMIUM/VIP avec EUR mensuel
- /billing/checkout-session crée une session Stripe valide (subscription) et renvoie checkout_url
- /billing/portal renvoie un portal_url valide
- webhook:
  - refuse signature invalide
  - est idempotent (replay no-op)
  - sur invoice.paid: DB updated + rôle premium/vip attribué + quotas appliqués
- premium/vip ne sont jamais attribués via front
- audit logs complets
- docs + tests livrés et green