# Multi-stage Dockerfile für Assixx Backend
# Stage 1: Build TypeScript
FROM node:24.13.0-alpine3.22 AS builder

# pnpm installieren (pinned version matching packageManager field)
# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
RUN npm install -g npm@latest pnpm@10.28.0

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
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Dependencies installieren
RUN pnpm install --frozen-lockfile

# Backend Source kopieren
COPY backend/ ./backend/

# TypeScript kompilieren (für Type-Checking, tsx führt TS direkt aus)
# Verify build output exists - fail fast if compilation fails silently
RUN cd backend && pnpm run build && \
    if [ ! -f "dist/nest/main.js" ]; then \
      echo "ERROR: TypeScript build failed - dist/nest/main.js not found!" && \
      echo "Contents of backend/dist:" && \
      ls -la dist/ 2>/dev/null || echo "(dist/ does not exist)" && \
      exit 1; \
    fi && \
    echo "Build successful: dist/nest/main.js exists"

# Stage 2: Production Runtime
FROM node:24.13.0-alpine3.22

# pnpm installieren (pinned version matching packageManager field)
# Note: CVE-2025-64118 (tar) is fixed via pnpm override in package.json
# Fix CVE-2025-64756: Update npm to get patched glob (>=11.1.0)
RUN npm install -g npm@latest pnpm@10.28.0

# Install dumb-init for proper signal handling (SIGTERM, SIGINT)
# This ensures graceful shutdown when Node.js runs as PID 1
RUN apk add --no-cache dumb-init

# Security: Non-root user erstellen
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Arbeitsverzeichnis
WORKDIR /app

# Alle Dependencies (inkl. tsx für runtime)
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./

# Workspace package.json files kopieren
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

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
# NestJS Entry-Point (migrated from Express)
CMD ["dumb-init", "pnpm", "exec", "tsx", "backend/src/nest/main.ts"]
