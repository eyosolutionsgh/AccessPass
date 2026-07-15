# VMS box lifecycle

Snapshot-based create / destroy / restore for the single-node VMS Hetzner box,
using the `hcloud` CLI. Mirrors the VECIP lifecycle toolkit.

The pattern: keep a **reserved IPv4** and a **snapshot** between runs. Destroying
snapshots the box (Postgres + MinIO volumes and the built images included) and
deletes the server but keeps the IP — idle cost drops to a few EUR/month.
Restoring recreates the server from the snapshot and reattaches the same IP, so
**DNS never changes**, there is **no re-seed / no data loss**, and it converges
to the latest `main` automatically.

## Prerequisites

```bash
brew install hcloud jq
export HCLOUD_TOKEN=<read/write token for the VMS Hetzner project>
hcloud context create vms --token-from-env      # once; scripts also auto-create it
```

All settings live in [`config.sh`](config.sh) and are environment-overridable
(server type/location, names, domains, timeouts).

## Scripts

| Script                             | What it does                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./box-create.sh [-y]`             | First-time provisioning: context, SSH key, firewall (22/80/443/ICMP), server + [`cloud-init.yaml`](cloud-init.yaml), **reserve the IPv4**, wait for SSH/cloud-init, print next steps. Creates paid resources. |
| `./box-destroy.sh [-y]`            | Snapshot → verify → prune old snapshots → **keep the IPv4** → delete the server. Refuses to delete without a confirmed snapshot.                                                                              |
| `./box-restore.sh`                 | Recreate from the latest snapshot, reattach the reserved IPv4, wait for SSH, `git pull` + rebuild the on-box images + `up -d --force-recreate`, then smoke-test.                                              |
| `./box-restore.sh --snapshot-only` | Boot the exact snapshot state (rollback), no sync.                                                                                                                                                            |
| `./box-restore.sh --migrate`       | Also run the migrate step explicitly (it already runs on server start).                                                                                                                                       |
| `./box-status.sh`                  | Read-only: server state, reserved IPs, snapshots, container health.                                                                                                                                           |

## Typical cycle

```bash
./box-create.sh          # once, then do the app bring-up it prints
./box-status.sh          # check health any time

# park it cheaply between demos (keeps IP + a snapshot):
./box-destroy.sh

# bring it back — same IP, same data, synced to latest main:
./box-restore.sh
```

## Notes

- **Data** lives in the snapshot (local Docker volumes), so restore is
  data-preserving — unlike a from-scratch redeploy, which comes back with only
  the seed. Take a fresh `box-destroy.sh` snapshot before parking anything you
  care about.
- The VMS `server` container runs migrations + the idempotent seed on start, so
  a `box-restore.sh` converge re-applies pending migrations automatically.
- ARM `cax21` (cheaper) is preferred but was sold out at provisioning time; the
  default `SERVER_TYPE` is `cx33`. Change it in `config.sh` when ARM is available.
- IPv6 is off by default (DNS uses A records); set `ENABLE_IPV6=1` to reserve and
  attach an IPv6 too.
