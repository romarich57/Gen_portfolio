# Agents.md — Règles de travail (sécurité max) + consignes d’implémentation courante

## 0) Objectif du repo
Ce projet est un SaaS sécurisé "Enterprise-grade". Toute implémentation doit respecter les 15 piliers de sécurité (OWASP ASVS / OWASP Cheat Sheets / NIST AAL2) et produire des livrables vérifiables (tests, checklists, audit logs, politiques).

Le backend est en **Node.js + Express** en **TypeScript (strict)**, ORM **Prisma**, DB **PostgreSQL**.
Auth = **cookies HttpOnly** : Access JWT (15 min) + Refresh opaque **hashé en DB**, rotation + détection de réutilisation.
Frontend = **React** en **TypeScript (strict)**.
Email = **SMTP Gmail (App Password)**.
Téléphone = **Twilio Verify**.
MFA = **TOTP obligatoire pour tous**, mais administrable par l’admin (option globale + option par user).

Billing = **Stripe** (abonnements mensuels, TVA via Stripe Tax, Customer Portal, attribution de rôles via webhook signé + idempotency).
Object Storage = **OVH Object Storage S3-compatible** (bucket privé), uploads/downloads via **pre-signed URLs** (courtes), lifecycle purge.

---

## 1) Règles non négociables (Definition of Done Sécurité)
Aucun PR ne peut être merge si ces points ne sont pas respectés.

### 1.1 Les 15 piliers à appliquer (résumé opérationnel)
1. Gouvernance & Secure SDLC (ASVS comme DoD, threat modeling par feature, revues obligatoires, CI sécurité)
2. Identité & Auth (hash robuste, MFA, anti brute force/credential stuffing)
3. Sessions & Tokens (cookies HttpOnly, rotation refresh, révocation serveur, timeouts)
4. Contrôle d’accès RBAC/ABAC (deny-by-default, permissions fines, contrôles objet)
5. Validation entrées & anti-injection (validation schema, queries paramétrées, XSS/SSRF/upload hardening)
6. Sécurité HTTP headers (CSP, HSTS, clickjacking, CORS strict)
7. API Security (rate-limit, idempotency, signature webhooks, anti-enum)
8. Chiffrement & Data handling (TLS, chiffrement au repos, minimisation, purge)
9. Secrets management (pas de secrets en code, rotation)
10. Logs/Monitoring/Audit (audit immuable, corrélation request_id)
11. Infra/Zero-trust (segmentation, IAM least privilege, SSH keys)
12. Docker/Supply chain/CI-CD (scan images, SBOM, pin versions)
13. Backups/Résilience (backups chiffrés, restore tests)
14. RGPD UE (consentements, export/suppression, registre traitements)
15. Tests sécurité & validation continue (E2E sécurité, DAST à terme, revue régulière)

### 1.2 Tests obligatoires
Chaque feature doit inclure :
- Tests unitaires (services / utils critiques)
- Tests d’intégration (endpoints)
- Tests de sécurité ciblés (authz, CSRF, multi-session, rate-limit)
- Tests de non-régression sur login/refresh/logout

### 1.3 Aucun stockage de tokens côté front
- Interdiction de stocker access/refresh tokens dans localStorage/sessionStorage.
- Les cookies HttpOnly sont la seule source de session.
- Le front manipule uniquement un **CSRF token** (non HttpOnly), et éventuellement un état UI.

### 1.4 Change management
- Toute modification du schéma DB = migration Prisma + documentation.
- Toute route API = documentée (OpenAPI/Markdown) + tests.
- Toute action sensible = audit log.

---

## 2) Workflow strict pour les agents IA
### 2.1 Format de sortie attendu à chaque itération
Pour chaque tâche, l’agent doit fournir :
1) **Résumé** de ce qui a été fait (liste précise)
2) **Fichiers créés/modifiés** (liste)
3) **Commandes** pour tester en local
4) **Checklist sécurité** : points 1–15 impactés + comment c’est couvert
5) **Edge cases** traités (énumération)
6) **Risques** restants + TODO (uniquement si non-bloquant; sinon corriger avant livraison)

### 2.2 Interdictions
- Pas de “TODO security later”
- Pas de contournement CORS/CSRF “pour que ça marche”
- Pas de routes admin sans RBAC/ABAC
- Pas de secrets dans le repo (y compris exemples)
- Pas de dépendances non justifiées ou non pinnées
- Pas de logs contenant OTP, tokens, secrets, ou données sensibles (PII inutile)

