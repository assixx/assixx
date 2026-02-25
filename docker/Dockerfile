# Multi-stage Dockerfile für Assixx Backend
# Stage 1: Build TypeScript
FROM node:24.13.1-alpine3.22 AS builder

# pnpm installieren (pinned version matching packageManager field)
# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
RUN npm install -g npm@11.8.0 pnpm@10.30.2

# Arbeitsverzeichnis setzen
WORKDIR /app

# Package files kopieren
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./

# Workspace package.json files kopieren (für pnpm workspace)
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Shared source kopieren (inject-workspace-packages needs source at install time)
COPY shared/ ./shared/

# Dependencies installieren
RUN pnpm install --frozen-lockfile

# Backend Source kopieren
COPY backend/ ./backend/

# TypeScript kompilieren
# 1. Shared zuerst (Backend importiert @assixx/shared/dist/*)
# 2. Backend danach
# Verify build outputs exist - fail fast if compilation fails silently
RUN cd shared && pnpm run build && \
    if [ ! -f "dist/index.js" ]; then \
      echo "ERROR: Shared build failed - dist/index.js not found!" && \
      ls -la dist/ 2>/dev/null || echo "(shared/dist/ does not exist)" && \
      exit 1; \
    fi && \
    echo "Shared build successful: dist/index.js exists" && \
    cd /app/backend && pnpm run build && \
    if [ ! -f "dist/nest/main.js" ]; then \
      echo "ERROR: Backend build failed - dist/nest/main.js not found!" && \
      ls -la dist/ 2>/dev/null || echo "(backend/dist/ does not exist)" && \
      exit 1; \
    fi && \
    echo "Backend build successful: dist/nest/main.js exists"

# Stage 2: Production Runtime
FROM node:24.13.1-alpine3.22

# pnpm installieren (pinned version matching packageManager field)
# Note: CVE-2025-64118 (tar) is fixed via pnpm override in package.json
# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
RUN npm install -g npm@11.8.0 pnpm@10.30.2

# Install dumb-init for proper signal handling (SIGTERM, SIGINT)
# This ensures graceful shutdown when Node.js runs as PID 1
RUN apk add --no-cache dumb-init

# Security: Non-root user erstellen
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Arbeitsverzeichnis
WORKDIR /app

# Production dependencies (tsx not needed — runs compiled JS)
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./

# Workspace package.json files kopieren
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Shared source kopieren (needed at runtime by tsx for @assixx/shared imports)
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared

RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Source Code kopieren
COPY --from=builder --chown=nodejs:nodejs /app/backend ./backend

# Environment
ENV NODE_ENV=production

# User wechseln
USER nodejs

# Port
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start Command with dumb-init for proper signal handling
# dumb-init ensures SIGTERM/SIGINT are forwarded to Node.js process
# NestJS Entry-Point — runs compiled JS (tsx can't handle parameter decorators like @Inject)
CMD ["dumb-init", "node", "backend/dist/nest/main.js"]
