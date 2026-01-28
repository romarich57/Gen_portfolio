# Feature 00 — Foundations sécurité (AVANT LOGIN)
Objectif: poser un socle "Enterprise security" pour que toute feature future hérite automatiquement des protections.

Stack imposée:
- Backend: Node.js + Express
- DB: PostgreSQL
- ORM: Prisma
- Proxy: Nginx (OVH) + HTTPS
- Auth: cookies HttpOnly (plus tard)
- Storage: OVH Object Storage S3-compatible (private bucket) (plus tard)
- CI: scans sécurité

---

## A) Livrables attendus (obligatoires)
Créer/mettre à jour les fichiers suivants dans le repo:

1) `SECURITY_BASELINE.md`
- Résumé des 15 piliers de sécurité + comment ils sont implémentés dans ce repo.
- Valeurs par défaut (TTL tokens, cookies flags, rate-limit values).
- Checklist DoD par PR.

2) `CI_SECURITY.md`
- Outils choisis (dependency scan, secret scan, SAST, SBOM, scan docker).
- Quand ils tournent (PR/push/main).
- Politique "fail build".

3) `THREAT_MODEL_AUTH.md`
- Threat modeling minimal pour:
  - auth classique
  - OAuth
  - email verify
  - phone verify
  - MFA
  - sessions refresh rotation
- Scénarios: brute force, token theft, CSRF, session fixation, refresh reuse, SSRF, XSS, injection, enumeration.

4) `OPENAPI_BASE.md` (ou `docs/api.md`)
- Base conventions: status codes, formats erreurs neutres, request_id, pagination.

5) Code backend:
- Middleware headers sécurité (CSP/HSTS/etc.)
- Middleware CORS strict allowlist
- Middleware rate limiting (IP + route + user si dispo)
- Middleware CSRF (préparation: Origin/Referer + token)
- Middleware request_id + logging structuré
- Squelette RBAC/ABAC (deny-by-default)
- Audit log writer (append-only)
- Gestion secrets via env (sans secrets commit)

6) Prisma:
- Setup Prisma + migrations init
- Tables minimales pour foundations:
  - audit_logs (append-only)
  - feature_flags (ex: mfa_required_global)
  - app_settings (config sécurité)
  - (optionnel) permissions/roles tables (si tu veux DB-driven)

7) Tests:
- Tests unitaires: middleware headers, CORS, rate-limit
- Tests d’intégration: vérifie headers sur une route test
- Tests sécurité: CORS interdit, CSRF rejet si Origin absent (pour routes state-changing)

---

## B) Spécifications strictes (sans omission)

### B1) Headers sécurité (Point 6)
Implémenter un middleware (avant toutes routes) qui définit au minimum:
- HSTS (sur HTTPS)
- CSP (au moins: object-src 'none', base-uri, frame-ancestors, script-src)
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy
- frame-ancestors (via CSP) ou X-Frame-Options (legacy)

Notes:
- CSP doit être compatible avec React (pas d’inline scripts en prod).
- Documenter les directives dans `SECURITY_BASELINE.md`.

### B2) CORS strict (Point 6)
- Allowlist stricte par environnement:
  - dev: http://localhost:3000
  - prod: https://<ton-domaine>
- `credentials: true` autorisé uniquement si origin allowlisted
- Interdiction: `Access-Control-Allow-Origin: *` si credentials

### B3) Rate limiting (Point 2 + 7)
- Implémenter rate limit global + par route "sensible" (auth, OTP, reset, etc.)
- Prévoir clé composite:
  - IP
  - route
  - éventuellement email/username (anti brute force par compte)
- Ajout d’un "captcha_required" signal (feature future) via response code ou champ JSON

### B4) Logging + request_id + audit (Point 10)
- Générer `request_id` sur chaque requête (header + logs).
- Logs structurés (JSON) en stdout/fichier.
- Audit logs en DB append-only:
  - colonnes: id, timestamp, actor_user_id (nullable), actor_ip, action, target_type, target_id, metadata_json, request_id
- Toute action sensible future doit écrire audit.

### B5) RBAC/ABAC skeleton (Point 4)
- Créer un module:
  - `requireAuth` (placeholder tant que sessions pas faites)
  - `requireRole` (admin/super_admin)
  - `requirePermission` (fine-grained)
  - `requireOwnership` (contrôle objet)
- Politique: deny-by-default. Toute route doit déclarer ses exigences.

### B6) Secrets management (Point 9)
- `.env.example` SANS secrets réels
- Validation au boot (si env manquantes => crash)
- Préparer rotation: ne jamais “embed” secrets en DB non chiffrés

### B7) Chiffrement & données (Point 8 + 14)
- Forcer HTTPS via Nginx (redirect HTTP->HTTPS)
- Écrire une politique de rétention (même si les données arrivent plus tard)
- Prévoir champs "deleted_at" pour RGPD suppression
- Prévoir `consents` structure (sera utilisée en feature 01/plus tard)

### B8) CI sécurité (Point 1 + 12 + 15)
CI doit inclure:
- dependency scan (fail si vuln critique)
- secret scanning (fail si secret détecté)
- SAST (fail si findings haut)
- SBOM (génération artefact)
- scan image docker (si dockerfile présent)

Documenter les outils et règles.

---

## C) Critères d’acceptation (Definition of Done Feature 00)
- Le backend démarre sans warnings secrets.
- Les headers sont présents sur une route /health.
- CORS refuse toute origin non allowlist.
- Rate limiting fonctionne (test automatisé).
- request_id est présent et loggé.
- audit_logs table existe et un helper permet d’écrire un audit event.
- Skeleton RBAC existe et est appliqué sur au moins 1 route "protected test".
- CI sécurité est configurée et passe.
- Documentation `SECURITY_BASELINE.md` et `THREAT_MODEL_AUTH.md` livrées.

---

## D) Checklist sécurité (agent doit cocher)
- [ ] Points 1,6,7,9,10,12,15 au minimum couverts dans cette feature
- [ ] Aucun secret commité
- [ ] Tests ajoutés et green
- [ ] Docs mises à jour