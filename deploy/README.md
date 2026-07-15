# VMS — single-node deployment

Production stack for the Visitor Management System, mirroring the DVLA IDP deployment pattern:
a Docker Compose stack behind a Caddy reverse proxy with automatic HTTPS. Everything is
self-hosted on one box — no managed cloud services.

## Stack

| Service    | Image                       | Exposed  | Purpose                                  |
| ---------- | --------------------------- | -------- | ---------------------------------------- |
| `caddy`    | caddy:2                     | 80, 443  | Reverse proxy + automatic TLS            |
| `web`      | built (`web.Dockerfile`)    | internal | React/Vite SPA served by nginx           |
| `server`   | built (`server.Dockerfile`) | internal | Express + tRPC + better-auth + BullMQ    |
| `postgres` | pgvector/pgvector:pg16      | internal | Primary database                         |
| `redis`    | redis:7-alpine              | internal | Cache, rate-limit store, BullMQ queue    |
| `minio`    | minio/minio                 | internal | S3-compatible object storage (documents) |

Two hostnames, both pointed at this server:

- `vms.3dt.com.gh` → the React SPA (`web` container)
- `api.vms.3dt.com.gh` → the API (`server` container) — tRPC, REST gateway, better-auth, Socket.io

The web bundle is built with `VITE_API_URL=https://api.vms.3dt.com.gh`, so the browser calls the
API host directly (with credentials — the better-auth session cookie is set on that host).
`vms.3dt.com.gh` and `api.vms.3dt.com.gh` share the registrable domain `3dt.com.gh`, so the
session cookie is same-site and CORS is configured to allow the SPA origin.

## First-time deploy

1. **DNS** — point `A` records for both `vms.3dt.com.gh` and `api.vms.3dt.com.gh` (a
   `*.vms.3dt.com.gh` wildcard covers the latter) at the server's public IP. Caddy needs both
   resolvable before it can complete the Let's Encrypt challenges.

2. **Get the code onto the box** (`/opt/vms`):

   ```bash
   git clone https://github.com/eyosolutionsgh/visitors-management-system.git /opt/vms
   cd /opt/vms
   ```

3. **Configure secrets:**

   ```bash
   cp deploy/.env.example deploy/.env
   # generate strong values:
   #   openssl rand -hex 24      # POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, S3_SECRET_KEY
   #   openssl rand -base64 32   # BETTER_AUTH_SECRET, QR_TOKEN_SECRET
   #   openssl rand -hex 16      # FIELD_ENCRYPTION_KEY (32 chars)
   # Keep DATABASE_URL's password identical to POSTGRES_PASSWORD.
   vi deploy/.env
   ```

4. **Build & start:**

   ```bash
   docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
   ```

   The `server` container applies migrations and runs the idempotent seed
   (`aaodoom@gmail.com` / `Admin123!`) on first boot.

5. **Verify:**

   ```bash
   curl -fsS https://vms.3dt.com.gh/health        # {"status":"ok",...}
   curl -fsS https://vms.3dt.com.gh/ready         # {"db":true,"redis":true}
   ```

   Then sign in at `https://vms.3dt.com.gh` and **change the admin password immediately**, then
   set `SEED_ON_START=false` in `deploy/.env`.

## Updating

```bash
cd /opt/vms && git pull
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

## Box lifecycle (create / destroy / restore)

[`lifecycle/`](lifecycle/) is an `hcloud`-based toolkit to snapshot-and-park the
box cheaply and bring it back on the **same IP** (no DNS change, data preserved):

```bash
cd deploy/lifecycle
export HCLOUD_TOKEN=<vms project token>
./box-create.sh     # first-time provisioning (server + firewall + reserved IP)
./box-destroy.sh    # snapshot + delete server, KEEP the IP  (cheap idle)
./box-restore.sh    # recreate from snapshot, reattach IP, converge to main
./box-status.sh     # server/IP/snapshot/container health
```

See [`lifecycle/README.md`](lifecycle/README.md) for details.

## Operations

```bash
# logs
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f server

# database backup
docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec -T postgres \
  pg_dump -U vms vms | gzip > vms-$(date +%F).sql.gz
```

## Email (MailerSend API)

Mail is sent via the MailerSend HTTP API (`https://api.mailersend.com/v1/email`) — no SMTP, no local
sink. `MAILERSEND_FROM_EMAIL` must be on a MailerSend-verified domain (`3dt.com.gh` is DKIM/SPF
verified). Set in `deploy/.env`:

```
EMAIL_PROVIDER=mailersend
MAILERSEND_API_TOKEN=<mlsn... token from the MailerSend dashboard>
MAILERSEND_FROM_EMAIL=vms@3dt.com.gh
MAILERSEND_FROM_NAME=vms
```

then recreate the server: `docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d server`.

> **Don't test with `@mailinator.com`.** MailerSend blocklists it, so those messages are accepted
> but never delivered. Verify with a real mailbox.
