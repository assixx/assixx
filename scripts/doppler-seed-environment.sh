#!/bin/bash
# =============================================================================
# Doppler Environment Seeder — Assixx
# =============================================================================
#
# Seeds a Doppler config (stg or prd) with cryptographically strong secrets
# and environment-specific configuration values.
#
# USAGE:
#   ./scripts/doppler-seed-environment.sh stg              # Seed staging
#   ./scripts/doppler-seed-environment.sh prd              # Seed production
#   ./scripts/doppler-seed-environment.sh stg --dry-run    # Preview only
#   ./scripts/doppler-seed-environment.sh stg --force      # Overwrite existing
#
# PREREQUISITES:
#   - Doppler CLI installed and authenticated (doppler login)
#   - Doppler project "assixx" with stg/prd configs
#   - openssl available for secret generation
#
# SAFETY:
#   - NEVER touches the dev config
#   - Requires explicit confirmation before writing
#   - Secrets are NEVER echoed to stdout
#   - Idempotent: detects existing secrets, requires --force to overwrite
#
# NODE_ENV NOTE:
#   config.service.ts only accepts: development | production | test
#   Both stg and prd use NODE_ENV=production. Staging-specific behavior is
#   controlled via LOG_LEVEL, ALLOWED_ORIGINS, etc.
#
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOPPLER_PROJECT="assixx"

# Temp file for JSON payload — cleaned up on exit
TMPFILE=""

# =============================================================================
# Colors & Logging (project convention)
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}==>${NC} ${BOLD}$1${NC}"; }

# =============================================================================
# Argument Parsing
# =============================================================================

TARGET_ENV=""
DRY_RUN=false
FORCE=false

usage() {
  echo "Usage: $0 <stg|prd> [--dry-run] [--force]"
  echo ""
  echo "  stg|prd     Target Doppler config (dev is NEVER allowed)"
  echo "  --dry-run   Preview what would be set without writing"
  echo "  --force     Overwrite existing secrets"
  exit 1
}

parse_args() {
  if [ $# -lt 1 ]; then
    usage
  fi

  TARGET_ENV="$1"
  shift

  # Hardcoded rejection of dev — no argument can override this
  if [ "$TARGET_ENV" = "dev" ] || [ "$TARGET_ENV" = "dev_personal" ]; then
    log_error "REFUSED: This script NEVER touches the '$TARGET_ENV' config."
    log_error "Dev secrets are managed separately. See HOW-TO-DOPPLER-GUIDE.md"
    exit 1
  fi

  if [ "$TARGET_ENV" != "stg" ] && [ "$TARGET_ENV" != "prd" ]; then
    log_error "Invalid environment: '$TARGET_ENV'. Must be 'stg' or 'prd'."
    usage
  fi

  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run) DRY_RUN=true ;;
      --force)   FORCE=true ;;
      *)         log_error "Unknown argument: $1"; usage ;;
    esac
    shift
  done
}

# =============================================================================
# Cleanup trap — ensures temp file is always removed
# =============================================================================

cleanup() {
  if [ -n "$TMPFILE" ] && [ -f "$TMPFILE" ]; then
    rm -f "$TMPFILE"
  fi
}
trap cleanup EXIT

# =============================================================================
# Prerequisites
# =============================================================================

check_prerequisites() {
  log_step "Checking prerequisites"

  if ! command -v doppler &>/dev/null; then
    log_error "doppler CLI not found. Install: https://docs.doppler.com/docs/install-cli"
    exit 1
  fi
  log_info "doppler CLI: $(doppler --version 2>&1 | head -1)"

  if ! command -v openssl &>/dev/null; then
    log_error "openssl not found. Required for secret generation."
    exit 1
  fi
  log_info "openssl: $(openssl version 2>&1 | head -1)"

  # Verify Doppler auth
  if ! doppler whoami &>/dev/null; then
    log_error "Doppler not authenticated. Run: doppler login"
    exit 1
  fi
  log_info "Doppler auth: OK"

  # Verify target config exists
  if ! doppler configs --project "$DOPPLER_PROJECT" --json 2>/dev/null | grep -q "\"$TARGET_ENV\""; then
    log_error "Config '$TARGET_ENV' not found in project '$DOPPLER_PROJECT'."
    log_error "Create it first: doppler configs create $TARGET_ENV --project $DOPPLER_PROJECT"
    exit 1
  fi
  log_info "Config '$TARGET_ENV' exists in project '$DOPPLER_PROJECT'"
}

