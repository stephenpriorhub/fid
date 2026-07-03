#!/usr/bin/env sh
# Clone or pull the brain vault repo. Safe to run on every container start.
# Set BRAIN_REPO_URL (and GITHUB_TOKEN for private repos). Mount a Railway volume at VAULT_PATH.
#
# FID reads these locations in the vault:
#   Resources/Financial Publishing Directory.md   → entity spine (all gurus/products/publishers)
#   Resources/Financial Publishing Knowledge Graph.md → publisher family tree
#   Resources/Experts/                             → guru profiles (MTA)
#   Resources/Competitors/                         → guru profiles (competitors)
#   Resources/Publication Descriptions/            → product notes
#
# Changes to Inbox/, Projects/, Areas/, Archive/, Operations/ etc. are ignored for changelog.

set -eu

VAULT_PATH="${VAULT_PATH:-/data/vault}"

if [ -z "${BRAIN_REPO_URL:-}" ]; then
  echo "[sync-vault] BRAIN_REPO_URL not set — skipping vault sync"
  exit 0
fi

# Normalize git@github.com:user/repo.git → https://
case "$BRAIN_REPO_URL" in
  git@github.com:*)
    CLONE_URL="https://github.com/${BRAIN_REPO_URL#git@github.com:}"
    ;;
  *)
    CLONE_URL="$BRAIN_REPO_URL"
    ;;
esac

if [ -n "${GITHUB_TOKEN:-}" ]; then
  case "$CLONE_URL" in
    https://github.com/*)
      CLONE_URL="https://x-access-token:${GITHUB_TOKEN}@${CLONE_URL#https://}"
      ;;
  esac
fi

mkdir -p "$(dirname "$VAULT_PATH")"

PREV_SHA=""
NEW_SHA=""

if [ -d "$VAULT_PATH/.git" ]; then
  echo "[sync-vault] Pulling latest into $VAULT_PATH"
  PREV_SHA=$(git -C "$VAULT_PATH" rev-parse HEAD 2>/dev/null || echo "")
  if ! git -C "$VAULT_PATH" pull --ff-only 2>&1; then
    echo "[sync-vault] pull failed — continuing with existing files"
    exit 0
  fi
  NEW_SHA=$(git -C "$VAULT_PATH" rev-parse HEAD 2>/dev/null || echo "")
elif [ -d "$VAULT_PATH" ] && [ "$(ls -A "$VAULT_PATH" 2>/dev/null)" ]; then
  echo "[sync-vault] $VAULT_PATH exists but is not a git repo — clearing and recloning"
  rm -rf "$VAULT_PATH"
  mkdir -p "$VAULT_PATH"
  echo "[sync-vault] Cloning into $VAULT_PATH"
  git clone --depth 1 "$CLONE_URL" "$VAULT_PATH"
  NEW_SHA=$(git -C "$VAULT_PATH" rev-parse HEAD 2>/dev/null || echo "")
else
  echo "[sync-vault] Cloning into $VAULT_PATH"
  git clone --depth 1 "$CLONE_URL" "$VAULT_PATH"
  NEW_SHA=$(git -C "$VAULT_PATH" rev-parse HEAD 2>/dev/null || echo "")
fi

if [ ! -d "$VAULT_PATH/Resources" ]; then
  echo "[sync-vault] warning: expected $VAULT_PATH/Resources — check repo layout"
fi

echo "[sync-vault] done"

# ── Changelog notification ────────────────────────────────────────────────────
if [ -z "${FID_BASE_URL:-}" ] || [ -z "${CHANGELOG_WEBHOOK_SECRET:-}" ]; then
  exit 0
fi

if [ -z "$NEW_SHA" ] || [ "$PREV_SHA" = "$NEW_SHA" ]; then
  echo "[sync-vault] no new commits — skipping changelog"
  exit 0
fi

if [ -n "$PREV_SHA" ]; then
  ALL_CHANGED=$(git -C "$VAULT_PATH" diff --name-only "$PREV_SHA" "$NEW_SHA" 2>/dev/null || echo "")
else
  echo "[sync-vault] initial clone — skipping changelog entry"
  exit 0
fi

if [ -z "$ALL_CHANGED" ]; then
  echo "[sync-vault] no files changed — skipping changelog"
  exit 0
fi

# ── Filter to FID-relevant paths ──────────────────────────────────────────────
FID_FILES=$(echo "$ALL_CHANGED" | grep -E \
  "^Resources/Experts/|^Resources/Competitors/|^Resources/Publication Descriptions/|\
Resources/Financial Publishing Directory|Resources/Financial Publishing Knowledge Graph|\
^Resources/Promo Analysis/" || echo "")

if [ -z "$FID_FILES" ]; then
  echo "[sync-vault] brain updated but no FID-relevant files changed — skipping changelog"
  exit 0
fi

CHANGED_COUNT=$(echo "$FID_FILES" | wc -l | tr -d ' ')

PAGE_SLUG="/"
if echo "$FID_FILES" | grep -qE "Resources/Experts/|Resources/Competitors/"; then
  PAGE_SLUG="/gurus"
fi
if echo "$FID_FILES" | grep -qE "Resources/Publication Descriptions/"; then
  PAGE_SLUG="/products"
fi

TITLE="Brain sync: ${CHANGED_COUNT} FID-relevant file(s) updated"
DESCRIPTION=$(echo "$FID_FILES" | head -15 | sed 's/^/• /')
DESCRIPTION_JSON=$(printf "%s" "$DESCRIPTION" | tr '\n' '|' | sed 's/|/\\n/g')
TITLE_JSON=$(printf "%s" "$TITLE" | sed 's/"/\\"/g')

BODY="{\"title\":\"${TITLE_JSON}\",\"description\":\"${DESCRIPTION_JSON}\",\"source\":\"brain\",\"brainSha\":\"${NEW_SHA}\",\"pageSlug\":\"${PAGE_SLUG}\"}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${FID_BASE_URL}/api/changelog" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: ${CHANGELOG_WEBHOOK_SECRET}" \
  -d "$BODY" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "201" ]; then
  echo "[sync-vault] changelog entry posted (${CHANGED_COUNT} files, sha: ${NEW_SHA})"
else
  echo "[sync-vault] changelog POST returned HTTP ${HTTP_STATUS} — continuing anyway"
fi
