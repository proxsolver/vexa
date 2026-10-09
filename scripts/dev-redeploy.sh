#!/usr/bin/env bash
set -euo pipefail

# dev-redeploy.sh — Rebuild changed services and bring them up on the local
# compose stack, verifying each one before moving on to the next.
#
# Needs nothing from you. Every credential it uses comes from the repo's .env.
# Images are built locally and never pushed.
#
# What it does:
#   1. Preflight  — docker reachable, .env present, warns on live bots/meetings
#   2. Plan       — the services you name, or whatever your working diff touched
#   3. Build      — only those images
#   4. Recreate   — one at a time, waiting for health before continuing
#   5. Verify     — published endpoints, plus one audited request end to end
#
# Usage:
#   ./scripts/dev-redeploy.sh                    # auto-detect from the working diff
#   ./scripts/dev-redeploy.sh api-gateway admin-api
#   ./scripts/dev-redeploy.sh --dry-run          # print the plan, change nothing
#   ./scripts/dev-redeploy.sh --no-build         # recreate + verify only
#   ./scripts/dev-redeploy.sh --yes              # skip the confirmation prompt

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

COMPOSE_FILE="deploy/compose/docker-compose.yml"
# Pass the env file explicitly, exactly as deploy/compose/Makefile does. Without
# it compose silently reads whatever .env sits beside the compose file, which is
# how the two config sets drifted apart in the first place.
ENV_FILE="$REPO_ROOT/.env"
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

DRY_RUN=false
DO_BUILD=true
ASSUME_YES=false
SERVICES=()

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-build) DO_BUILD=false ;;
    --yes|-y) ASSUME_YES=true ;;
    -h|--help) sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) SERVICES+=("$arg") ;;
  esac
done

say()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '   \033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Read one key without sourcing it — values may contain anything.
env_get() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

# ─────────────────────────────────────────────────────────────── 1. preflight

say "Preflight"

docker info >/dev/null 2>&1 || die "docker is not reachable — is the daemon running?"
ok "docker reachable"

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found — run 'make env' to create it from deploy/env-example"
ok "env file: $ENV_FILE (IMAGE_TAG=$(env_get IMAGE_TAG))"
# deploy/compose/.env must not become a second source of truth again.
if [[ -e deploy/compose/.env && ! -L deploy/compose/.env ]]; then
  warn "deploy/compose/.env is a real file again — it shadows $ENV_FILE on any plain 'docker compose' call"
fi

# Services that can actually be built from this compose file.
BUILDABLE=$(python3 - <<'PY'
import yaml
d = yaml.safe_load(open('deploy/compose/docker-compose.yml'))
print(' '.join(sorted(k for k, v in d['services'].items() if 'build' in v)))
PY
)
ok "buildable services: $BUILDABLE"

PG_CID=$(compose ps -q postgres 2>/dev/null || true)

# A bot mid-meeting is the one thing worth stopping for.
LIVE_BOTS=$(docker ps --format '{{.Names}}' | grep -ciE 'vexa-bot|bot-[0-9]' || true)
if [[ "$LIVE_BOTS" -gt 0 ]]; then
  warn "$LIVE_BOTS bot container(s) running — recreating now would cut their transcription"
else
  ok "no bot containers running"
fi