# =============================================================================
# Secret Generation
# =============================================================================

generate_secret() {
  local bytes="${1:-32}"
  openssl rand -hex "$bytes"
}

# =============================================================================
# Fetch shared secrets from dev
# =============================================================================

fetch_from_dev() {
  local key="$1"
  doppler secrets get "$key" --project "$DOPPLER_PROJECT" --config dev --plain 2>/dev/null || echo ""
}

# =============================================================================
# Check existing secrets
# =============================================================================

check_existing_secrets() {
  log_step "Checking existing secrets in '$TARGET_ENV'"

  # Use JSON output for reliable counting — filter out Doppler metadata keys
  local existing_count
  existing_count=$(doppler secrets --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --json 2>/dev/null \
    | grep -cE '"[A-Z_]+"' \
    | head -1 || echo "0")
  # Subtract 3 Doppler metadata keys (DOPPLER_CONFIG, DOPPLER_ENVIRONMENT, DOPPLER_PROJECT)
  existing_count=$((existing_count > 3 ? existing_count - 3 : 0))

  if [ "$existing_count" -gt 0 ]; then
    log_warn "Config '$TARGET_ENV' already has $existing_count non-metadata secret(s)."

    if [ "$FORCE" = false ]; then
      log_error "Use --force to overwrite existing secrets."
      log_error "Current secrets:"
      doppler secrets --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --only-names 2>/dev/null || true
      exit 1
    fi

    log_warn "--force flag set. Existing secrets will be overwritten."
  else
    log_info "Config '$TARGET_ENV' is empty (ready to seed)."
  fi
}

# =============================================================================
# Build JSON payload
# =============================================================================

