# Assixx - Production & Development Testing Guide

> Comprehensive guide for testing SvelteKit frontend with NestJS backend in both development and production environments.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Port Reference](#port-reference)
3. [Container Reference](#container-reference)
4. [Development Mode](#development-mode)
5. [Production Mode](#production-mode)
6. [Testing Endpoints](#testing-endpoints)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference Commands](#quick-reference-commands)

---

## Architecture Overview

### Development Mode (Default)

```
Browser → Backend (:3000) → Serves API only
Browser → SvelteKit Dev Server (:5173) → Hot reload, development
```

### Production Mode (with --profile production)

```
Browser → Nginx (:80) ─┬→ /api/*     → Backend (:3000)
                       ├→ /uploads/* → Backend (:3000)
                       ├→ /health    → Backend (:3000)
                       ├→ /chat-ws   → Backend (:3000) [WebSocket]
                       └→ /*         → SvelteKit (:3001)
```

---

## Port Reference

| Port     | Service         | Mode        | Description                           |
| -------- | --------------- | ----------- | ------------------------------------- |
| **80**   | Nginx           | Production  | Reverse Proxy - Main entry point      |
| **3000** | NestJS Backend  | Both        | API Server (Fastify)                  |
| **3001** | SvelteKit       | Production  | SSR Frontend (adapter-node)           |
| **3002** | Deletion Worker | Both        | Background worker for tenant deletion |
| **5173** | Vite Dev Server | Development | SvelteKit with HMR                    |
| **5432** | PostgreSQL      | Both        | Database                              |
| **6379** | Redis           | Both        | Cache & Rate Limiting (internal)      |

---

## Container Reference

| Container Name           | Image                  | Purpose                | Ports           |
| ------------------------ | ---------------------- | ---------------------- | --------------- |
| `assixx-backend`         | `assixx-backend:dev`   | NestJS + Fastify API   | 3000            |
| `assixx-frontend`        | `assixx-frontend:prod` | SvelteKit SSR          | 3001            |
| `assixx-nginx`           | `nginx:alpine`         | Reverse Proxy          | 80              |
| `assixx-postgres`        | `postgres:17-alpine`   | PostgreSQL Database    | 5432            |
| `assixx-redis`           | `redis:7-alpine`       | Redis Cache            | 6379 (internal) |
| `assixx-deletion-worker` | `assixx-backend:dev`   | Tenant Deletion Worker | 3002            |

---

## Development Mode

### Start Development Environment

```bash
cd /home/scs/projects/Assixx/docker

# Start core services (backend, postgres, redis, deletion-worker)
docker-compose up -d

# Check status
docker-compose ps
```

### Start SvelteKit Dev Server (with HMR)

```bash
# Option 1: From host (recommended for development)
cd /home/scs/projects/Assixx/frontend
pnpm run dev

# Option 2: Via pnpm workspace from root
cd /home/scs/projects/Assixx
pnpm run dev:svelte
```

### Development URLs

| URL                                | What it serves                     |
| ---------------------------------- | ---------------------------------- |
| `http://localhost:5173`            | SvelteKit Dev Server (HMR enabled) |
| `http://localhost:5173/login`      | Login page with hot reload         |
| `http://localhost:3000/api/v2/...` | Backend API directly               |
| `http://localhost:3000/health`     | Backend health check               |

### Development Workflow

```bash
# 1. Start Docker containers
cd /home/scs/projects/Assixx/docker
docker-compose up -d

# 2. Verify backend is healthy
curl http://localhost:3000/health

# 3. Start SvelteKit dev server (separate terminal)
cd /home/scs/projects/Assixx/frontend
pnpm run dev

# 4. Open browser
# http://localhost:5173
```

---

## Production Mode

### Build & Start Production Environment

```bash
cd /home/scs/projects/Assixx/docker

# Build frontend image (only needed after code changes)
docker-compose --profile production build frontend

# Start all services including frontend + nginx
docker-compose --profile production up -d

# Check status
docker-compose --profile production ps
```

### Stop Production Services

```bash
cd /home/scs/projects/Assixx/docker

# Stop only frontend + nginx (keep backend running)
docker-compose --profile production down frontend nginx

# Stop everything
docker-compose --profile production down
```

### Production URLs

| URL                                  | What it serves   | Route             |
| ------------------------------------ | ---------------- | ----------------- |
| `http://localhost`                   | Landing page     | Nginx → SvelteKit |
| `http://localhost/login`             | Login page       | Nginx → SvelteKit |
| `http://localhost/api/v2/auth/login` | Login API        | Nginx → Backend   |
| `http://localhost/health`            | Backend health   | Nginx → Backend   |
| `http://localhost:3001`              | SvelteKit direct | Bypasses Nginx    |
| `http://localhost:3000`              | Backend direct   | Bypasses Nginx    |

### Production Workflow

```bash
# 1. Build frontend image
cd /home/scs/projects/Assixx/docker
docker-compose --profile production build frontend

# 2. Start all production services
docker-compose --profile production up -d

# 3. Wait for health checks (10-15 seconds)
sleep 15

# 4. Verify all containers are healthy
docker-compose --profile production ps

# 5. Test endpoints
curl http://localhost/health          # Backend via Nginx
curl http://localhost                  # Frontend via Nginx
curl http://localhost/login            # Login page via Nginx

# 6. Open browser
# http://localhost
```

---

## Testing Endpoints

### Health Checks

```bash
# Backend health (direct)
curl -s http://localhost:3000/health | jq

# Backend health (via Nginx - production)
curl -s http://localhost/health | jq

# Frontend health (direct)
curl -s http://localhost:3001/health | jq

# All health checks at once
echo "=== Backend ===" && curl -s http://localhost:3000/health | jq
echo "=== Frontend ===" && curl -s http://localhost:3001/health | jq
echo "=== Via Nginx ===" && curl -s http://localhost/health | jq
```

### Page Tests

```bash
# Landing page
curl -s http://localhost | head -20

# Login page
curl -s http://localhost/login | head -20

# Check response headers (via Nginx)
curl -sI http://localhost/login | head -10

# Check response headers (direct to SvelteKit)
curl -sI http://localhost:3001/login | head -10
```

### API Tests

```bash
# API via Nginx (production)
curl -s http://localhost/api/v2/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# API direct (development)
curl -s http://localhost:3000/api/v2/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

---

## Troubleshooting

### Check Container Logs

```bash
# All logs
docker-compose --profile production logs

# Specific container logs
docker logs assixx-frontend --tail 50
docker logs assixx-nginx --tail 50
docker logs assixx-backend --tail 50

# Follow logs in real-time
docker logs -f assixx-frontend
docker logs -f assixx-nginx
```

### Common Issues

#### Frontend Container Restarting

```bash
# Check logs for errors
docker logs assixx-frontend --tail 100

# Common cause: Missing dependencies
# Solution: Rebuild with no cache
docker-compose --profile production build --no-cache frontend
```

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :3001
lsof -i :80

# Kill process
kill -9 <PID>

# Or use the free-port script
./scripts/free-port.sh 3000
```

#### Nginx Can't Connect to Frontend

```bash
# Check if frontend container is running
docker-compose --profile production ps

# Check frontend health
curl http://localhost:3001/health

# Restart frontend
docker-compose --profile production restart frontend
```

#### Database Connection Issues

```bash
# Check postgres is healthy
docker exec assixx-postgres pg_isready -U assixx_user -d assixx

# Check backend can connect
docker logs assixx-backend --tail 20 | grep -i "database\|postgres\|connection"
```

### Rebuild Everything

```bash
cd /home/scs/projects/Assixx/docker

# Nuclear option - rebuild everything
docker-compose --profile production down
docker-compose --profile production build --no-cache
docker-compose --profile production up -d
```

---

## Quick Reference Commands

### Development

```bash
# Start
docker-compose up -d && cd ../frontend && pnpm run dev

# Stop
docker-compose down

# Restart backend
docker-compose restart backend

# View backend logs
docker logs -f assixx-backend
```

### Production

```bash
# Build & Start
docker-compose --profile production build frontend && \
docker-compose --profile production up -d

# Stop
docker-compose --profile production down

# Restart all
docker-compose --profile production restart

# View all logs
docker-compose --profile production logs -f

# Check health
docker-compose --profile production ps
```

### Status Check Script

```bash
#!/bin/bash
# Save as: scripts/check-production.sh

echo "=== Container Status ==="
docker-compose --profile production ps

echo ""
echo "=== Health Checks ==="
echo -n "Backend:  " && curl -s http://localhost:3000/health | jq -r '.status'
echo -n "Frontend: " && curl -s http://localhost:3001/health | jq -r '.status'
echo -n "Nginx:    " && curl -sI http://localhost/health | head -1

echo ""
echo "=== URLs ==="
echo "Landing:  http://localhost"
echo "Login:    http://localhost/login"
echo "API:      http://localhost/api/v2/"
```

---

## File References

| File                                    | Purpose                                        |
| --------------------------------------- | ---------------------------------------------- |
| `docker/docker-compose.yml`             | Docker Compose configuration                   |
| `docker/Dockerfile.frontend`            | SvelteKit production build (uses pnpm deploy)  |
| `docker/Dockerfile.dev`                 | Backend development build                      |
| `docker/nginx/nginx.conf`               | Nginx reverse proxy config                     |
| `frontend/svelte.config.js`             | SvelteKit adapter-node config                  |
| `frontend/src/routes/health/+server.ts` | Frontend health endpoint                       |
| `.npmrc`                                | pnpm configuration (inject-workspace-packages) |
| `pnpm-lock.yaml`                        | Locked dependency versions                     |

---

## Version Information (as of 2026-01-06)

| Component  | Version     | Notes                       |
| ---------- | ----------- | --------------------------- |
| Node.js    | 24.13.0 LTS | Alpine image                |
| PostgreSQL | 17.7        | Alpine image                |
| Nginx      | 1.29.4      | Alpine image                |
| Redis      | 7.4.7       | Alpine image                |
| NestJS     | 11.1.11     | Latest                      |
| pnpm       | 10.27.0     | Modern deploy (no --legacy) |
| SvelteKit  | 5.x         | adapter-node for SSR        |

### pnpm Configuration

The project uses modern pnpm v10+ with workspace injection:

```ini
# .npmrc
engine-strict=true
save-exact=true
ignore-scripts=true
inject-workspace-packages=true  # Enables modern pnpm deploy
```

This allows `pnpm deploy` without the `--legacy` flag for cleaner production builds.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser                                                        │
│      │                                                           │
│      ▼                                                           │
│   ┌──────────────────┐                                          │
│   │   Nginx (:80)    │                                          │
│   │   Reverse Proxy  │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│     ┌──────┴──────┬──────────────┐                              │
│     │             │              │                               │
│     ▼             ▼              ▼                               │
│  /api/*      /uploads/*    /* (all other)                       │
│  /health     /chat-ws                                            │
│     │             │              │                               │
│     ▼             │              ▼                               │
│ ┌─────────────────┴───┐    ┌─────────────────┐                  │
│ │  Backend (:3000)    │    │ Frontend (:3001)│                  │
│ │  NestJS + Fastify   │    │ SvelteKit SSR   │                  │
│ └─────────┬───────────┘    └─────────────────┘                  │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     ▼           ▼                                                │
│ ┌────────┐  ┌────────┐                                          │
│ │Postgres│  │ Redis  │                                          │
│ │ (:5432)│  │ (:6379)│                                          │
│ └────────┘  └────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser ──────┬──────────────────────┐                        │
│                 │                      │                         │
│                 ▼                      ▼                         │
│   ┌─────────────────────┐    ┌─────────────────┐                │
│   │  Backend (:3000)    │    │ Vite Dev (:5173)│                │
│   │  NestJS + Fastify   │    │ SvelteKit HMR   │                │
│   └─────────┬───────────┘    └─────────────────┘                │
│             │                                                    │
│       ┌─────┴─────┐                                             │
│       ▼           ▼                                              │
│   ┌────────┐  ┌────────┐                                        │
│   │Postgres│  │ Redis  │                                        │
│   │ (:5432)│  │ (:6379)│                                        │
│   └────────┘  └────────┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Last Updated:** 2026-01-06
**Author:** Claude Code
**Version:** 1.1.0 (Added version info, pnpm config section, modern deploy)
