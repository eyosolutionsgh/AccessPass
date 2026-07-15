#!/usr/bin/env bash
# Recreate the VMS box from the latest snapshot, reattach the reserved IPv4,
# wait for SSH, and bring the stack up — then smoke-test. Same IP, no re-seed:
# the Postgres/MinIO data lives in the snapshot.
#
# By DEFAULT it converges the box to the current `main`: a box can be restored
# long after its snapshot, so the snapshot's code/images may be stale. Restore
# runs the same steps a deploy does — `git pull` + pull base images + rebuild
# the on-box images (server + web) + `up -d --force-recreate` — so the restored
# box picks up any updates automatically. The VMS server container applies
# migrations + the idempotent seed on start, so a converge re-runs them.
#
# Usage:
#   ./box-restore.sh                  # restore + sync to latest main (default)
#   ./box-restore.sh --snapshot-only  # boot the exact snapshot state (rollback)
#   ./box-restore.sh --migrate        # explicitly run the migrate step after sync
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=deploy/lifecycle/config.sh
source ./config.sh

SYNC=1        # converge to latest main (git pull + pull/build + force-recreate)
RUN_MIGRATE=0 # explicitly run the migrate step after the sync
while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot-only|--no-sync) SYNC=0; shift ;;
    --migrate) RUN_MIGRATE=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if hc server describe "$SERVER_NAME" >/dev/null 2>&1; then
  echo "Server '$SERVER_NAME' already exists. Nothing to restore."
  exit 0
fi

echo "Finding latest snapshot…"
snap_id="$(hc image list --type snapshot --selector "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE" \
  -o json | jq -r 'sort_by(.created) | last | .id // empty')"
[[ -n "$snap_id" ]] || { echo "ERROR: no snapshot found to restore from."; exit 1; }
echo "Using snapshot id=$snap_id"

[[ -n "$SSH_KEY_NAME" ]] || { echo "ERROR: set SSH_KEY_NAME in config.sh/env."; exit 1; }

echo "Creating server '$SERVER_NAME' from snapshot with reserved IPv4 '$PRIMARY_IP_NAME'…"
create_args=(
  --name "$SERVER_NAME"
  --type "$SERVER_TYPE"
  --location "$SERVER_LOCATION"
  --image "$snap_id"
  --ssh-key "$SSH_KEY_NAME"
  --primary-ipv4 "$PRIMARY_IP_NAME"
)
[[ "$ENABLE_IPV6" == "1" ]] && create_args+=(--primary-ipv6 "$PRIMARY_IPV6_NAME")
[[ -n "${FIREWALL_NAME:-}" ]] && hc firewall describe "$FIREWALL_NAME" >/dev/null 2>&1 \
  && create_args+=(--firewall "$FIREWALL_NAME")
hc server create "${create_args[@]}"

ipv4="$(hc server describe "$SERVER_NAME" -o json | jq -r '.public_net.ipv4.ip')"
echo "Server up at $ipv4. Waiting for SSH…"

# A box restored from a snapshot boots with FRESHLY regenerated SSH host keys.
# The reserved IP is reused, so any operator/CI that connected to the previous
# box has a now-stale key pinned for this IP — accept-new would then reject the
# "changed" key. Drop the stale entry so accept-new pins the new key cleanly.
ssh-keygen -R "$ipv4" >/dev/null 2>&1 || true

deadline=$((SECONDS + SSH_WAIT_TIMEOUT))
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "$SSH_USER@$ipv4" true 2>/dev/null; do
  [[ $SECONDS -lt $deadline ]] || { echo "ERROR: SSH did not come up in time."; exit 1; }
  sleep 5
done

if [[ $SYNC -eq 1 ]]; then
  echo "Syncing the box to the latest main (git pull + image pull/build + recreate)…"
  # Positional args keep the heredoc fully quoted, so nothing expands locally —
  # the remote shell does all the work. Args: deploy dir, env file, compose file,
  # pull services, build services.
  ssh "$SSH_USER@$ipv4" 'bash -s' \
    "$REMOTE_DEPLOY_DIR" "$COMPOSE_ENV_FILE" "$COMPOSE_FILE" \
    "$PULL_SERVICES" "$BUILD_SERVICES" <<'REMOTE'
set -euo pipefail
DEPLOY_DIR="$1"; ENV="$2"; COMPOSE="$3"; PULL="$4"; BUILD="$5"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
cd "$DEPLOY_DIR"
git -C "$REPO_DIR" pull --ff-only
# shellcheck disable=SC2086
docker compose --env-file "$ENV" -f "$COMPOSE" pull $PULL || true
# shellcheck disable=SC2086
docker compose --env-file "$ENV" -f "$COMPOSE" build $BUILD
docker compose --env-file "$ENV" -f "$COMPOSE" up -d --force-recreate
REMOTE
else
  echo "Booting the exact snapshot state (no sync)…"
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$ipv4" "cd '$REMOTE_DEPLOY_DIR' && \
    docker compose --env-file '$COMPOSE_ENV_FILE' -f '$COMPOSE_FILE' up -d --no-build"
fi

if [[ $RUN_MIGRATE -eq 1 ]]; then
  echo "Running the migrate step explicitly (idempotent; also runs on server start)…"
  # shellcheck disable=SC2029
  ssh "$SSH_USER@$ipv4" "cd '$REMOTE_DEPLOY_DIR' && \
    docker compose --env-file '$COMPOSE_ENV_FILE' -f '$COMPOSE_FILE' exec -T server node server/dist/migrate.js" \
    || echo "NOTE: migrate runs automatically on server start; explicit run skipped."
fi

echo "Smoke testing $SMOKE_URL and $READY_URL…"
deadline=$((SECONDS + STACK_WAIT_TIMEOUT))
smoke() { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -L "$1" 2>/dev/null; }
until web="$(smoke "$SMOKE_URL")"; api="$(smoke "$READY_URL")"; \
      [[ "$web" =~ ^(200|301|302|303|307|308)$ && "$api" == "200" ]]; do
  [[ $SECONDS -lt $deadline ]] || { echo "WARN: not green yet (web=$web api=$api). Check logs."; exit 1; }
  sleep 5
done

echo "Restore complete — $SMOKE_URL → HTTP $web · $READY_URL → HTTP $api"
