#!/usr/bin/env bash
# Shared config for the VMS box lifecycle scripts (create/destroy/restore/status).
# Every value is overridable from the environment so the scripts stay portable
# across Hetzner projects. Requires the `hcloud` CLI + `jq`.
#
#   brew install hcloud jq
#   HCLOUD_TOKEN=<token> hcloud context create vms --token-from-env
#
# The lifecycle pattern keeps the reserved IP + a snapshot between runs so the
# idle cost is a few EUR/month, and a restore brings the box back in ~5 min with
# the SAME IP — no DNS change, no rebuild, no re-seed, no re-migrate (the data
# lives in the snapshot).

# hcloud context (local alias for the Hetzner project)
HCLOUD_CONTEXT="${HCLOUD_CONTEXT:-vms}"

# Server. NOTE: the ARM cax21 (cheaper, matches arm64 dev) is the preferred type
# but was sold out across all EU locations at provisioning time, so the default
# is the current-gen Intel cx33 (4 vCPU / 8 GB / 80 GB). Override to taste.
SERVER_NAME="${SERVER_NAME:-vms-prod}"
SERVER_TYPE="${SERVER_TYPE:-cx33}"
SERVER_LOCATION="${SERVER_LOCATION:-fsn1}"   # Falkenstein
SERVER_OS_IMAGE="${SERVER_OS_IMAGE:-ubuntu-24.04}"

# SSH key. SSH_KEY_NAME is the name under which the operator key is (or will be)
# registered in the Hetzner project; box-create.sh auto-registers
# LOCAL_SSH_PUBKEY under that name if it isn't there yet.
SSH_KEY_NAME="${SSH_KEY_NAME:-vms-deploy-key}"
LOCAL_SSH_PUBKEY="${LOCAL_SSH_PUBKEY:-$HOME/.ssh/id_ed25519.pub}"

# Hetzner Cloud Firewall (created by box-create.sh; opens 22/80/443 + ICMP).
FIREWALL_NAME="${FIREWALL_NAME:-vms-fw}"

# Cloud-init user-data for first boot (Docker, swap, hardening). Relative to
# this directory.
CLOUD_INIT_FILE="${CLOUD_INIT_FILE:-cloud-init.yaml}"

# Reserved primary IP (kept across destroy/recreate so DNS never changes). IPv6
# is disabled by default (DNS uses A records only); set ENABLE_IPV6=1 to reserve
# and attach an IPv6 too.
PRIMARY_IP_NAME="${PRIMARY_IP_NAME:-vms-ip}"
PRIMARY_IPV6_NAME="${PRIMARY_IPV6_NAME:-vms-ipv6}"
ENABLE_IPV6="${ENABLE_IPV6:-0}"

# Snapshots
SNAPSHOT_PREFIX="${SNAPSHOT_PREFIX:-vms}"
SNAPSHOT_LABEL_KEY="${SNAPSHOT_LABEL_KEY:-vms-lifecycle}"
SNAPSHOT_LABEL_VALUE="${SNAPSHOT_LABEL_VALUE:-true}"

# Remote box. VMS is a single all-in-one stack built ON the box (server + web
# images), fronted by Caddy — no image registry. The repo is cloned to /opt/vms
# and the compose lives at deploy/docker-compose.yml.
SSH_USER="${SSH_USER:-root}"
REPO_URL="${REPO_URL:-git@github.com:eyosolutionsgh/visitors-management-system.git}"
REMOTE_REPO_DIR="${REMOTE_REPO_DIR:-/opt/vms}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-/opt/vms/deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env}"

# Public hostnames (also set in deploy/.env). Used for smoke tests + the DNS
# reminder printed by box-create.
WEB_DOMAIN="${WEB_DOMAIN:-vms.3dt.com.gh}"
API_DOMAIN="${API_DOMAIN:-api.vms.3dt.com.gh}"
SMOKE_URL="${SMOKE_URL:-https://vms.3dt.com.gh/}"        # SPA served by Caddy+nginx
READY_URL="${READY_URL:-https://api.vms.3dt.com.gh/ready}" # API + DB + Redis readiness

# Timeouts (seconds)
SSH_WAIT_TIMEOUT="${SSH_WAIT_TIMEOUT:-240}"
STACK_WAIT_TIMEOUT="${STACK_WAIT_TIMEOUT:-360}"
SNAPSHOT_WAIT_TIMEOUT="${SNAPSHOT_WAIT_TIMEOUT:-1800}"

# Ensure the right hcloud context is active for every lifecycle command.
hc() { hcloud --context "$HCLOUD_CONTEXT" "$@"; }
