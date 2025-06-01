# Multi-stage Dockerfile für Assixx Backend
# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

# Arbeitsverzeichnis setzen
WORKDIR /app

# Package files kopieren
COPY package*.json ./
COPY tsconfig.json ./

# Dependencies installieren
RUN npm ci --only=production && \
    npm ci --only=development --no-audit

# Backend Source kopieren
COPY backend/ ./backend/

# Fix-Script kopieren (in scripts Ordner)
RUN mkdir -p scripts
COPY scripts/fix-esm-imports.js ./scripts/

# TypeScript kompilieren
RUN npm run build:ts

# Stage 2: Production Runtime
FROM node:20-alpine

# Security: Non-root user erstellen
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Arbeitsverzeichnis
WORKDIR /app

# Alle Dependencies (inkl. tsx für runtime)
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --no-audit && \
    npm cache clean --force

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

# Start Command with tsx for better ESM support
CMD ["npx", "tsx", "backend/src/server.ts"]