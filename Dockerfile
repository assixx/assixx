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

# TypeScript kompilieren
RUN npm run build:ts

# Stage 2: Production Runtime
FROM node:20-alpine

# Security: Non-root user erstellen
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Arbeitsverzeichnis
WORKDIR /app

# Nur Production Dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit && \
    npm cache clean --force

# Kompilierte Files vom Builder kopieren
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/backend/templates ./backend/templates

# Environment
ENV NODE_ENV=production

# User wechseln
USER nodejs

# Port
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start Command
CMD ["node", "dist/backend/src/server.js"]