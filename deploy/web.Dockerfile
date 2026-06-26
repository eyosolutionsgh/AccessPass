# syntax=docker/dockerfile:1
# VMS web SPA — React 19 + Vite, built then served as static files by nginx.
#
# Build context is the REPO ROOT (pnpm monorepo): the web bundle pulls in the @vms/shared
# (RBAC/roles) and @vms/server (tRPC AppRouter types) workspace packages.
# The app talks to the API over same-origin relative paths (/trpc, /api, /socket.io), so
# Caddy — not nginx — routes those to the API container. nginx only serves the SPA.
FROM node:20-bookworm-slim AS build

ENV HUSKY=0 \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable
WORKDIR /app

COPY . .

# Install the web app's workspace subgraph (web + shared + server for types) and build it.
# Bump the heap so the Vite build doesn't OOM on a small host.
RUN pnpm install --frozen-lockfile \
  && NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @vms/web build

FROM nginx:alpine
COPY deploy/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
