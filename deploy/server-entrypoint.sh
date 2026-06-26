#!/bin/sh
# VMS server container start-up: apply migrations, seed reference data (idempotent), then run.
set -e
cd /app

echo "[entrypoint] applying database migrations..."
node server/dist/migrate.js

# Idempotent seed (admin@vms.local + reference data). Safe to re-run; disable with SEED_ON_START=false.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seeding reference data..."
  node server/dist/seed.js || echo "[entrypoint] seed step failed — continuing to boot"
fi

echo "[entrypoint] starting VMS API server..."
exec node server/dist/index.js