build_secrets_json() {
  log_step "Generating secrets for '$TARGET_ENV'"

  umask 077
  TMPFILE=$(mktemp /tmp/doppler-seed-XXXXXX.json)

  # --- Generate critical secrets (hex-only, no special chars) ---
  local pg_pass db_pass jwt_secret jwt_refresh session_secret redis_pass gf_pass
  pg_pass=$(generate_secret 32)
  db_pass=$(generate_secret 32)
  jwt_secret=$(generate_secret 64)
  jwt_refresh=$(generate_secret 64)
  session_secret=$(generate_secret 48)
  redis_pass=$(generate_secret 32)
  gf_pass=$(generate_secret 16)

  # Safety: verify JWT secrets differ (astronomically unlikely but cheap check)
  if [ "$jwt_secret" = "$jwt_refresh" ]; then
    jwt_refresh=$(generate_secret 64)
  fi

  log_info "6 critical secrets generated (hex-only, no special chars)"

  # --- Fetch shared secrets from dev ---
  log_info "Fetching shared secrets from dev config..."
  local sentry_dsn pub_sentry_dsn sentry_auth grafana_key grafana_user loki_url
  sentry_dsn=$(fetch_from_dev "SENTRY_DSN")
  pub_sentry_dsn=$(fetch_from_dev "PUBLIC_SENTRY_DSN")
  sentry_auth=$(fetch_from_dev "SENTRY_AUTH_TOKEN")
  grafana_key=$(fetch_from_dev "GRAFANA_CLOUD_API_KEY")
  grafana_user=$(fetch_from_dev "GRAFANA_CLOUD_USER")
  loki_url=$(fetch_from_dev "LOKI_URL")

  local shared_count=0
  [ -n "$sentry_dsn" ] && shared_count=$((shared_count + 1))
  [ -n "$pub_sentry_dsn" ] && shared_count=$((shared_count + 1))
  [ -n "$sentry_auth" ] && shared_count=$((shared_count + 1))
  [ -n "$grafana_key" ] && shared_count=$((shared_count + 1))
  [ -n "$grafana_user" ] && shared_count=$((shared_count + 1))
  [ -n "$loki_url" ] && shared_count=$((shared_count + 1))
  log_info "$shared_count shared secrets copied from dev"

  # --- Environment-specific config ---
  local allowed_origins log_level gf_root_url origin
  if [ "$TARGET_ENV" = "stg" ]; then
    allowed_origins="https://stg.assixx.com"
    log_level="info"
    gf_root_url="https://stg.assixx.com:3050"
    origin="https://stg.assixx.com"
  else
    allowed_origins="https://assixx.com"
    log_level="warn"
    gf_root_url="https://assixx.com:3050"
    origin="https://assixx.com"
  fi

  # --- Build JSON (hex values + plain strings = no escaping issues) ---
  cat > "$TMPFILE" <<ENDJSON
{
  "POSTGRES_PASSWORD": "$pg_pass",
  "DB_PASSWORD": "$db_pass",
  "JWT_SECRET": "$jwt_secret",
  "JWT_REFRESH_SECRET": "$jwt_refresh",
  "SESSION_SECRET": "$session_secret",
  "REDIS_PASSWORD": "$redis_pass",
  "SENTRY_DSN": "$sentry_dsn",
  "PUBLIC_SENTRY_DSN": "$pub_sentry_dsn",
  "SENTRY_AUTH_TOKEN": "$sentry_auth",
  "GRAFANA_CLOUD_API_KEY": "$grafana_key",
  "GRAFANA_CLOUD_USER": "$grafana_user",
  "LOKI_URL": "$loki_url",
  "GF_ADMIN_USER": "admin",
  "GF_ADMIN_PASSWORD": "$gf_pass",
  "SMTP_USER": "",
  "SMTP_PASS": "",
  "NODE_ENV": "production",
  "ALLOWED_ORIGINS": "$allowed_origins",
  "LOG_LEVEL": "$log_level",
  "PORT": "3000",
  "DB_HOST": "postgres",
  "DB_PORT": "5432",
  "DB_USER": "app_user",
  "DB_NAME": "assixx",
  "POSTGRES_USER": "assixx_user",
  "POSTGRES_DB": "assixx",
  "REDIS_HOST": "redis",
  "REDIS_PORT": "6379",
  "SMTP_HOST": "smtp.gmail.com",
  "SMTP_PORT": "587",
  "SMTP_FROM": "noreply@assixx.com",
  "ORIGIN": "$origin",
  "BODY_SIZE_LIMIT": "10M",
  "DELETION_GRACE_PERIOD_DAYS": "30",
  "DELETION_COOLING_OFF_HOURS": "24",
  "TENANT_DELETION_GRACE_MINUTES": "43200",
  "GF_ROOT_URL": "$gf_root_url",
  "GF_ANONYMOUS_ENABLED": "false",
  "LOKI_LOCAL_URL": "http://loki:3100"
}
ENDJSON

  # Clear sensitive variables from shell
  unset pg_pass db_pass jwt_secret jwt_refresh session_secret redis_pass gf_pass

  local key_count
  key_count=$(grep -c '"' "$TMPFILE" | awk '{print int($1/2)}')
  log_info "JSON payload built: $key_count keys"
}

# =============================================================================
# Dry Run Display
# =============================================================================

