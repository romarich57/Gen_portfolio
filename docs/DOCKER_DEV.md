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

> **Note**: Accept the self-signed certificate warning in your browser.

## Services

| Service   | Container Name        | Port(s)      | Description                    |
|-----------|-----------------------|--------------|--------------------------------|
| nginx     | saas_builder_nginx    | 3000, 4000   | SSL reverse proxy              |
| frontend  | saas_builder_frontend | 5173 (int)   | Vite React dev server          |
| backend   | saas_builder_backend  | 4100 (int)   | Express API with hot-reload    |
| db        | saas_builder_db       | 5434:5432    | PostgreSQL 16                  |
| minio     | saas_builder_minio    | 9000, 9001   | S3-compatible storage          |

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
```

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
