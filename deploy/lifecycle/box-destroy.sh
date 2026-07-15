#!/usr/bin/env bash
# Snapshot the running VMS box, verify the snapshot, prune older ones, KEEP the
# reserved IPv4, then delete the server. Drops idle cost to ~a few EUR/month
# (snapshot + reserved IP). Pair with box-restore.sh to bring it back — same IP,
# same data (Postgres/MinIO volumes are captured in the snapshot).
#
# Safety: refuses to delete unless a fresh snapshot is confirmed available.
#
# Usage: ./box-destroy.sh [-y]
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=deploy/lifecycle/config.sh
source ./config.sh

ASSUME_YES=0
[[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]] && ASSUME_YES=1

hc server describe "$SERVER_NAME" >/dev/null 2>&1 || {
  echo "Server '$SERVER_NAME' not found — nothing to destroy."; exit 0; }

# A snapshot name we can recognise on restore. (No date in scripts — let hcloud
# stamp created-at; we sort by that on restore.)
SNAP_DESC="${SNAPSHOT_PREFIX}-snapshot"

echo "About to snapshot then DELETE server '$SERVER_NAME' (reserved IPv4 is kept)."
if [[ $ASSUME_YES -ne 1 ]]; then
  read -r -p "Proceed? [y/N] " ans; [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

echo "Creating snapshot '$SNAP_DESC' (this can take several minutes)…"
hc server create-image --type snapshot \
  --description "$SNAP_DESC" \
  --label "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE" \
  "$SERVER_NAME"

# Verify at least one matching snapshot now exists and is available.
echo "Verifying snapshot…"
latest_id="$(hc image list --type snapshot --selector "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE" \
  -o json | jq -r 'sort_by(.created) | last | .id // empty')"
[[ -n "$latest_id" ]] || { echo "ERROR: no snapshot found after create — NOT deleting server."; exit 1; }
echo "Snapshot id=$latest_id confirmed."

# Prune all but the newest snapshot to control storage cost.
echo "Pruning older snapshots…"
hc image list --type snapshot --selector "$SNAPSHOT_LABEL_KEY=$SNAPSHOT_LABEL_VALUE" -o json \
  | jq -r 'sort_by(.created) | reverse | .[1:] | .[].id' \
  | while read -r old; do [[ -n "$old" ]] && hc image delete "$old"; done

echo "Deleting server '$SERVER_NAME' (reserved IPv4 is retained)…"
hc server delete "$SERVER_NAME"

echo "Done. Restore with ./box-restore.sh"