display_dry_run() {
  log_step "DRY RUN — Preview for '$TARGET_ENV'"
  echo ""
  echo -e "${BOLD}Critical Secrets (freshly generated):${NC}"
  echo -e "  ${CYAN}POSTGRES_PASSWORD${NC}    = [generated, 64 hex chars]"
  echo -e "  ${CYAN}DB_PASSWORD${NC}          = [generated, 64 hex chars]"
  echo -e "  ${CYAN}JWT_SECRET${NC}           = [generated, 128 hex chars]"
  echo -e "  ${CYAN}JWT_REFRESH_SECRET${NC}   = [generated, 128 hex chars]"
  echo -e "  ${CYAN}SESSION_SECRET${NC}       = [generated, 96 hex chars]"
  echo -e "  ${CYAN}REDIS_PASSWORD${NC}       = [generated, 64 hex chars]"
  echo ""
  echo -e "${BOLD}Optional Secrets:${NC}"
  echo -e "  ${CYAN}SENTRY_DSN${NC}           = [copied from dev]"
  echo -e "  ${CYAN}PUBLIC_SENTRY_DSN${NC}    = [copied from dev]"
  echo -e "  ${CYAN}SENTRY_AUTH_TOKEN${NC}    = [copied from dev]"
  echo -e "  ${CYAN}GRAFANA_CLOUD_API_KEY${NC}= [copied from dev]"
  echo -e "  ${CYAN}GRAFANA_CLOUD_USER${NC}   = [copied from dev]"
  echo -e "  ${CYAN}LOKI_URL${NC}             = [copied from dev]"
  echo -e "  ${CYAN}GF_ADMIN_USER${NC}        = admin"
  echo -e "  ${CYAN}GF_ADMIN_PASSWORD${NC}    = [generated, 32 hex chars]"
  echo -e "  ${YELLOW}SMTP_USER${NC}            = [empty — set manually]"
  echo -e "  ${YELLOW}SMTP_PASS${NC}            = [empty — set manually]"
  echo ""

  local allowed_origins log_level gf_root_url origin
  if [ "$TARGET_ENV" = "stg" ]; then
    allowed_origins="https://stg.assixx.com"
    log_level="info"
    gf_root_url="https://stg.assixx.com:3050"
    origin="https://stg.assixx.com"
  else
    allowed_origins="https://assixx.com"
    log_level="warn"
    gf_root_url="https://assixx.com:3050"
    origin="https://assixx.com"
  fi

  echo -e "${BOLD}Config Variables:${NC}"
  echo -e "  NODE_ENV              = production"
  echo -e "  ALLOWED_ORIGINS       = $allowed_origins"
  echo -e "  LOG_LEVEL             = $log_level"
  echo -e "  PORT                  = 3000"
  echo -e "  DB_HOST               = postgres"
  echo -e "  DB_PORT               = 5432"
  echo -e "  DB_USER               = app_user"
  echo -e "  DB_NAME               = assixx"
  echo -e "  POSTGRES_USER         = assixx_user"
  echo -e "  POSTGRES_DB           = assixx"
  echo -e "  REDIS_HOST            = redis"
  echo -e "  REDIS_PORT            = 6379"
  echo -e "  SMTP_HOST             = smtp.gmail.com"
  echo -e "  SMTP_PORT             = 587"
  echo -e "  SMTP_FROM             = noreply@assixx.com"
  echo -e "  ORIGIN                = $origin"
  echo -e "  BODY_SIZE_LIMIT       = 10M"
  echo -e "  GF_ROOT_URL           = $gf_root_url"
  echo -e "  GF_ANONYMOUS_ENABLED  = false"
  echo -e "  LOKI_LOCAL_URL        = http://loki:3100"
  echo -e "  DELETION_*            = (default values)"
  echo ""
  echo -e "${BOLD}Total: ~34 keys${NC}"
  echo ""
  log_warn "This was a dry run. No secrets were generated or written."
  log_info "Remove --dry-run to execute."
}

# =============================================================================
# Confirmation
# =============================================================================

confirm_upload() {
  echo ""
  echo -e "${BOLD}This will set ~34 secrets/configs in:${NC}"
  echo -e "  Project: ${CYAN}$DOPPLER_PROJECT${NC}"
  echo -e "  Config:  ${CYAN}$TARGET_ENV${NC}"
  echo ""
  echo -e "${YELLOW}Type the environment name to confirm:${NC} "
  read -r confirmation

  if [ "$confirmation" != "$TARGET_ENV" ]; then
    log_error "Confirmation failed ('$confirmation' != '$TARGET_ENV'). Aborting."
    exit 1
  fi
}

# =============================================================================
# Upload
# =============================================================================

