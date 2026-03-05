# Redis Setup (Rate Limiting + Service Alerts)

## Purpose
Redis is used as a shared rate-limit store and for service status checks.
In production, Redis is required to avoid rate-limit bypass across instances.

## Dev (Docker Compose)
`docker-compose.dev.yml` includes a Redis service and the backend is configured
with `REDIS_URL=redis://redis:6379`.

Commands:
```bash
docker compose -f docker-compose.dev.yml up
```

If you run the backend locally (without Docker), set:
```
REDIS_URL=redis://localhost:6379
```

## Prod (Managed Redis)
Use a managed Redis service and configure:
```
REDIS_URL=rediss://user:pass@your-redis-host:6380
```
Notes:
- Use `rediss://` when TLS is required.
- Do not commit credentials; use environment variables or secret manager.
- Production requires TLS (`rediss://`) **and** authentication (password in URL).

## Redis TLS certs (stunnel)
Les certificats Redis TLS ne doivent pas etre versionnes dans le repo.

Generation locale:
```bash
./ops/scripts/generate-redis-certs.sh
```

Artifacts generes:
- `ops/redis/certs/stunnel.pem` (certificat serveur + cle privee, sensible)
- `ops/redis/certs/redis-ca.crt` (certificat CA uniquement, sans cle privee)

Verification rapide:
```bash
grep -n "BEGIN PRIVATE KEY" ops/redis/certs/redis-ca.crt
# Doit retourner 0 resultat
```

## Runbook rotation immediate (obligatoire si exposition)
1. Generer un nouveau jeu de certificats:
```bash
./ops/scripts/generate-redis-certs.sh
```
2. Publier les nouveaux secrets/certs via votre secret manager ou volume securise.
3. Redemarrer les composants dans cet ordre:
   - `redis-tls` (stunnel),
   - `backend`,
   - `backend_worker`.
4. Verifier la connectivite TLS Redis:
   - health backend OK,
   - absence d'erreurs TLS Redis dans les logs.
5. Invalider/supprimer tout ancien materiel de cle expose.

## Connection Alerting
Service checks run on a cron and can notify when SMTP/S3/Redis is degraded.
Enable alerts by setting one or both:
```
SERVICE_STATUS_ALERT_EMAIL=ops@example.com
SERVICE_STATUS_ALERT_SLACK_WEBHOOK=https://hooks.slack.com/...
SERVICE_STATUS_CRON_ENABLED=true
SERVICE_STATUS_ALERT_COOLDOWN_MINUTES=30
```
Alerts are sent only on state changes (OK -> DEGRADED or DEGRADED -> OK).
