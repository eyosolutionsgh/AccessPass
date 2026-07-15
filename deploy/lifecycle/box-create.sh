#!/usr/bin/env bash
# Initial provisioning of the VMS Hetzner box (the automated equivalent of the
# manual one-time setup). Idempotent where it can be:
#
#   1. Ensure an hcloud context for the VMS project (from $HCLOUD_TOKEN).
#   2. Register the operator SSH key if absent.
#   3. Create a Cloud Firewall (22/80/443 + ICMP) if absent.
#   4. Create the server (cx33 / Ubuntu 24.04 / fsn1 by default) with the
#      cloud-init user-data and firewall attached — unless it already exists.
#   5. Reserve its primary IPv4 (rename + auto-delete off) so DNS is stable
#      across the destroy/restore lifecycle.
#   6. Wait for SSH + cloud-init, then print the IP and next steps.
#
# This creates PAID resources. Run with -y only when you mean it.
#
# Prereq: export HCLOUD_TOKEN=<read/write token for the VMS Hetzner project>
#
# Usage: ./box-create.sh [-y]
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=deploy/lifecycle/config.sh
source ./config.sh

ASSUME_YES=0
[[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]] && ASSUME_YES=1

command -v hcloud >/dev/null || { echo "ERROR: hcloud CLI not found (brew install hcloud)."; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq not found (brew install jq)."; exit 1; }
[[ -f "$CLOUD_INIT_FILE" ]] || { echo "ERROR: $CLOUD_INIT_FILE not found."; exit 1; }

# 1. Context — create from the env token if this project's context is missing.
if ! hcloud context list -o noheader -o columns=name 2>/dev/null | grep -qx "$HCLOUD_CONTEXT"; then
  [[ -n "${HCLOUD_TOKEN:-}" ]] || {
    echo "ERROR: context '$HCLOUD_CONTEXT' not found and HCLOUD_TOKEN is not set."
    echo "       export HCLOUD_TOKEN=<VMS project read/write token> and re-run."
    exit 1
  }
  echo "Creating hcloud context '$HCLOUD_CONTEXT' from HCLOUD_TOKEN…"
  hcloud context create "$HCLOUD_CONTEXT" --token-from-env
fi

echo "Project:   $(hc context active 2>/dev/null || echo "$HCLOUD_CONTEXT")"
echo "Server:    $SERVER_NAME ($SERVER_TYPE, $SERVER_OS_IMAGE, $SERVER_LOCATION)"
echo "Firewall:  $FIREWALL_NAME (22/80/443 + ICMP)"
echo "SSH key:   $SSH_KEY_NAME ($LOCAL_SSH_PUBKEY)"

if hc server describe "$SERVER_NAME" >/dev/null 2>&1; then
  echo "Server '$SERVER_NAME' already exists — nothing to create. (Use box-restore.sh after a destroy.)"
  exit 0
fi

if [[ $ASSUME_YES -ne 1 ]]; then
  echo
  echo "This will create PAID Hetzner resources (server ~EUR 9/mo + reserved IP)."
  read -r -p "Proceed? [y/N] " ans; [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# 2. SSH key — register the local public key under SSH_KEY_NAME if needed.
if ! hc ssh-key describe "$SSH_KEY_NAME" >/dev/null 2>&1; then
  [[ -f "$LOCAL_SSH_PUBKEY" ]] || { echo "ERROR: $LOCAL_SSH_PUBKEY not found; set LOCAL_SSH_PUBKEY."; exit 1; }
  echo "Registering SSH key '$SSH_KEY_NAME'…"
  hc ssh-key create --name "$SSH_KEY_NAME" --public-key-from-file "$LOCAL_SSH_PUBKEY"
fi

# 3. Firewall — create with the inbound rules if it doesn't exist yet.
if ! hc firewall describe "$FIREWALL_NAME" >/dev/null 2>&1; then
  echo "Creating firewall '$FIREWALL_NAME'…"
  rules="$(mktemp)"
  cat > "$rules" <<'JSON'
[
  {"direction":"in","protocol":"tcp","port":"22","source_ips":["0.0.0.0/0","::/0"],"description":"SSH"},
  {"direction":"in","protocol":"tcp","port":"80","source_ips":["0.0.0.0/0","::/0"],"description":"HTTP"},
  {"direction":"in","protocol":"tcp","port":"443","source_ips":["0.0.0.0/0","::/0"],"description":"HTTPS"},
  {"direction":"in","protocol":"icmp","source_ips":["0.0.0.0/0","::/0"],"description":"ICMP"}
]
JSON
  hc firewall create --name "$FIREWALL_NAME" --rules-file "$rules"
  rm -f "$rules"
fi

# 4. Create the server with cloud-init + firewall. Primary IPs auto-allocate;
#    we reserve the IPv4 in step 5.
echo "Creating server '$SERVER_NAME'…"
hc server create \
  --name "$SERVER_NAME" \
  --type "$SERVER_TYPE" \
  --location "$SERVER_LOCATION" \
  --image "$SERVER_OS_IMAGE" \
  --ssh-key "$SSH_KEY_NAME" \
  --firewall "$FIREWALL_NAME" \
  --user-data-from-file "$CLOUD_INIT_FILE" \
  --label "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE"

ipv4="$(hc server describe "$SERVER_NAME" -o json | jq -r '.public_net.ipv4.ip')"
echo "Server created at $ipv4."

# 5. Reserve the primary IPv4 so it survives destroy/restore (rename + protect).
echo "Reserving primary IPv4…"
ipv4_id="$(hc server describe "$SERVER_NAME" -o json | jq -r '.public_net.ipv4.id')"
if [[ -n "$ipv4_id" && "$ipv4_id" != "null" ]]; then
  hc primary-ip update "$ipv4_id" --name "$PRIMARY_IP_NAME" >/dev/null 2>&1 || true
  hc primary-ip update "$PRIMARY_IP_NAME" --auto-delete=false >/dev/null 2>&1 || true
fi
if [[ "$ENABLE_IPV6" == "1" ]]; then
  ipv6_id="$(hc server describe "$SERVER_NAME" -o json | jq -r '.public_net.ipv6.id // empty')"
  if [[ -n "$ipv6_id" ]]; then
    hc primary-ip update "$ipv6_id" --name "$PRIMARY_IPV6_NAME" >/dev/null 2>&1 || true
    hc primary-ip update "$PRIMARY_IPV6_NAME" --auto-delete=false >/dev/null 2>&1 || true
  fi
fi

# 6. Wait for SSH, then for cloud-init to finish installing Docker etc.
echo "Waiting for SSH…"
ssh-keygen -R "$ipv4" >/dev/null 2>&1 || true
deadline=$((SECONDS + SSH_WAIT_TIMEOUT))
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "$SSH_USER@$ipv4" true 2>/dev/null; do
  [[ $SECONDS -lt $deadline ]] || { echo "ERROR: SSH did not come up in time."; exit 1; }
  sleep 5
done

echo "Waiting for cloud-init to finish (Docker, swap, hardening)…"
ssh "$SSH_USER@$ipv4" "cloud-init status --wait" || true
ssh "$SSH_USER@$ipv4" "docker --version && docker compose version" || \
  echo "WARN: Docker not reporting yet — check 'cloud-init status' on the box."

cat <<EOF

── Box provisioned ──────────────────────────────────────────────────────────
IPv4: $ipv4

Next steps (first-time app bring-up, mirroring deploy/README.md):
  1. Point DNS at $ipv4 (a *.$WEB_DOMAIN wildcard covers the api host):
       $WEB_DOMAIN   A  $ipv4
       $API_DOMAIN   A  $ipv4
  2. Give the box read access to the private repo (per-box deploy key):
       ssh $SSH_USER@$ipv4 'ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519 -q; \\
         ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts; cat /root/.ssh/id_ed25519.pub'
       gh api -X POST repos/eyosolutionsgh/visitors-management-system/keys \\
         -f title="$SERVER_NAME" -f key="<pasted-pubkey>" -F read_only=true
  3. Clone + configure + start on the box:
       ssh $SSH_USER@$ipv4
       git clone $REPO_URL $REMOTE_REPO_DIR
       cd $REMOTE_DEPLOY_DIR && cp .env.example .env && vi .env    # fill secrets
       docker compose --env-file .env -f $COMPOSE_FILE up -d --build
     (the server container applies migrations + the idempotent seed on start.)

Once healthy, ./box-destroy.sh snapshots + powers down for cheap idle; restore
with ./box-restore.sh (same IP, no rebuild, data preserved).
─────────────────────────────────────────────────────────────────────────────
EOF
