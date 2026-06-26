# VMS — single-node deployment

Production stack for the Visitor Management System, mirroring the DVLA IDP deployment pattern:
a Docker Compose stack behind a Caddy reverse proxy with automatic HTTPS. Everything is
self-hosted on one box — no managed cloud services.

## Stack

| Service        | Image                     | Exposed        | Purpose                                   |
| -------------- | ------------------------- | -------------- | ----------------------------------------- |
| `caddy`        | caddy:2                   | 80, 443        | Reverse proxy + automatic TLS             |
| `web`          | built (`web.Dockerfile`)  | internal       | React/Vite SPA served by nginx            |
| `server`       | built (`server.Dockerfile`)| internal      | Express + tRPC + better-auth + BullMQ     |
| `postgres`     | pgvector/pgvector:pg16    | internal       | Primary database                          |
| `redis`        | redis:7-alpine            | internal       | Cache, rate-limit store, BullMQ queue     |
| `minio`        | minio/minio               | internal       | S3-compatible object storage (documents)  |
| `mailpit`      | axllent/mailpit           | internal       | Outbound-mail sink (swap for real SMTP)   |

Because the SPA talks to the API over **same-origin relative paths** (`/trpc`, `/api`,
`/socket.io`), a single hostname (`vms.3dt.com.gh`) serves both — Caddy routes the API paths to
`server` and everything else to `web`.

## First-time deploy

1. **DNS** — point an `A` record for `vms.3dt.com.gh` at the server's public IP. Caddy needs this
   resolvable before it can complete the Let's Encrypt challenge.

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
   (`admin@vms.local` / `Admin123!`) on first boot.

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

## Operations

```bash
# logs
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f server

# view captured email (Mailpit UI) over an SSH tunnel from your laptop:
ssh -L 8025:localhost:8025 root@<server-ip> \
  'docker compose --env-file /opt/vms/deploy/.env -f /opt/vms/deploy/docker-compose.yml exec -T mailpit true'
# then open http://localhost:8025  (or simpler: ssh -L 8025: ... and `docker port`/network expose)

# database backup
docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec -T postgres \
  pg_dump -U vms vms | gzip > vms-$(date +%F).sql.gz
```

## Real email

The default points SMTP at the internal Mailpit sink (captures, does not deliver). To deliver for
real, set in `deploy/.env` and recreate the `server`:

```
SMTP_HOST=mail.3dt.com.gh
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=vms@3dt.com.gh
SMTP_PASS=<relay-password>
```