if [[ -n "$PG_CID" ]]; then
  # Only meetings touched recently count; stale 'active' rows linger for months.
  RECENT=$(docker exec "$PG_CID" psql -U "$(env_get DB_USER)" -d "$(env_get DB_NAME)" -tAc \
    "SELECT count(*) FROM meetings
      WHERE status IN ('active','requested','loading','awaiting_admission')
        AND COALESCE(updated_at, created_at) > now() - interval '30 minutes';" 2>/dev/null | tr -d ' ' || echo "?")
  if [[ "$RECENT" == "0" ]]; then
    ok "no meetings active in the last 30 min"
  else
    warn "$RECENT meeting(s) updated in the last 30 min — check before continuing"
  fi
else
  warn "postgres container not up — skipping the live-meeting check"
fi

# ──────────────────────────────────────────────────────────────────── 2. plan

say "Plan"

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  CHANGED=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
  for svc in $BUILDABLE; do
    hits=$(grep "^services/$svc/" <<<"$CHANGED" || true)
    [[ -z "$hits" ]] && continue
    # Docs-only edits do not change the image, and a dashboard rebuild is minutes.
    if [[ -n "$(grep -vE '\.(md|txt)$' <<<"$hits" || true)" ]]; then
      SERVICES+=("$svc")
    else
      warn "$svc: only docs changed — skipping (name it explicitly to force)"
    fi
  done
  if grep -q "^libs/" <<<"$CHANGED"; then
    warn "libs/ changed — that affects several services; name them explicitly if needed"
  fi
  [[ ${#SERVICES[@]} -eq 0 ]] && die "no service code changed; pass service names explicitly"
  ok "detected from working diff: ${SERVICES[*]}"
else
  for svc in "${SERVICES[@]}"; do
    grep -qw "$svc" <<<"$BUILDABLE" || die "'$svc' is not a buildable compose service"
  done
  ok "requested: ${SERVICES[*]}"
fi

# Note the current images so a rollback is possible if the new code misbehaves.
say "Current images (rollback targets)"
for svc in "${SERVICES[@]}"; do
  cid=$(compose ps -q "$svc" 2>/dev/null || true)
  img=$([[ -n "$cid" ]] && docker inspect "$cid" --format '{{.Image}}' | cut -c8-19 || echo "not running")
  printf '   %-20s %s\n' "$svc" "$img"
done
echo "   roll back with:  docker tag <id> vexaai/<service>:$(env_get IMAGE_TAG)"

if $DRY_RUN; then say "Dry run — nothing changed"; exit 0; fi

if ! $ASSUME_YES; then
  echo
  read -rp "Rebuild and recreate these services? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "aborted"; exit 0; }
fi

# ─────────────────────────────────────────────────────────────────── 3. build

if $DO_BUILD; then
  say "Building ${#SERVICES[@]} image(s) — running containers are untouched until step 4"
  compose build "${SERVICES[@]}" || die "build failed — nothing was recreated, the stack is unchanged"
  ok "built: ${SERVICES[*]}"
else
  warn "skipping build (--no-build)"
fi

# ──────────────────────────────────────────────────────────────── 4. recreate

# Waits for a container to look alive: healthy if it declares a healthcheck,
# otherwise just running with nothing fatal in its log.
wait_ready() {
  local svc="$1" cid deadline=$((SECONDS + 90)) status health
  cid=$(compose ps -q "$svc" 2>/dev/null || true)
  [[ -n "$cid" ]] || { warn "$svc: no container id"; return 1; }

  local has_health
  has_health=$(docker inspect "$cid" --format '{{if .State.Health}}yes{{end}}')

  while (( SECONDS < deadline )); do
    status=$(docker inspect "$cid" --format '{{.State.Status}}')
    [[ "$status" == "running" ]] || { sleep 2; continue; }
    if [[ -n "$has_health" ]]; then
      health=$(docker inspect "$cid" --format '{{.State.Health.Status}}')
      [[ "$health" == "healthy" ]] && { ok "$svc: running (healthy)"; return 0; }
      [[ "$health" == "unhealthy" ]] && { warn "$svc: unhealthy"; return 1; }
    else
      sleep 5
      [[ "$(docker inspect "$cid" --format '{{.State.Status}}')" == "running" ]] \
        && { ok "$svc: running (no healthcheck declared)"; return 0; }
    fi
    sleep 3
  done
  warn "$svc: still not ready after 90s"
  return 1
}

say "Recreating (one at a time)"
FAILED=()
for svc in "${SERVICES[@]}"; do
  compose up -d --no-deps --force-recreate "$svc" >/dev/null 2>&1 || { FAILED+=("$svc"); warn "$svc: up failed"; continue; }
  if ! wait_ready "$svc"; then FAILED+=("$svc"); fi
  errs=$(docker logs "$(compose ps -q "$svc" 2>/dev/null)" --since 90s 2>&1 \
         | grep -iE 'traceback|importerror|nameerror|syntaxerror|critical' | head -3 || true)
  if [[ -n "$errs" ]]; then
    warn "$svc: startup errors below"
    sed 's/^/       /' <<<"$errs"
    FAILED+=("$svc")
  fi
done

# ────────────────────────────────────────────────────────────────── 5. verify

say "Verifying"

GW_PORT=$(env_get API_GATEWAY_HOST_PORT); GW_PORT=${GW_PORT:-8056}
ADMIN_PORT=$(env_get ADMIN_API_HOST_PORT); ADMIN_PORT=${ADMIN_PORT:-8057}
DASH_PORT=$(env_get DASHBOARD_HOST_PORT); DASH_PORT=${DASH_PORT:-3001}

check_http() {
  local name="$1" url="$2" code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$url" || echo "000")
  if [[ "$code" == "200" ]]; then ok "$name → HTTP 200"; else warn "$name → HTTP $code ($url)"; fi
}
# The healthcheck hits `/`, not `/health` — /health is a 404 on these services.
check_http "api-gateway" "http://127.0.0.1:${GW_PORT}/"
check_http "admin-api"   "http://127.0.0.1:${ADMIN_PORT}/"
check_http "dashboard"   "http://127.0.0.1:${DASH_PORT}/"

# One authenticated request exercises gateway → admin-api /internal/validate →
# audit write, which is the path most likely to break after a change here.
if [[ -n "$PG_CID" ]]; then
  DB_U=$(env_get DB_USER); DB_N=$(env_get DB_NAME)
  TOKEN=$(docker exec "$PG_CID" psql -U "$DB_U" -d "$DB_N" -tAc \
    "SELECT token FROM api_tokens ORDER BY id LIMIT 1;" 2>/dev/null | tr -d ' \n' || true)
  if [[ -n "$TOKEN" ]]; then
    before=$(docker exec "$PG_CID" psql -U "$DB_U" -d "$DB_N" -tAc "SELECT count(*) FROM audit_logs;" | tr -d ' ')
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
             -H "X-API-Key: $TOKEN" "http://127.0.0.1:${GW_PORT}/bots" || echo "000")
    sleep 3
    after=$(docker exec "$PG_CID" psql -U "$DB_U" -d "$DB_N" -tAc "SELECT count(*) FROM audit_logs;" | tr -d ' ')
    if [[ "$code" == "200" ]]; then ok "GET /bots → HTTP 200 (token auth works)"
    else warn "GET /bots → HTTP $code"; fi
    if (( after > before )); then ok "audit log written ($before → $after)"
    else warn "audit log did not grow ($before) — the write path may be broken"; fi
  else
    warn "no API token in the database — skipped the end-to-end check"
  fi
fi

say "Result"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  ok "all done: ${SERVICES[*]}"
else
  printf '   \033[31m✗\033[0m problems with: %s\n' "$(printf '%s ' "${FAILED[@]}" | sort -u)"
  echo "   logs:  docker compose -f $COMPOSE_FILE logs --tail=50 <service>"
  exit 1
fi
