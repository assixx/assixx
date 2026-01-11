# Frontend Rename Migration Plan (REVISED v3.0)

> **Date**: 2026-01-06
> **Branch**: feature/nestjs-migration
> **Author**: Claude Code / System Engineer
> **Status**: COMPLETE PLAN WITH PRODUCTION DOCKER SETUP
> **Revision**: 3.0 (Added Option 1: Separate Container Architecture)

---

## Executive Summary

This document provides a **zero-error migration plan** to:

1. Archive the legacy `frontend/` directory to `frontend-legacy/`
2. Create a ZIP backup of the archived folder
3. Rename `frontend-svelte/` to `frontend/`
4. Update ALL configuration references
5. **Setup Production Docker Architecture (Option 1 - Best Practice)**

---

## Architecture Overview

### Target Architecture (Option 1 - Separate Containers)

```
                        ┌─────────────────────────────────────┐
                        │           Nginx :80                 │
                        │        (Reverse Proxy)              │
                        └──────────────┬──────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │    SvelteKit     │ │     Backend      │ │   PostgreSQL     │
         │  (Frontend)      │ │   (NestJS API)   │ │                  │
         │     :3001        │ │     :3000        │ │     :5432        │
         └──────────────────┘ └──────────────────┘ └──────────────────┘
                    │                  │                  │
                    └──────────────────┴──────────────────┘
                                       │
                              ┌────────┴────────┐
                              │     Redis       │
                              │     :6379       │
                              └─────────────────┘
```

### Routing (via Nginx)

| Path         | Destination   | Description                        |
| ------------ | ------------- | ---------------------------------- |
| `/api/*`     | backend:3000  | All API calls                      |
| `/uploads/*` | backend:3000  | Uploaded files                     |
| `/health`    | backend:3000  | Backend health check               |
| `/chat-ws`   | backend:3000  | WebSocket for chat                 |
| `/*`         | frontend:3001 | All other requests (SvelteKit SSR) |

---

## Pre-Flight Checklist

Before executing ANY commands, verify:

- [ ] All Docker containers are stopped (`docker-compose down`)
- [ ] No running dev servers (`lsof -i :5173 && lsof -i :5174`)
- [ ] Git status is clean (all changes committed)
- [ ] pnpm-lock.yaml has no pending changes
- [ ] Database backup exists (precautionary)
- [ ] Read and understood complete plan

---

## PART 1: Directory Rename (Development)

### Phase 1: Preparation

```bash
# 1.1 Stop all Docker containers
cd /home/scs/projects/Assixx/docker
docker-compose down

# 1.2 Kill any running dev servers
pkill -f "vite" || true
pkill -f "node" || true

# 1.3 Verify no processes on ports
lsof -i :5173 -i :5174 -i :3000 || echo "All ports free"

# 1.4 Verify git status
cd /home/scs/projects/Assixx
git status

# 1.5 Create safety backup
tar -czf ../assixx-backup-$(date +%Y%m%d_%H%M%S).tar.gz .
echo "Backup created at ../assixx-backup-*.tar.gz"
```

### Phase 2: Archive Legacy Frontend

```bash
cd /home/scs/projects/Assixx

# 2.1 Rename frontend to frontend-legacy
mv frontend frontend-legacy

# 2.2 Verify rename
ls -la | grep frontend
# Should show: frontend-legacy/

# 2.3 Create ZIP archive of legacy frontend
zip -r frontend-legacy-archive-$(date +%Y%m%d).zip frontend-legacy/

# 2.4 Verify ZIP created
ls -lh frontend-legacy-archive-*.zip
```

### Phase 3: Rename SvelteKit Frontend

```bash
# 3.1 Rename frontend-svelte to frontend
mv frontend-svelte frontend

# 3.2 Verify structure
ls -la | grep frontend
# Should show:
# frontend/         (NEW - SvelteKit)
# frontend-legacy/  (OLD - Vite)

# 3.3 Verify SvelteKit files exist
ls -la frontend/
# Should show: svelte.config.js, vite.config.ts, src/, static/, etc.
```

### Phase 4: Update Configuration Files

#### 4.1 pnpm-workspace.yaml

**File**: `/home/scs/projects/Assixx/pnpm-workspace.yaml`