upload_secrets() {
  log_step "Uploading secrets to '$TARGET_ENV'"

  doppler secrets upload "$TMPFILE" \
    --project "$DOPPLER_PROJECT" \
    --config "$TARGET_ENV"

  log_info "Upload complete."

  # Temp file cleaned up by trap, but be explicit
  rm -f "$TMPFILE"
  TMPFILE=""
}

# =============================================================================
# Verification
# =============================================================================

verify_secrets() {
  log_step "Verifying critical secrets in '$TARGET_ENV'"

  local critical_keys=(POSTGRES_PASSWORD DB_PASSWORD JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET REDIS_PASSWORD)
  local issues=0

  for key in "${critical_keys[@]}"; do
    local val
    val=$(doppler secrets get "$key" --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --plain 2>/dev/null || echo "")
    if [ -z "$val" ]; then
      log_error "MISSING: $key"
      issues=$((issues + 1))
    else
      log_info "OK: $key [${#val} chars]"
    fi
  done

  # Verify JWT secrets differ
  local jwt1 jwt2
  jwt1=$(doppler secrets get JWT_SECRET --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --plain 2>/dev/null || echo "")
  jwt2=$(doppler secrets get JWT_REFRESH_SECRET --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --plain 2>/dev/null || echo "")

  if [ "$jwt1" = "$jwt2" ]; then
    log_error "SECURITY: JWT_SECRET and JWT_REFRESH_SECRET are identical!"
    issues=$((issues + 1))
  else
    log_info "OK: JWT_SECRET != JWT_REFRESH_SECRET"
  fi

  # Verify min lengths
  if [ ${#jwt1} -lt 32 ]; then
    log_error "JWT_SECRET too short: ${#jwt1} chars (min 32)"
    issues=$((issues + 1))
  fi
  if [ ${#jwt2} -lt 32 ]; then
    log_error "JWT_REFRESH_SECRET too short: ${#jwt2} chars (min 32)"
    issues=$((issues + 1))
  fi

  echo ""
  if [ "$issues" -gt 0 ]; then
    log_error "Verification FAILED: $issues issue(s) found"
    exit 1
  fi

  log_info "Verification PASSED: All critical secrets set and valid"
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  log_step "Summary"

  local total
  total=$(doppler secrets --project "$DOPPLER_PROJECT" --config "$TARGET_ENV" --only-names 2>/dev/null \
    | grep -cvE "^(NAME|DOPPLER_CONFIG|DOPPLER_ENVIRONMENT|DOPPLER_PROJECT|─|┌|┐|└|┘|├|┤)$" || echo "0")

  echo ""
  echo -e "${BOLD}Environment:${NC}  $TARGET_ENV"
  echo -e "${BOLD}Total keys:${NC}   $total"
  echo ""
  echo -e "${GREEN}Done!${NC} Config '$TARGET_ENV' is now populated."
  echo ""
  log_warn "NEXT STEPS:"
  echo -e "  1. Update .locklock with secret NAMES (not values) for documentation"
  echo -e "  2. Set SMTP_USER and SMTP_PASS manually if email is needed:"
  echo -e "     ${CYAN}doppler secrets set SMTP_USER=\"...\" --project $DOPPLER_PROJECT --config $TARGET_ENV${NC}"
  echo -e "     ${CYAN}doppler secrets set SMTP_PASS=\"...\" --project $DOPPLER_PROJECT --config $TARGET_ENV${NC}"
  echo -e "  3. Update ALLOWED_ORIGINS and ORIGIN with actual domain when known"
  echo -e "  4. Create a Doppler service token for this environment:"
  echo -e "     ${CYAN}doppler configs tokens create docker-$TARGET_ENV --project $DOPPLER_PROJECT --config $TARGET_ENV --plain${NC}"
}

# =============================================================================
# Main
# =============================================================================

main() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   Doppler Environment Seeder — Assixx        ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"
  check_prerequisites
  check_existing_secrets

  if [ "$DRY_RUN" = true ]; then
    display_dry_run
    exit 0
  fi

  build_secrets_json
  confirm_upload
  upload_secrets
  verify_secrets
  print_summary
}

main "$@"
