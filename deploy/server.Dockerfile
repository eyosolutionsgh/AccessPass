# syntax=docker/dockerfile:1
# VMS API server — Express + tRPC + better-auth + BullMQ workers.
#
# Build context is the REPO ROOT (this is a pnpm monorepo): the server bundle inlines the
# @vms/shared workspace package, and migrations are applied from the generated drizzle/ SQL.
# Built with:  docker build -f deploy/server.Dockerfile .
FROM node:20-bookworm-slim

# OpenSSL/ca-certificates for TLS to Postgres/SMTP/object storage; tini for clean PID 1 signals.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

# HUSKY=0 skips git hooks (no .git in the image); skip the heavy Electron binary download —
# the kiosk app is never built here.
ENV HUSKY=0 \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production \
    DRIZZLE_MIGRATIONS_DIR=/app/drizzle

RUN corepack enable
WORKDIR /app

# Whole monorepo (node_modules/.data/.git are excluded by .dockerignore).
COPY . .

# Install every workspace's deps (dev deps included — esbuild compiles the bundle), then build
# the server bundle: dist/index.js, dist/migrate.js, dist/seed.js (each inlines @vms/shared).
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @vms/server build \
  && pnpm prune --prod \
  && chmod +x deploy/server-entrypoint.sh

EXPOSE 4000

# tini reaps zombies and forwards SIGTERM so the server's graceful shutdown runs.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/deploy/server-entrypoint.sh"]
