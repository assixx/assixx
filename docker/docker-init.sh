#!/bin/bash
# =============================================================================
# Assixx Docker Setup Script
# =============================================================================
#
# Idempotent setup for new developers. Safe to run multiple times.
#
# Two modes:
#   1. Doppler (default if installed): doppler run -- ./docker-init.sh
#   2. Local .env (fallback):          ./docker-init.sh --local
#
# What this script does:
#   1. Checks prerequisites (Docker, pnpm)
#   2. Creates required external Docker volumes
#   3. Ensures docker/.env exists (local mode only)
#   4. Starts core containers (postgres, redis, backend, deletion-worker)
#   5. Waits for health checks (real polling, not blind sleep)
#   6. Runs database migrations
#   7. Applies seed data
#   8. Builds @assixx/shared workspace package
#   9. Shows next steps
#
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MAX_WAIT_SECONDS=60
POLL_INTERVAL=3

# --- Parse arguments ---
USE_LOCAL=false
for arg in "$@"; do
  case "$arg" in
    --local) USE_LOCAL=true ;;
    --help|-h)
      echo "Usage: ./docker-init.sh [--local]"
      echo ""
      echo "  --local   Use docker/.env instead of Doppler for secrets"
      echo ""
      echo "Default: Uses Doppler if installed and configured."
      echo "         Falls back to --local mode if Doppler is not available."
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Run ./docker-init.sh --help for usage."
      exit 1
      ;;
  esac
done

# --- Helper functions ---
info()  { echo "  $1"; }
ok()    { echo "  [OK] $1"; }
fail()  { echo "  [FAIL] $1"; exit 1; }
warn()  { echo "  [WARN] $1"; }
step()  { echo ""; echo "==> $1"; }

# --- Determine compose command ---
# Build the docker-compose command prefix based on mode
build_compose_cmd() {
  if [ "$USE_LOCAL" = true ]; then
    echo "docker-compose"
  elif command -v doppler &> /dev/null; then
    echo "doppler run -- docker-compose"
  else
    warn "Doppler not found. Falling back to local .env mode."
    USE_LOCAL=true
    echo "docker-compose"
  fi
}

# =============================================================================
# Step 1: Prerequisites
# =============================================================================
step "Step 1/7: Checking prerequisites"

if ! command -v docker &> /dev/null; then
  fail "Docker is not installed. See: https://docs.docker.com/get-docker/"
fi
ok "Docker installed"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  fail "Docker Compose is not installed. See: https://docs.docker.com/compose/install/"
fi
ok "Docker Compose installed"

if ! command -v pnpm &> /dev/null; then
  fail "pnpm is not installed. Run: npm install -g pnpm@10"
fi
ok "pnpm $(pnpm --version) installed"

if [ "$USE_LOCAL" = false ] && command -v doppler &> /dev/null; then
  ok "Doppler installed (using Doppler for secrets)"
else
  if [ "$USE_LOCAL" = false ]; then
    warn "Doppler not found. Using local .env mode."
    USE_LOCAL=true
  else
    info "Using local .env mode (--local flag)"
  fi
fi