```yaml
# REMOVE the "frontend-svelte" line
packages:
  - 'frontend'
  - 'backend'
ignoredBuiltDependencies:
  - unrs-resolver
onlyBuiltDependencies:
  - '@swc/core'
  - 'esbuild'
```

#### 4.2 package.json (root) - Lines 41-42

**File**: `/home/scs/projects/Assixx/package.json`

```json
"predev:svelte": "./scripts/free-port.sh 5173",
"dev:svelte": "cd frontend && pnpm run dev",
```

#### 4.3 eslint.config.js - Lines 70-71

**File**: `/home/scs/projects/Assixx/eslint.config.js`

```javascript
// Replace frontend-svelte with frontend-legacy
'frontend-legacy/**',
```

#### 4.4 .gitignore - Lines 26-27

**File**: `/home/scs/projects/Assixx/.gitignore`

```
frontend/build/
frontend/.svelte-kit/
frontend-legacy/
```

#### 4.5 frontend/package.json - Line 2

**File**: `/home/scs/projects/Assixx/frontend/package.json`

```json
"name": "assixx-frontend",
```

#### 4.6 frontend/vite.config.ts - Lines 13, 14, 19

**File**: `/home/scs/projects/Assixx/frontend/vite.config.ts`

```typescript
server: {
  port: 5173,
  strictPort: true, // Fail if port 5173 is unavailable

  hmr: {
    overlay: true,
    port: 5173,
    // ...
  },
}
```

#### 4.7 vitest.config.ts - Line 17 (Recommended)

**File**: `/home/scs/projects/Assixx/vitest.config.ts`

```typescript
api: {
  port: 5175, // Avoid conflict with dev server
},
```

### Phase 5: Regenerate Dependencies

```bash
cd /home/scs/projects/Assixx

# 5.1 Remove old node_modules
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf frontend-legacy/node_modules
rm -rf backend/node_modules

# 5.2 Remove pnpm-lock.yaml
rm pnpm-lock.yaml

# 5.3 Reinstall all dependencies
pnpm install

# 5.4 Verify workspace packages
pnpm list --depth 0
```

### Phase 6: Development Verification

```bash
cd /home/scs/projects/Assixx

# 6.1 Verify ESLint
pnpm run lint

# 6.2 Verify SvelteKit
cd frontend
pnpm exec svelte-kit sync
pnpm run check
pnpm run build

# 6.3 Test dev server
pnpm run dev
# → http://localhost:5173
```

---

## PART 2: Production Docker Setup (Option 1)

### Phase 7: Create Dockerfile.frontend

**NEW FILE**: `/home/scs/projects/Assixx/docker/Dockerfile.frontend`

```dockerfile
# =============================================================================
# Assixx SvelteKit Frontend - Production Dockerfile
# =============================================================================
# Multi-stage build for optimal image size
# Uses @sveltejs/adapter-node for SSR
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.27.0

WORKDIR /app

# Copy package files first (better layer caching)
COPY frontend/package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY frontend/ ./

# Build SvelteKit application
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:24-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./

# Install production dependencies only
RUN npm install -g pnpm@10.27.0 && \
    pnpm install --prod --frozen-lockfile

# Switch to non-root user
USER sveltekit

# SvelteKit adapter-node default port
EXPOSE 3001

# Environment variables for SvelteKit
ENV NODE_ENV=production
ENV PORT=3001
ENV ORIGIN=http://localhost

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start SvelteKit server
CMD ["node", "build"]
```

### Phase 8: Create Nginx Configuration

**NEW FILE**: `/home/scs/projects/Assixx/docker/nginx/nginx.conf`

