# SECURITY_BASELINE

## 1) Piliers sécurité (ASVS/OWASP/NIST AAL2) — implémentation repo
1. **Gouvernance & Secure SDLC**: DoD sécurité (ci-dessous), threat model par feature, CI sécurité obligatoire.
2. **Identité & Auth**: fondations prêtes (RBAC/ABAC skeleton, anti brute force via rate limit). Auth complète en Feature 01.
3. **Sessions & Tokens**: cookies HttpOnly + rotation refresh planifiée (Feature 01). Middleware CSRF en place.
4. **Contrôle d’accès RBAC/ABAC**: middlewares `requireAuth/requireRole/requirePermission/requireOwnership` (deny-by-default).
5. **Validation entrées & anti-injection**: JSON limit + Prisma ORM (requêtes paramétrées). Validation stricte par endpoint à venir.
6. **Sécurité HTTP headers**: CSP/HSTS/Referrer/Permissions/NoSniff/Frameguard appliqués globalement.
7. **API Security**: rate limit global + route-level, anti-enum (erreurs neutres), CORS strict. Store Redis requis en prod.
8. **Chiffrement & Data handling**: TLS via Nginx (prod), tokens sensibles hashés, secrets TOTP chiffrés, politique rétention documentée.
9. **Secrets management**: env obligatoires, aucun secret en repo, validation au boot.
10. **Logs/Monitoring/Audit**: request_id, logs JSON, audit logs append-only.
11. **Infra/Zero-trust**: Nginx HTTPS (prod), trust proxy contrôlé, segmentation prévue.
12. **Supply chain/CI-CD**: scans dépendances, secrets, SAST, SBOM, image scan (si Dockerfile).
13. **Backups/Résilience**: stratégie à appliquer côté DB (documentée).
14. **RGPD UE**: structures `data_subjects`/`consents` + soft delete (`deleted_at`).
15. **Tests sécurité & validation continue**: tests unit/integration/security obligatoires.

## 2) Valeurs par défaut
- **Access JWT TTL**: 15 min
- **Refresh opaque TTL**: 30 jours
- **Idle timeout**: 30 min
- **Reauth max**: 12 heures
- **Cookies**: HttpOnly + Secure + SameSite (Lax/Strict selon endpoint)
- **CORS**: allowlist stricte
- **Rate limits (base)**:
  - /auth/login: 5 req/min/IP + 5 req/min/account
  - /auth/register: 3 req/min/IP
  - /auth/reset: 3 req/min/IP
  - /auth/refresh: 10 req/min/session
  - routes admin: plus strictes
- **CSRF**: Origin/Referer strict + token double-submit

## 3) DoD sécurité par PR
- [ ] Docs sécurité mises à jour (baseline + threat model si impact)
- [ ] Tests unitaires/integration/sécurité ajoutés + green
- [ ] Aucun secret commité
- [ ] RBAC/ABAC appliqué aux routes sensibles (deny-by-default)
- [ ] Audit log sur actions sensibles
- [ ] Headers/CORS/CSRF respectés
- [ ] CI sécurité passe (deps/secret/SAST/SBOM)

## 4) Politique rétention (initiale)
- Logs applicatifs: 30 jours (rolling)
- Audit logs: rétention minimale 1 an (immuable)
- Exports temporaires: J+1
- Imports temporaires: J+30
- Avatars anciens: J+30

## 5) Notes
- Le proxy HTTPS (Nginx OVH) force TLS et redirige HTTP → HTTPS.
- Les secrets sont toujours fournis via variables d’environnement.
