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

# Node version is configurable via docker-compose.yml build args
ARG NODE_VERSION=24.14.0-alpine3.22

# -----------------------------------------------------------------------------
# Stage 1: Build TypeScript
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
LABEL org.opencontainers.image.authors="Assixx"

# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
# pnpm version configurable for consistency across environments
ARG PNPM_VERSION=10.30.3
RUN npm install -g npm@11.9.0 "pnpm@${PNPM_VERSION}"

WORKDIR /app

# Package files (cache-friendly order: least-changing first)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

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

# Install runtime dependencies + create non-root user
# - dumb-init: PID 1 signal forwarding (SIGTERM, SIGINT)
# - Fix CVE-2025-64756: npm upgrade for patched glob
# Note: CVE-2025-64118 (tar) is fixed via pnpm override in package.json
ARG PNPM_VERSION=10.30.3
RUN apk add --no-cache dumb-init && \
    npm install -g npm@11.9.0 "pnpm@${PNPM_VERSION}" && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

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