```nginx
# =============================================================================
# Assixx Nginx Reverse Proxy Configuration
# =============================================================================
# Routes traffic between SvelteKit frontend and NestJS backend
# =============================================================================

upstream frontend {
    server frontend:3001;
    keepalive 32;
}

upstream backend {
    server backend:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Client body size (for file uploads)
    client_max_body_size 100M;

    # =========================================================================
    # API Routes → Backend (NestJS)
    # =========================================================================
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # =========================================================================
    # Uploads → Backend
    # =========================================================================
    location /uploads/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Caching for static uploads
        proxy_cache_valid 200 1d;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # =========================================================================
    # Health Check → Backend
    # =========================================================================
    location /health {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # =========================================================================
    # WebSocket (Chat) → Backend
    # =========================================================================
    location /chat-ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # =========================================================================
    # All Other Routes → SvelteKit Frontend
    # =========================================================================
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Phase 9: Update docker-compose.yml

**FILE**: `/home/scs/projects/Assixx/docker/docker-compose.yml`

**ADD these services** (after existing services):

```yaml
# ===========================================================================
# SvelteKit Frontend (Production)
# ===========================================================================
frontend:
  build:
    context: ..
    dockerfile: docker/Dockerfile.frontend
  image: assixx-frontend:prod
  container_name: assixx-frontend
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 256M
  environment:
    NODE_ENV: production
    PORT: 3001
    ORIGIN: ${ORIGIN:-http://localhost}
    BODY_SIZE_LIMIT: ${BODY_SIZE_LIMIT:-10M}
    # API URL for server-side fetches
    PUBLIC_API_URL: http://backend:3000
  ports:
    - '3001:3001' # Direct access for debugging
  depends_on:
    backend:
      condition: service_healthy
  networks:
    - assixx-network
  healthcheck:
    test:
      [
        'CMD',
        'node',
        '-e',
        "require('http').get('http://localhost:3001', (r) => process.exit(r.statusCode === 200 ? 0 : 1))",
      ]
    interval: 30s
    timeout: 10s
    retries: 3

# ===========================================================================
# Nginx Reverse Proxy
# ===========================================================================
nginx:
  image: nginx:alpine
  container_name: assixx-nginx
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 256M
      reservations:
        cpus: '0.25'
        memory: 64M
  ports:
    - '80:80'
    # - "443:443"  # Uncomment for HTTPS
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    # - ./nginx/ssl:/etc/nginx/ssl:ro  # Uncomment for HTTPS
  depends_on:
    - frontend
    - backend
  networks:
    - assixx-network
  healthcheck:
    test: ['CMD', 'nginx', '-t']
    interval: 30s
    timeout: 10s
    retries: 3
```

### Phase 10: Update Backend to Remove Static File Serving

**FILE**: `/home/scs/projects/Assixx/backend/src/nest/main.ts`

The backend no longer needs to serve frontend files. Update these functions:

```typescript
// REMOVE or COMMENT OUT these sections:

// 1. Remove getProjectPaths() frontend paths (keep only uploads)
function getProjectPaths(): ProjectPaths {
  const projectRoot = path.resolve(process.cwd(), '..');
  return {
    projectRoot,
    uploadsPath: path.join(projectRoot, 'uploads'),
    // REMOVED: distPath, publicPath, srcPath, pagesPath, storybookPath
  };
}

// 2. Simplify setupStaticAssets() - only serve uploads
async function setupStaticAssets(app: NestFastifyApplication, paths: ProjectPaths): Promise<void> {
  // Only uploads (user-generated content)
  await app.register(fastifyStatic, {
    root: paths.uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });
}

// 3. REMOVE setupHtmlRoutes() entirely
// Frontend is now served by SvelteKit container

// 4. Update bootstrap() to not call setupHtmlRoutes()
```

**Alternative (Minimal Change)**: Keep the static file serving but it will 404 gracefully since files don't exist.

### Phase 11: Add SvelteKit Health Endpoint

**NEW FILE**: `/home/scs/projects/Assixx/frontend/src/routes/health/+server.ts`

```typescript
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    service: 'sveltekit-frontend',
    timestamp: new Date().toISOString(),
  });
};
```

### Phase 12: Create nginx Directory

```bash
mkdir -p /home/scs/projects/Assixx/docker/nginx
```

---

## PART 3: Verification & Deployment

### Phase 13: Build and Test Production

```bash
cd /home/scs/projects/Assixx/docker

# 13.1 Build all images
docker-compose build

# 13.2 Start all services
docker-compose up -d

# 13.3 Check status
docker-compose ps

# 13.4 Check logs
docker-compose logs -f

# 13.5 Test endpoints
curl -s http://localhost/health | jq '.'           # Backend health
curl -s http://localhost/api/v2/auth/check         # API
curl -s http://localhost                            # Frontend (via nginx)
curl -s http://localhost:3001                       # Frontend (direct)
curl -s http://localhost:3000/health | jq '.'       # Backend (direct)
```

### Expected Results

| URL                                  | Response                                       |
| ------------------------------------ | ---------------------------------------------- |
| `http://localhost/`                  | SvelteKit Login Page                           |
| `http://localhost/health`            | `{"status":"ok","framework":"NestJS+Fastify"}` |
| `http://localhost/api/v2/auth/check` | Auth response                                  |
| `http://localhost:3001/`             | SvelteKit (direct)                             |
| `http://localhost:3000/health`       | Backend health (direct)                        |

