# Visitor Management System (VMS)

On-facility visitor management with invitation-code / QR-code check-in, pre-registration,
kiosk + reception desks, host/security notifications, badges, temporary access control,
real-time on-site visibility, audit logging, and 7-role RBAC across multiple facility.

Implements `Visitor_Management_System_SRS.docx` (v1.0).

## Tech stack

| Layer         | Stack                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Monorepo      | pnpm workspaces · TypeScript 5.9 (strict) · ESM                                                        |
| Web           | React 19 · Vite 7 · Tailwind 4 · shadcn/ui · TanStack Query · wouter                                   |
| API           | Express 4 · **tRPC 11** (internal) + REST/OpenAPI gateway (integrations)                               |
| Auth          | **better-auth** — admin plugin (7 roles, fine-grained perms) + organization plugin (per-facility RBAC) |
| Data          | PostgreSQL 16 · **Drizzle ORM** · Redis (BullMQ jobs, rate-limit) · MinIO (S3-compatible)              |
| Kiosk         | Electron (electron-vite) — native badge printer / QR / ID scanner                                      |
| Notifications | nodemailer → corporate SMTP · Socket.io (real-time) · Web Push · pluggable SMS                         |

Everything self-hosted — **no cloud dependencies** (intranet / air-gap capable).

## Repository layout

```
vms/
├─ apps/web/      React + Vite — admin, host, reception, security portals + visitor pre-reg
├─ apps/kiosk/    Electron kiosk — locked-down shell + native badge printing
├─ server/        Express + tRPC + REST gateway + better-auth + BullMQ workers
├─ shared/        Drizzle schema, Zod schemas, tRPC types, RBAC definitions
├─ drizzle/       Generated SQL migrations
└─ docker-compose.yml
```

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env        # then edit secrets

# 3. Start on-prem infrastructure (postgres, redis, minio)
pnpm infra:up

# 4. Create database schema (non-interactive: generate + migrate)
pnpm db:generate && pnpm db:migrate

# 5. Seed an admin + reference data (aaodoom@gmail.com / Admin123!)
pnpm --filter @vms/server seed

# 6. Run the app (server :4000 + web :5173)
pnpm dev

# 7. (optional) Run the Electron kiosk — loads the web check-in UI in a locked-down window
KIOSK_FACILITY_ID=<facility-uuid> pnpm --filter @vms/kiosk dev
```

Health check: `GET http://localhost:4000/health`. Email is sent via the MailerSend SMTP relay
(configure `SMTP_*` in `.env`); there is no local mail sink.

The kiosk (`apps/kiosk`) is configured via env (`KIOSK_WEB_URL`, `KIOSK_DEVICE_ID`,
`KIOSK_FACILITY_ID`, `KIOSK_PRINTER`); without `KIOSK_PRINTER` set, badges render to PDF in the
temp dir. Packaging with electron-builder is a follow-up.

## Common scripts

| Command                             | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `pnpm dev`                          | Run server + web together                |
| `pnpm check`                        | Type-check all packages (`tsc --noEmit`) |
| `pnpm lint` / `pnpm format`         | ESLint / Prettier                        |
| `pnpm test`                         | Run vitest across packages               |
| `pnpm db:push`                      | Push Drizzle schema to the database      |
| `pnpm db:studio`                    | Open Drizzle Studio                      |
| `pnpm infra:up` / `pnpm infra:down` | Start / stop Docker infra                |

## Build order (see SRS Appendix D — MVP)

1. **Foundation** ✅ — monorepo, Docker infra, Drizzle schema, better-auth + RBAC, tRPC bootstrap
2. **Appointments & invitations** ✅ — host portal, approval workflow, invitation codes + opaque QR
   tokens (hashed at rest), SMTP email invites, audit logging
3. **Pre-registration + check-in** ✅ — §7.4 validation engine (rate-limited, watchlist, incident
   escalation), public kiosk check-in/out, pre-reg gate, reception dashboard, real-time on-site list
4. **Kiosk (Electron)** ✅ — locked-down shell (`kiosk:true`, no nav/menu, session reset per visitor),
   loads the web check-in UI, native badge printing (printToPDF / silent print), device context
5. **Badges, check-out, credential lifecycle** ✅ — badge reprint (audited), self-service check-out
   (code/badge QR), pluggable access-control adapter, BullMQ sweep (credential/access expiry +
   overstay incidents)
6. **Security & audit** ✅ — security dashboard (KPIs + incident queue + resolve), watchlist
   management (HMAC-matched), emergency muster with CSV/print export, filterable audit log,
   role-gated navigation
7. **Admin, reporting & integrations** ✅ — admin config (facility, categories, retention, staff
   users via better-auth, directory host import), reports + CSV/XLSX export, REST/OpenAPI gateway
   (API-key auth), access-control + SIEM webhooks, daily retention/anonymization job

**All MVP build phases (SRS Appendix D) complete.**
