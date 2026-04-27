# syntax=docker/dockerfile:1
# =============================================================================
# Assixx Backend - Production Dockerfile
# =============================================================================
# Multi-stage build: TypeScript compilation -> minimal production runtime
#
# BuildKit Optimizations:
# - Cache mounts for pnpm store (faster rebuilds)
# - COPY --link for independent layer caching
# =============================================================================

# Node version is configurable via docker-compose.yml build args.
#
# IMPORTANT: Debian slim (glibc), NOT Alpine (musl).
# Rationale: musl ships without EDNS0, and its `getaddrinfo(AF_UNSPEC)` plus
# Docker's IPv4-only embedded DNS (127.0.0.11) combine into a well-known
# failure class — parallel A+AAAA with "first response wins", fragile on
# truncation / NXDOMAIN — producing AAAA-only answers that fail ENETUNREACH
# on v4-only bridges. Hits every outbound fetch() (OAuth token exchange,
# JWKS, any third-party HTTPS). glibc implements EDNS0, TCP fallback, and
# RFC-compliant dual-stack semantics; the whole class disappears.
# See ADR-027 (pinning), moby#41651, bell-sw "Alpine DNS issues".
ARG NODE_VERSION=24.15.0-bookworm-slim

# -----------------------------------------------------------------------------
# Stage 1: Build TypeScript
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
LABEL org.opencontainers.image.authors="Assixx"

# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
# pnpm AND npm parameterised — versions configurable via docker-compose
# build args / docker/.env. See ADR-027 §"Amendment 2026-04-27".
ARG PNPM_VERSION=10.33.2
ARG NPM_VERSION=11.13.0
RUN npm install -g "npm@${NPM_VERSION}" "pnpm@${PNPM_VERSION}"

WORKDIR /app

# Package + config files (cache-friendly order: least-changing first)
# tsconfig files needed for tsc compilation (NOT copied to production stage)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json ./

# Workspace package.json files
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Shared source (inject-workspace-packages needs source at install time)
COPY shared/ ./shared/

# Dependencies with BuildKit cache mount
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Backend source
COPY backend/ ./backend/

# Build shared (Backend imports @assixx/shared/dist/*).
# Sync built dist/ into ALL injected workspace copies — same dance as
# Dockerfile.frontend:50-53. Reason: inject-workspace-packages=true copies
# shared/ at install time (when dist/ doesn't exist yet); pnpm won't
# re-inject on subsequent installs, so the dist/ must be manually synced
# into node_modules/@assixx/shared/dist/. pnpm deploy reads from
# node_modules and would otherwise miss the dist.
# Uses `pnpm run --filter=@assixx/shared build` (run from /app, not from
# the package dir) to match Dockerfile.frontend:50 exactly — proven
# working in the production frontend pipeline.
RUN pnpm run --filter=@assixx/shared build && \
    test -d /app/shared/dist || { echo "ERROR: Shared build failed!"; exit 1; } && \
    find /app/node_modules -path '*/@assixx/shared' -type d \
      -exec cp -r /app/shared/dist {} \;

# Build backend
WORKDIR /app/backend
RUN pnpm run build && \
    test -f dist/nest/main.js || { echo "ERROR: Backend build failed - dist/nest/main.js not found!"; exit 1; }

# pnpm deploy: produces a self-contained /deploy with backend's prod-deps
# resolved into hard copies (no workspace symlinks remain). Mirrors the
# Frontend pattern (Dockerfile.frontend:83) and closes ADR-027 §3
# ("pnpm deploy for Backend (Like Frontend)" — previously Deferred).
# Without this, the production stage had to re-run `pnpm install --prod`
# at workspace root, which transitively pulled in unused frontend prod
# deps (svelte, @sveltejs/kit, etc.) — see ADR-027 §3 Amendment.
#
# IMPORTANT: --filter matches the `name` field in backend/package.json,
# NOT the directory name. Package name is `assixx-backend` (no @scope) —
# only @assixx/shared uses the scoped form. Mismatch with `@assixx/backend`
# silently produces an empty /deploy (filter matches nothing → exit 0).
WORKDIR /app
RUN pnpm deploy --filter=assixx-backend --prod /deploy

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
# Mirror of Dockerfile.frontend:90-131 — copies the self-contained /deploy
# directory produced by `pnpm deploy` in the builder. No pnpm install at
# runtime, no workspace package.json fan-out, no shared/dist re-copy.
# Closes ADR-027 §3 ("pnpm deploy for Backend (Like Frontend)").
FROM node:${NODE_VERSION} AS production
LABEL org.opencontainers.image.authors="Assixx"

# Install runtime dependencies + create non-root user (Debian/apt, not Alpine/apk).
# - dumb-init: PID 1 signal forwarding (SIGTERM, SIGINT)
# - Fix CVE-2025-64756: npm upgrade for patched glob (kept in case any
#   transitive runtime dep shells out to npm; matches Dockerfile.frontend:104).
# Note: CVE-2025-64118 (tar) is fixed via pnpm override in package.json,
# applied transitively through pnpm deploy.
# Non-root user created with `useradd -r` (system user, no home) —
# Debian equivalent of BusyBox `adduser -S` from the prior Alpine image.
# pnpm is intentionally NOT installed in the production stage: the
# /deploy output already has all workspace symlinks resolved into hard
# copies, so node can resolve every import without a package manager.
ARG NPM_VERSION=11.13.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g "npm@${NPM_VERSION}" \
    && groupadd -r -g 1001 nodejs \
    && useradd -r -u 1001 -g nodejs --no-log-init nodejs

WORKDIR /app

# Self-contained deployed package — no workspace resolution needed at runtime.
# pnpm deploy in builder already pruned dev deps and inlined @assixx/shared/dist
# into node_modules/@assixx/shared/. Numeric UID:GID (1001:1001) because
# COPY --link can't resolve usernames.
COPY --link --from=builder --chown=1001:1001 /deploy/node_modules ./node_modules
COPY --link --from=builder --chown=1001:1001 /deploy/package.json ./

# Backend compiled output only (no source .ts files in production)
COPY --link --from=builder --chown=1001:1001 /app/backend/dist ./backend/dist

ENV NODE_ENV=production

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# dumb-init ensures SIGTERM/SIGINT are forwarded to Node.js process
CMD ["dumb-init", "node", "backend/dist/nest/main.js"]
