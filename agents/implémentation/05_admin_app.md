# Feature 05 — Admin App séparée (React) + Admin API (/api/admin/*)
Dépendances: Feature 00/01/02/03 validées (sessions cookies, RBAC roles, Stripe, profil).

## Objectif
Créer une **Admin App** (frontend React) dans `/frontends_admin` (à la racine du repo backend) + ajouter des **endpoints admin dédiés** dans le backend sous `/api/admin/*`.

L’Admin App doit permettre une gestion complète V1:
- Vue globale (dashboard + stats + graphs)
- Gestion utilisateurs (liste, filtres, détails, actions)
- Gestion plans/billing (édition des plans + coupons Stripe + changement de plan user)
- Gestion credits/quotas (V1 = interne uniquement)
- Logs/Audit + détection anomalies/fraudes (affichage)
- Exports (liste + statut)
- Settings (paramètres app + permissions admin V1 simple)

Langue V1: FR uniquement.

---

# A) Contraintes et décisions figées (NE PAS CHANGER)
## A1) Structure repo
- Backend existe déjà.
- Créer à la racine un dossier: `/frontends_admin`
- Ne pas créer un repo séparé.

## A2) URLs dev (cookies)
- Admin App: `https://localhost:3002`
- Backend API: `https://localhost:4000` (si différent, créer `/feedback/FEATURE05-backend-url-mismatch.md`)

## A3) Routes Admin
- Tous endpoints admin doivent être sous:
  - `/api/admin/*`

## A4) Auth admin
- Même session cookies que user app (cookies HttpOnly, credentials include).
- Accès admin autorisé uniquement si `role in (admin, super_admin)` (modérateur NON implémenté en V1).
- Si un user non admin tente -> 403 (message neutre).

## A5) Rôles produit (côté users)
- Rôles “produit” : `user`, `premium`, `vip`
- Rôles “admin” : `admin`, `super_admin` (modérateur prévu plus tard)
⚠️ Si le backend stocke les rôles autrement (table ou enum), l’agent doit s’aligner sur l’existant et documenter.

## A6) Stripe (source of truth)
- Feature 05 doit modifier Stripe quand un admin change un plan manuellement.
- Plans mensuels en EUR.
- Coupons/Promotion codes: via Stripe uniquement.

## A7) Credits
- V1: credits internes uniquement (anti-abus), pas facturés.
- V2: credits metered Stripe (NE PAS implémenter en V1, seulement préparer).

## A8) RGPD affichage admin
- Données sensibles masquées par défaut.
- Bouton “Afficher” avec confirmation explicite (modal) avant de révéler.
- Révélation doit déclencher audit log.

## A9) Tests V1
- Playwright E2E smoke + tests unit composants critiques.
- Seeds dev obligatoires.

---

