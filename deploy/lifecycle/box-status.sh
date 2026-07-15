#!/usr/bin/env bash
# Read-only status of the VMS box: server state, IPs, latest snapshot, and
# container health (if the server is up). Safe to run any time.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=deploy/lifecycle/config.sh
source ./config.sh

echo "── Context: $HCLOUD_CONTEXT ──"

status=""
ipv4=""
if hc server describe "$SERVER_NAME" >/dev/null 2>&1; then
  status="$(hc server describe "$SERVER_NAME" -o json | jq -r '.status')"
  ipv4="$(hc server describe "$SERVER_NAME" -o json | jq -r '.public_net.ipv4.ip // "-"')"
  echo "Server:    $SERVER_NAME ($status)  IPv4=$ipv4"
else
  echo "Server:    $SERVER_NAME (absent — destroyed/not yet restored)"
fi

echo
echo "── Reserved primary IPs ──"
hc primary-ip list -o columns=name,ip,assignee_type 2>/dev/null | grep -E "vms|NAME" || echo "(none)"

echo
echo "── Snapshots (newest first) ──"
hc image list --type snapshot --selector "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE" \
  -o columns=id,description,created,image_size 2>/dev/null || echo "(none)"

# If the server is up, peek at container health.
if [[ "${status:-}" == "running" && -n "${ipv4:-}" && "$ipv4" != "-" ]]; then
  echo
  echo "── Containers ──"
  ssh -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "$SSH_USER@$ipv4" \
    "cd '$REMOTE_DEPLOY_DIR' && docker compose --env-file '$COMPOSE_ENV_FILE' -f '$COMPOSE_FILE' ps" \
    2>/dev/null || echo "(could not reach docker over SSH)"
fi
