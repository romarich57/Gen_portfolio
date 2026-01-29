# Docker Development Environment

Run the SaaS Builder application in Docker with HTTPS support.

## Prerequisites

- Docker & Docker Compose
- macOS, Linux, or Windows with WSL2

## Quick Start

### 1. Generate SSL Certificates

```bash
./ops/scripts/generate-certs.sh
```

### 2. Start All Services

```bash
docker compose -f docker-compose.dev.yml up
```

### 3. Access the Application

| Service  | URL                        |
|----------|----------------------------|
| Frontend | https://localhost:3000     |
| Backend  | https://localhost:4000     |
| MinIO    | http://localhost:9001      |
| Postgres | localhost:5434             |
| Redis    | localhost:6379             |

> **Note**: Accept the self-signed certificate warning in your browser.

## Services

| Service   | Container Name        | Port(s)      | Description                    |
|-----------|-----------------------|--------------|--------------------------------|
| nginx     | saas_builder_nginx    | 3000, 4000   | SSL reverse proxy              |
| frontend  | saas_builder_frontend | 5173 (int)   | Vite React dev server          |
| backend   | saas_builder_backend  | 4100 (int)   | Express API with hot-reload    |
| db        | saas_builder_db       | 5434:5432    | PostgreSQL 16                  |
| minio     | saas_builder_minio    | 9000, 9001   | S3-compatible storage          |
| redis     | saas_builder_redis    | 6379         | Rate limit store (Redis)       |

## Hot Reload

Both frontend and backend support hot-reload:
- **Frontend**: Edit files in `apps/frontend/src/` → browser updates automatically
- **Backend**: Edit files in `apps/backend/src/` → server restarts automatically

## Commands

```bash
# Start all services
docker compose -f docker-compose.dev.yml up

# Start in background
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop all services
docker compose -f docker-compose.dev.yml down

# Rebuild after Dockerfile changes
docker compose -f docker-compose.dev.yml up --build

# Run Prisma migrations
docker compose -f docker-compose.dev.yml exec backend npx prisma db push
```

## Playwright (real E2E)

The repository includes a **real** Playwright test for the MFA-required gate.
It runs against the live HTTPS stack (Nginx) and expects a prepared account.

Prerequisites:
- A user with completed profile (first_name/last_name/username/nationality).
- MFA **required** for that user (global flag or user override).
- MFA not enabled yet (so `/setup-mfa` is expected).

Run:
```bash
export PLAYWRIGHT_USE_NGINX=true
export PLAYWRIGHT_BASE_URL=https://localhost:3000
export E2E_USER_EMAIL="user@example.com"
export E2E_USER_PASSWORD="your_password"
export E2E_EXPECT_MFA_REQUIRED=true
cd apps/frontend
npm run test:e2e -- tests/e2e/mfa-required.real.spec.ts
```

## Environment Variables

Backend secrets can be configured via:
1. `.env` file in project root
2. `docker-compose.override.yml`

Example override file:
```yaml
services:
  backend:
    environment:
      ACCESS_TOKEN_SECRET: your_secret_here
      REDIS_URL: redis://redis:6379
```

## Redis & Alerting

Redis is used for rate limiting and service status checks. The dev stack starts a Redis
container automatically and sets `REDIS_URL=redis://redis:6379` for the backend.

Optional alerting (SMTP/S3/Redis) can be enabled by configuring:
- `SERVICE_STATUS_ALERT_EMAIL`
- `SERVICE_STATUS_ALERT_SLACK_WEBHOOK`
- `SERVICE_STATUS_CRON_ENABLED=true` (enabled by default)

## Troubleshooting

### Certificates not found
```bash
./ops/scripts/generate-certs.sh
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3000
lsof -i :4000

# Stop the conflicting process
kill <PID>
```

### Database connection issues
```bash
# Check if db is healthy
docker compose -f docker-compose.dev.yml ps

# View db logs
docker compose -f docker-compose.dev.yml logs db
```