# B) Livrables attendus
## B1) Backend
1) Endpoints `/api/admin/*` (liste détaillée plus bas)
2) Prisma: schéma/migrations si nouvelles tables nécessaires
3) Documentation:
   - `ADMIN_API_SPEC.md` (Markdown, complet)
   - `openapi.admin.yaml` (OpenAPI 3.1) pour /api/admin/*
4) Seeds:
   - 1 super_admin
   - 1 admin
   - 3 users (free/premium/vip) + données profil
   - (modérateur prévu, pas de seed obligatoire)
5) Tests backend (minimum):
   - authz: admin vs non-admin (403)
   - cursor pagination + filters
   - change plan user -> appel Stripe (mock) + update DB
   - reveal sensitive -> requires confirmation flag + audit log

## B2) Frontend Admin (`/frontends_admin`)
1) App React TS strict + Tailwind + shadcn/ui
2) React Query (TanStack) pour data fetching
3) Fetch wrapper unique (`apiClient`) avec:
   - `credentials: "include"`
   - header CSRF `X-CSRF-Token`
   - gestion erreurs neutres
4) Pages V1 (FR):
   - Overview (dashboard graphs)
   - Users (table + cursor pagination + filtres)
   - User Details (actions + sections)
   - Plans/Billing (éditer plans + coupons)
   - Credits/Quotas (internes)
   - Logs/Audit (table + filtres)
   - Exports (table + statut)
   - Settings (app settings)
5) UI RGPD:
   - Champs sensibles masqués par défaut
   - Modal “Afficher” (confirmation)
6) Tests Playwright:
   - login admin -> dashboard
   - users list -> open user -> ban/unban
   - change role product (user/premium/vip)
   - change plan via Stripe (mock)
   - reveal email (modal confirm) -> visible
7) Docs:
   - `frontends_admin/README.md` (run dev + https local)
   - `ADMIN_UI_GUIDE.md` (navigation + actions)

---

# C) Modèle de données (Prisma) — uniquement si manquant dans le backend actuel
⚠️ IMPORTANT: Avant d’ajouter des tables, l’agent doit inspecter l’existant. Si tables déjà présentes (subscriptions/plans/payments/audit_logs/exports…), réutiliser.

## C1) Tables minimales attendues pour Feature 05
### Plans
- `plans`
  - id (uuid)
  - code: "FREE" | "PRO" | "VIP" (unique)
  - name_fr
  - monthly_price_eur_cents
  - project_limit (1 / 5 / null pour illimité)
  - credits_monthly (int, optionnel)
  - is_active (bool)
  - stripe_product_id (string, nullable)
  - stripe_price_id (string, nullable)
  - created_at, updated_at

### Admin actions / audit
- Réutiliser `audit_logs` existant (append-only).
- Ajouter des `action_type` si manquant (ADMIN_*).

### Credits (V1 interne)
- `credits_ledger`
  - id
  - user_id
  - delta (int)
  - reason (string)
  - created_by_admin_id (nullable)
  - created_at
- `users.credits_balance` (int) si pas déjà présent

### Exports
- réutiliser table exports existante (ou `export_jobs`) si présente.

### Admin users creation
- réutiliser table users + rôle admin.
- pas de table séparée nécessaire.

---

# D) Backend — Endpoints admin (contrat strict)
Base: `/api/admin`

## D0) Middleware requis
- `requireAdmin()`:
  - check session valid
  - check role in (admin, super_admin)
  - sinon 403 neutre
- `requireSuperAdmin()`:
  - role == super_admin
  - sinon 403

## D1) Admin “Me”
### GET /api/admin/me
Retourne:
- admin user minimal (id, email masked, role)
- flags UI (lang FR)

## D2) Overview / Stats
### GET /api/admin/overview
Retourne un JSON stable pour afficher:
- totals:
  - total_users
  - total_users_free
  - total_users_premium
  - total_users_vip
  - total_active_subscriptions
  - total_exports_24h
- timeseries (7/30 jours):
  - signups_per_day
  - upgrades_per_day (premium/vip)
  - churn_per_day (si dispo)
NOTE: Si certaines données n’existent pas encore, renvoyer 0 + documenter.

## D3) Users list (cursor pagination)
### GET /api/admin/users
Query params:
- `q` (search email/username)
- `role` (user|premium|vip|admin|super_admin) [filter]
- `status` (active|banned|deleted|pending_*) si existe
- `created_from`, `created_to`
- `limit` (default 25, max 100)
- `cursor` (opaque)
Response:
- items: [user summary]
- nextCursor: string | null

User summary (RGPD):
- id
- username
- role
- status
- created_at
- email_masked (ex: ro***@gm***.com)
- flags: email_verified (bool) (ok)
- NO téléphone en clair

## D4) User details
### GET /api/admin/users/:id
Retour:
- profil non sensible + plan + dates
- email_masked seulement
- sections:
  - profile
  - billing summary
  - sessions count
  - credits_balance
  - flags (verified email, etc.)

### POST /api/admin/users/:id/reveal
But: révéler un champ sensible (ex: email complet) après confirmation UI.
Body:
- fields: ["email"] (v1)
- confirm: string (doit être EXACT = "AFFICHER")
Response:
- email_full (si demandé)
- audit log obligatoire

## D5) User actions
### PATCH /api/admin/users/:id/role
Body:
- role: "user" | "premium" | "vip" | "admin" | "super_admin"
Rules:
- Seul super_admin peut donner admin/super_admin.
- admin peut changer user/premium/vip seulement.
Audit: ADMIN_ROLE_CHANGED.

### PATCH /api/admin/users/:id/status
Body:
- status_action: "ban" | "unban" | "deactivate" | "reactivate"
Audit: ADMIN_STATUS_CHANGED.

### POST /api/admin/users/:id/password/reset
Body:
- mode: "force_reset" | "send_link"
Rules:
- send_link => réutilise flow reset existant (réponse neutre)
Audit: ADMIN_PASSWORD_RESET_TRIGGERED.

### POST /api/admin/users/:id/email/verify/force
Audit: ADMIN_FORCE_EMAIL_VERIFIED.

### POST /api/admin/users/:id/email/verify/revoke
Audit: ADMIN_REVOKE_EMAIL_VERIFIED.

### POST /api/admin/users/:id/sessions/revoke
Body:
- mode: "all" | "current" (default all)
Audit: ADMIN_SESSIONS_REVOKED.

### POST /api/admin/users/:id/gdpr/export
Crée un job queue (async).
Audit: ADMIN_GDPR_EXPORT_REQUESTED.

### POST /api/admin/users/:id/delete (soft delete)
Audit: ADMIN_SOFT_DELETE.

### POST /api/admin/users/:id/purge
Doit respecter le délai (ex: 7 jours) si logique déjà en place.
Audit: ADMIN_PURGE.

## D6) Plans/Billing (Stripe)
### GET /api/admin/plans
Retourne tous les plans (actifs + inactifs) + mapping Stripe.

### POST /api/admin/plans
Super_admin only.
Body:
- code (FREE/PRO/VIP)
- name_fr
- price_eur_cents
- project_limit
- credits_monthly (optionnel)
- create_stripe: true/false
Rules:
- Si create_stripe=true:
  - créer Product Stripe
  - créer Price mensuel EUR
  - stocker stripe_product_id, stripe_price_id
Audit: ADMIN_PLAN_CREATED.

### PATCH /api/admin/plans/:planId
Super_admin only.
Permet:
- activer/désactiver
- changer name_fr/features internes
- SI besoin : créer un nouveau Price Stripe (ne jamais modifier un price existant si Stripe le déconseille)
Audit: ADMIN_PLAN_UPDATED.

### POST /api/admin/stripe/coupons
Super_admin only.
Créer coupons/promotion codes Stripe.
Body minimal:
- percent_off OR amount_off
- duration
- code
Audit: ADMIN_COUPON_CREATED.

### POST /api/admin/users/:id/subscription/change
Admin+.
Body:
- plan_code: FREE|PRO|VIP
- proration: true (default true)
Rules:
- Mettre à jour Stripe subscription (source of truth)
- Mettre à jour DB: rôle user/premium/vip + subscription record
- Effet immédiat
Audit: ADMIN_SUBSCRIPTION_CHANGED.

## D7) Credits/Quotas (V1 interne)
### GET /api/admin/users/:id/credits
Retour ledger + balance.

### POST /api/admin/users/:id/credits/adjust
Body:
- delta (int, positif ou négatif)
- reason (string obligatoire)
Rules:
- balance ne peut pas descendre sous 0 (si tu veux) -> préciser et tester
Audit: ADMIN_CREDITS_ADJUSTED.

## D8) Logs/Audit
### GET /api/admin/audit
Filtres:
- userId
- action_type
- date range
- limit+cursor
Retour:
- items + nextCursor

## D9) Exports
### GET /api/admin/exports
- filtre userId/status/date
- cursor pagination
Retour:
- liste exports (sans lien direct si sensible)
Option: presigned URL très courte si tu autorises download admin (sinon “à venir”).

---

# E) Frontend Admin — UI & Pages (FR)
## E0) Tech imposée
- React TS strict
- Tailwind + shadcn/ui
- React Query
- fetch+wrapper `apiClient`
- credentials include partout

## E1) Routing
- /login (si déjà existant côté user app, admin app doit juste rediriger vers user login? OU afficher “Connecte-toi sur le site principal”)
Décision V1:
- Admin app n’a pas de login indépendant.
- Si non connecté -> page “Accès admin requis” + bouton “Aller au Login” (URL du site principal).

## E2) Layout
- Sidebar + topbar + breadcrumb
- Dark/light toggle
- Pages list:
  - Overview
  - Users
  - User Details
  - Plans/Billing
  - Credits/Quotas
  - Logs/Audit
  - Exports
  - Settings

## E3) Overview (graphique)
- cartes KPI + courbes (Recharts)
- données depuis GET /api/admin/overview

## E4) Users list
- table:
  - username
  - email masked
  - role
  - status
  - created_at
- filtres:
  - search q
  - role
  - status
  - date range
- cursor pagination:
  - bouton “Charger plus”
  - conserve cursor dans query cache

## E5) User Details
Sections:
- Profil (non sensible)
- Abonnement/plan (plan actuel + actions)
- Sessions (compteur + bouton révoquer)
- Credits (balance + ajuster)
- RGPD (export + soft delete + purge)
- Reveal sensitive:
  - bouton “Afficher email”
  - modal confirmation texte EXACT “AFFICHER”
  - call POST /reveal

## E6) Plans/Billing
- liste plans + édition
- création plan:
  - formulaire + toggle “Créer sur Stripe”
- création coupon Stripe:
  - formulaire (percent_off ou amount_off)

## E7) Logs/Audit
- table + filtres + cursor pagination

## E8) Exports
- table exports + filtres

## E9) Settings
- toggles (placeholder V1) + doc “à venir”
- permissions modérateur: placeholder (non implémenté)

---

# F) Seeds dev (obligatoire)
Créer un script seed Prisma:
- super_admin (toi) avec email + role super_admin
- admin standard
- 3 users: free/premium/vip
- compléter profil minimal
- créer subscriptions records si besoin (test mode)

---

# G) Tests
## G1) Playwright smoke
- Setup : seed + lancer backend + lancer admin app
Scénarios:
1) Accès admin sans rôle -> 403/écran accès refusé
2) Super_admin accède -> Overview visible
3) Liste users -> ouvre user details
4) Ban/unban
5) Change plan -> appelle endpoint subscription change (mock Stripe ou test mode)
6) Reveal email -> modal confirm -> email visible

## G2) Unit tests composants critiques
- UsersTable filters
- ConfirmRevealModal
- apiClient wrapper

---

# H) Definition of Done (Feature 05)
- Admin app fonctionne en https://localhost:3002
- Endpoints /api/admin/* complets + docs OpenAPI + MD
- Cursor pagination ok
- RGPD masking + reveal modal ok
- Gestion plans/coupons + changement plan user update Stripe ok
- Seeds + tests ok
- Feedback créé pour tout blocage (ex: backend URL différente)