# Ensure we're in the right place
if [ ! -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
  fail "docker-compose.yml not found in ${SCRIPT_DIR}. Are you in the right directory?"
fi

COMPOSE_CMD=$(build_compose_cmd)

# =============================================================================
# Step 2: Docker volumes (external: true in docker-compose.yml)
# =============================================================================
step "Step 2/7: Creating Docker volumes"

for vol in assixx_postgres_data assixx_redis_data; do
  if docker volume inspect "$vol" &> /dev/null; then
    ok "Volume '$vol' exists"
  else
    docker volume create "$vol" > /dev/null
    ok "Volume '$vol' created"
  fi
done

# =============================================================================
# Step 3: Environment configuration (.env for local mode)
# =============================================================================
step "Step 3/7: Checking environment configuration"

if [ "$USE_LOCAL" = true ]; then
  if [ -f "${SCRIPT_DIR}/.env" ]; then
    ok "docker/.env exists"
    # Check for placeholder values
    if grep -q "CHANGE_ME" "${SCRIPT_DIR}/.env"; then
      warn "docker/.env contains CHANGE_ME placeholders!"
      warn "Edit docker/.env and replace ALL placeholder values before use."
      warn "Generate secrets with: openssl rand -base64 32"
    fi
  elif [ -f "${SCRIPT_DIR}/.env.example" ]; then
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
    ok "Created docker/.env from .env.example"
    warn "You MUST edit docker/.env and replace ALL CHANGE_ME placeholders!"
    warn "Generate secrets with: openssl rand -base64 32"
    echo ""
    info "Press Enter after editing docker/.env to continue, or Ctrl+C to abort."
    read -r
  else
    fail "No .env or .env.example found in docker/"
  fi
else
  ok "Using Doppler for secret injection"
fi

# =============================================================================
# Step 4: Start containers
# =============================================================================
step "Step 4/7: Starting Docker containers"

cd "$SCRIPT_DIR"
eval "$COMPOSE_CMD up -d"
ok "Containers started"

# =============================================================================
# Step 5: Wait for health checks
# =============================================================================
step "Step 5/7: Waiting for services to become healthy"

wait_for_health() {
  local service_name="$1"
  local url="$2"
  local elapsed=0

  while [ $elapsed -lt $MAX_WAIT_SECONDS ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      ok "$service_name is healthy (${elapsed}s)"
      return 0
    fi
    sleep $POLL_INTERVAL
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  fail "$service_name did not become healthy within ${MAX_WAIT_SECONDS}s. Check: docker logs assixx-${service_name,,}"
}

# Wait for PostgreSQL via docker health check
info "Waiting for PostgreSQL..."
elapsed=0
while [ $elapsed -lt $MAX_WAIT_SECONDS ]; do
  if docker exec assixx-postgres pg_isready -U assixx_user -d assixx > /dev/null 2>&1; then
    ok "PostgreSQL is ready (${elapsed}s)"
    break
  fi
  sleep $POLL_INTERVAL
  elapsed=$((elapsed + POLL_INTERVAL))
  if [ $elapsed -ge $MAX_WAIT_SECONDS ]; then
    fail "PostgreSQL did not become ready within ${MAX_WAIT_SECONDS}s. Check: docker logs assixx-postgres"
  fi
done

# Wait for Backend API
wait_for_health "Backend" "http://localhost:3000/health"

# =============================================================================
# Step 6: Database migrations + seeds
# =============================================================================
step "Step 6/7: Running database migrations and seeds"

cd "$PROJECT_ROOT"

if [ "$USE_LOCAL" = true ]; then
  # Source .env for migration scripts (they need POSTGRES_PASSWORD etc.)
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a

  info "Running migrations..."
  ./scripts/run-migrations.sh up
  ok "Migrations applied"

  info "Running seeds..."
  ./scripts/run-seeds.sh
  ok "Seeds applied"
else
  info "Running migrations..."
  doppler run -- ./scripts/run-migrations.sh up
  ok "Migrations applied"

  info "Running seeds..."
  doppler run -- ./scripts/run-seeds.sh
  ok "Seeds applied"
fi

# =============================================================================
# Step 7: Build shared workspace package
# =============================================================================
step "Step 7/7: Building @assixx/shared package"

cd "$PROJECT_ROOT"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Dependencies installed"

pnpm --filter @assixx/shared build
ok "@assixx/shared built"

# =============================================================================
# Done!
# =============================================================================
echo ""
echo "============================================="
echo "  Assixx setup complete!"
echo "============================================="
echo ""
echo "  Next steps:"
echo ""
echo "  1. Start the frontend dev server:"
echo "     cd ${PROJECT_ROOT} && pnpm run dev:svelte"
echo ""
echo "  2. Open in browser:"
echo "     http://localhost:5173        (SvelteKit Dev Server)"
echo "     http://localhost:3000/health (Backend API Health)"
echo ""
echo "  Useful commands:"
echo "     docker-compose ps                     Status"
echo "     docker logs -f assixx-backend          Backend logs"
echo "     docker-compose down                   Stop all"
echo "     docker exec -it assixx-postgres psql -U assixx_user -d assixx"
echo ""
echo "  For production mode (Nginx + SSR):"
echo "     cd docker"
echo "     doppler run -- docker-compose --profile production up -d"
echo "     Open: http://localhost"
echo ""
echo "  Documentation: docs/DOCKER-SETUP.md"
echo "============================================="
