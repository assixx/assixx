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
# pnpm version configurable for consistency across environments
ARG PNPM_VERSION=10.33.2
RUN npm install -g npm@11.9.0 "pnpm@${PNPM_VERSION}"

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

# Build shared (Backend imports @assixx/shared/dist/*)
WORKDIR /app/shared
RUN pnpm run build && \
    test -f dist/index.js || { echo "ERROR: Shared build failed - dist/index.js not found!"; exit 1; }

# Build backend
WORKDIR /app/backend
RUN pnpm run build && \
    test -f dist/nest/main.js || { echo "ERROR: Backend build failed - dist/nest/main.js not found!"; exit 1; }

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS production
LABEL org.opencontainers.image.authors="Assixx"

# Install runtime dependencies + create non-root user (Debian/apt, not Alpine/apk).
# - dumb-init: PID 1 signal forwarding (SIGTERM, SIGINT)
# - Fix CVE-2025-64756: npm upgrade for patched glob
# Note: CVE-2025-64118 (tar) is fixed via pnpm override in package.json
# Non-root user created with `useradd -r` (system user, no home) —
# Debian equivalent of BusyBox `adduser -S` from the prior Alpine image.
ARG PNPM_VERSION=10.33.2
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.9.0 "pnpm@${PNPM_VERSION}" \
    && groupadd -r -g 1001 nodejs \
    && useradd -r -u 1001 -g nodejs --no-log-init nodejs

WORKDIR /app

# Package files for pnpm workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Workspace package.json files (all needed for pnpm lockfile resolution)
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Shared compiled output only (inject-workspace-packages needs dist/ at install time)
# No source .ts files needed at runtime — exports resolve to dist/*.js
COPY --link --from=builder /app/shared/dist ./shared/dist

# Production dependencies only
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Backend compiled output only (no source .ts files in production)
COPY --link --from=builder --chown=1001:1001 /app/backend/dist ./backend/dist

ENV NODE_ENV=production

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# dumb-init ensures SIGTERM/SIGINT are forwarded to Node.js process
CMD ["dumb-init", "node", "backend/dist/nest/main.js"]
