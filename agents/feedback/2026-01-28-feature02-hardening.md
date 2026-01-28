# Feature 02 hardening follow-ups (2026-01-28)

## Decisions
- Added `npm run lint` in `apps/backend/package.json` mapped to `tsc --noEmit` to satisfy lint command requirement without introducing ESLint configuration yet.
- Added `ops/nginx/stripe_webhook.conf` as a hardened Nginx snippet with generic `server_name` and `backend_upstream` placeholders; these must be set per environment.

## Rationale
- Keep dependency surface minimal while ensuring a deterministic lint command exists.
- Provide a concrete, security-focused Nginx baseline without embedding environment-specific values.