---

## Development vs Production Workflow

### Development (Local)

```bash
# Terminal 1: Docker (Backend + DB + Redis)
cd /home/scs/projects/Assixx/docker
docker-compose up -d postgres redis backend

# Terminal 2: SvelteKit with HMR
cd /home/scs/projects/Assixx
pnpm run dev:svelte
# → http://localhost:5173 (with hot reload)
```

### Production (Docker)

```bash
# Start everything
cd /home/scs/projects/Assixx/docker
docker-compose up -d

# Access via Nginx
# → http://localhost (or your domain)
```

### Production Build Command

```bash
# Build frontend container
docker-compose build frontend

# Or rebuild all
docker-compose build --no-cache
```

---

## Files Summary

### NEW Files to Create

| #   | File                                    | Purpose                    |
| --- | --------------------------------------- | -------------------------- |
| 1   | `docker/Dockerfile.frontend`            | SvelteKit production build |
| 2   | `docker/nginx/nginx.conf`               | Reverse proxy config       |
| 3   | `frontend/src/routes/health/+server.ts` | Health endpoint            |

### Files to Modify

| #   | File                        | Changes                               |
| --- | --------------------------- | ------------------------------------- |
| 1   | `pnpm-workspace.yaml`       | Remove `frontend-svelte`              |
| 2   | `package.json` (root)       | Update scripts                        |
| 3   | `eslint.config.js`          | Update ignores                        |
| 4   | `.gitignore`                | Update paths                          |
| 5   | `frontend/package.json`     | Rename package                        |
| 6   | `frontend/vite.config.ts`   | Change ports                          |
| 7   | `vitest.config.ts`          | Change port                           |
| 8   | `docker/docker-compose.yml` | Add frontend + nginx services         |
| 9   | `backend/src/nest/main.ts`  | Remove static file serving (optional) |

### Directories to Create

```bash
mkdir -p /home/scs/projects/Assixx/docker/nginx
```

---

## Rollback Plan

```bash
# ROLLBACK - Execute only if migration fails!

cd /home/scs/projects/Assixx

# 1. Stop all containers
cd docker && docker-compose down

# 2. Restore frontend directories
cd ..
mv frontend frontend-broken
mv frontend-legacy frontend
mv frontend-broken frontend-svelte

# 3. Remove new Docker files
rm -f docker/Dockerfile.frontend
rm -rf docker/nginx

# 4. Git reset configuration changes
git checkout -- pnpm-workspace.yaml
git checkout -- package.json
git checkout -- eslint.config.js
git checkout -- .gitignore
git checkout -- vitest.config.ts
git checkout -- docker/docker-compose.yml

# 5. Reinstall dependencies
rm -rf node_modules
pnpm install

# 6. Verify rollback
pnpm run lint
cd frontend && pnpm run build
```

---

## Port Reference

### Development

| Service          | Port | URL                     |
| ---------------- | ---- | ----------------------- |
| SvelteKit (dev)  | 5173 | `http://localhost:5173` |
| Backend (Docker) | 3000 | `http://localhost:3000` |
| PostgreSQL       | 5432 | -                       |
| Redis            | 6379 | -                       |
| Vitest UI        | 5175 | `http://localhost:5175` |

### Production

| Service    | Port | URL                                |
| ---------- | ---- | ---------------------------------- |
| Nginx      | 80   | `http://localhost`                 |
| SvelteKit  | 3001 | `http://localhost:3001` (internal) |
| Backend    | 3000 | `http://localhost:3000` (internal) |
| PostgreSQL | 5432 | -                                  |
| Redis      | 6379 | -                                  |

---

## Approval Checklist

- [ ] **PART 1**: Directory rename plan understood
- [ ] **PART 2**: Production Docker setup reviewed
- [ ] **PART 3**: Verification steps clear
- [ ] All 9 file modifications reviewed
- [ ] All 3 new files reviewed
- [ ] Backup strategy confirmed
- [ ] Rollback plan understood

---

**Document Version**: 3.0.0
**Last Updated**: 2026-01-06
**Architecture**: Option 1 - Separate Containers (Best Practice)
