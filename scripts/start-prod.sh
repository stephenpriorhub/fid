#!/usr/bin/env sh
# Start the app immediately for Railway healthchecks; sync the brain vault in the background.

# Container runtimes set HOSTNAME to the container ID; Next.js uses it as the bind address.
export HOSTNAME=0.0.0.0

if [ -n "${BRAIN_REPO_URL:-}" ]; then
  echo "[start] syncing vault in background (VAULT_PATH=${VAULT_PATH:-/data/vault})"
  sh scripts/sync-vault.sh >>/tmp/sync-vault.log 2>&1 &
fi

exec node .next/standalone/server.js
