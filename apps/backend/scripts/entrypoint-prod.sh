#!/bin/sh
set -e

MODE="${SERVICE_MODE:-api}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Running Prisma migrate deploy..."
  npx prisma migrate deploy
fi

if [ "$MODE" = "worker" ]; then
  echo "[entrypoint] Starting GDPR worker..."
  exec node dist/worker.js
fi

echo "[entrypoint] Starting API..."
exec node dist/server.js