### 2.3 Branching & PR
- Une feature = une branche.
- PR = description + checklist + liens vers docs (implementations/*.md).
- PR doit passer : lint + tests + scans CI.

---

## 3) Paramètres sécurité standards (valeurs par défaut)
### 3.1 Sessions
- Access JWT TTL: 15 minutes
- Refresh opaque TTL: 30 jours (révocable, rotatif)
- Idle timeout: 30 minutes (réauth exigée si idle dépasse)
- Reauth max: 12 heures (NIST AAL2)

### 3.2 CSRF (cookies HttpOnly)
- Toutes les routes **state-changing** (POST/PUT/PATCH/DELETE) exigent :
  - Vérification **Origin/Referer** stricte
  - Header **X-CSRF-Token** valide
- Exception unique : endpoints **webhooks** (public) => CSRF non applicable, mais signature + idempotency obligatoires.

### 3.3 Pre-signed URLs S3
- Upload (PUT): 60–120 secondes
- Download export ZIP (GET): 120 secondes (le plus court possible)
- Bucket privé uniquement
- Lifecycle rules:
  - exports/: purge J+1
  - imports/: purge J+30
  - avatars/old/: purge J+30

### 3.4 Rate limits (à affiner en prod)
- /auth/login : 5 req/min/IP + 5 req/min/account
- /auth/register : 3 req/min/IP
- /auth/reset : 3 req/min/IP
- /phone/verify/start : 2 req/min/IP + quotas Twilio
- /phone/verify/check : 5 req/min/IP + lockouts
- /auth/refresh : 10 req/min/session
- Admin routes : plus strictes + IP allowlist optionnelle

### 3.5 Captcha adaptatif
- Captcha requis si signaux:
  - trop d’échecs login
  - trop d’envoi OTP
  - IP suspecte / ASN suspect
  - user-agent anormal / burst

---

## 4) Dossiers du projet
- /implementations : les prompts/consignes pour implémenter les features
- /feedback : retours (bugs, sécurité, refactors, décisions)
- /Agents.md : ce fichier (règles globales)
- /React.md : bonnes pratiques frontend (React + sécurité + cookies)

---

## 5) “Implémentation courante”
L’agent doit toujours se baser sur les documents dans /implementations :
- Feature 00 : Foundations sécurité (CI, headers, CORS, sessions, RBAC, audit, secrets, crypto, RGPD bases)
- Feature 01 : Auth complète + email SMTP + Twilio Verify + MFA TOTP + OAuth Google/GitHub
- Feature 02 : Billing Stripe (Subscriptions mensuelles + Stripe Tax + Customer Portal + Webhooks idempotents + Roles premium/vip + Quotas)
- Feature 03 : Profil + Onboarding obligatoire + RGPD (export async + suppression J+7) + Avatars S3 (OVH) pre-signed URLs
- Feature 04 : Frontend User React (Auth A→H + Pricing + Profile with onboarding intégré + Billing) — HTTPS dev via Nginx + CSRF token en mémoire

IMPORTANT:
- Tant que Feature 00 n’est pas validée, ne pas commencer Feature 01.
- Tant que Feature 01 n’est pas validée, ne pas commencer Feature 02.
- Toute déviation doit être justifiée dans /feedback (avec impacts sécurité).

---

## 6) Règles Stripe (Feature 02) — non négociables
- Interdiction absolue d’attribuer `premium`/`vip` via le front (success_url, callback, query params, UI).
- Attribution/révocation uniquement via webhook Stripe (signature validée) + idempotency + validation **price_id**/**currency**.
- Webhook idempotent obligatoire : table `webhook_events` avec `event_id` unique ; replay => 200 no-op.
- Webhook Stripe exige le **raw body** : Express doit être configuré pour fournir le raw body au middleware Stripe (sinon signature impossible).
- Toute transition subscription/payment/role => audit log immuable.
- Endpoints billing state-changing => CSRF token + Origin/Referer strict + rate limiting + captcha adaptatif si abus.
- Stripe Tax activé (TVA) : `automatic_tax: { enabled: true }` sur Checkout.
- Secrets Stripe uniquement via env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Aucun secret commité.

### 6.1 Rate limits Billing (V1)
- /billing/checkout-session : 3 req/min/user + 10 req/min/IP (+ captcha adaptatif si abus)
- /billing/portal : 5 req/min/user
- /webhooks/stripe : pas de rate-limit bloquant côté app (risque de rater Stripe), mais Nginx/WAF + signature strict + idempotency

---