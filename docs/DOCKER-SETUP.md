# Docker Setup

> **Last Updated:** 2026-02-11

---

## Prerequisites

| Tool           | Version   | Install                                                                        |
| -------------- | --------- | ------------------------------------------------------------------------------ |
| Docker         | 24+       | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)              |
| Docker Compose | 2.20+     | Included with Docker Desktop                                                   |
| pnpm           | 10+       | `npm install -g pnpm@10`                                                       |
| Node.js        | 22+ (LTS) | [nodejs.org](https://nodejs.org)                                               |
| Doppler CLI    | Optional  | [docs.doppler.com/docs/install-cli](https://docs.doppler.com/docs/install-cli) |

**System requirements:** 4 GB RAM, 10 GB disk space.

---

## Quick Start (Automated)

```bash
git clone https://github.com/assixx-dev/Assixx.git
cd Assixx/docker

# With Doppler (team members):
doppler run -- ./docker-init.sh

# Without Doppler (external contributors):
./docker-init.sh --local
```

The script handles volumes, containers, migrations, seeds, and dependency setup.
After it finishes, start the frontend dev server:

```bash
cd .. && pnpm run dev:svelte
```

Open: **http://localhost:5173**

---

## Manual Setup (Step-by-Step)

Use this if the automated script fails or you prefer manual control.

### 1. Clone and install dependencies

```bash
git clone https://github.com/assixx-dev/Assixx.git
cd Assixx
pnpm install
pnpm --filter @assixx/shared build
```

### 2. Create Docker volumes

PostgreSQL and Redis volumes are declared as `external: true` in docker-compose.yml.
They must be created once before the first start:

```bash
docker volume create assixx_postgres_data
docker volume create assixx_redis_data
```

### 3. Configure secrets

**Option A: Doppler (recommended for team members)**

```bash
# One-time setup:
doppler login
doppler setup    # Select project: assixx, config: dev
```

**Option B: Local .env (external contributors)**

```bash
cd docker
cp .env.example .env
# Edit .env and replace ALL "CHANGE_ME" placeholders!
# Generate secrets: openssl rand -base64 32
```

### 4. Start containers

```bash
cd docker

# With Doppler:
doppler run -- docker-compose up -d

# With local .env:
docker-compose up -d
```

### 5. Verify health

```bash
# PostgreSQL
docker exec assixx-postgres pg_isready -U assixx_user -d assixx

# Backend API
curl -s http://localhost:3000/health | jq .
```

Expected: `{ "status": "ok", ... }`

### 6. Run migrations and seeds

```bash
cd /path/to/Assixx

# With Doppler:
doppler run -- ./scripts/run-migrations.sh up
doppler run -- ./scripts/run-seeds.sh

# With local .env (source it first):
set -a && source docker/.env && set +a
./scripts/run-migrations.sh up
./scripts/run-seeds.sh
```

### 7. Start frontend dev server

```bash
pnpm run dev:svelte
```

Open: **http://localhost:5173**

---

## URLs

### Development

| URL                            | Purpose                        |
| ------------------------------ | ------------------------------ |
| `http://localhost:5173`        | SvelteKit Dev Server (HMR)     |
| `http://localhost:3000`        | Backend API (NestJS + Fastify) |
| `http://localhost:3000/health` | Backend health check           |

### Production (with `--profile production`)

| URL                       | Purpose                                |
| ------------------------- | -------------------------------------- |
| `http://localhost`        | App via Nginx (reverse proxy)          |
| `http://localhost/health` | Health check via Nginx                 |
| `http://localhost:3001`   | SvelteKit SSR (direct, bypasses Nginx) |

---

## Common Commands

```bash
cd docker

# Status
doppler run -- docker-compose ps

# Logs
docker logs -f assixx-backend

# Restart backend (after code changes)
doppler run -- docker-compose restart backend

# Stop all
doppler run -- docker-compose down

# Production mode (includes SvelteKit SSR + Nginx)
doppler run -- docker-compose --profile production up -d

# Rebuild frontend for production
doppler run -- docker-compose --profile production build frontend
doppler run -- docker-compose --profile production up -d

# Database console
docker exec -it assixx-postgres psql -U assixx_user -d assixx
```

---

## Containers

| Container                | Port | Purpose                |
| ------------------------ | ---- | ---------------------- |
| `assixx-postgres`        | 5432 | PostgreSQL 17 Database |
| `assixx-redis`           | 6379 | Redis 7 Cache          |
| `assixx-backend`         | 3000 | NestJS + Fastify API   |
| `assixx-deletion-worker` | 3002 | Background worker      |
| `assixx-frontend`        | 3001 | SvelteKit SSR (prod)   |
| `assixx-nginx`           | 80   | Reverse Proxy (prod)   |

**Note:** `assixx-frontend` and `assixx-nginx` only start with `--profile production`.

---

## Troubleshooting

### Container won't start

```bash
docker logs assixx-backend --tail 50
doppler run -- docker-compose down && doppler run -- docker-compose up -d
```

### Port already in use

```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection error

```bash
# Verify PostgreSQL is running
docker exec assixx-postgres pg_isready -U assixx_user -d assixx

# Check backend logs for connection errors
docker logs assixx-backend --tail 20
```

### Rate limit (429 Too Many Requests)

```bash
# Flush Redis rate-limit keys
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

### Nuclear option (rebuild everything)

```bash
cd docker
doppler run -- docker-compose down
doppler run -- docker-compose build --no-cache
doppler run -- docker-compose up -d
```

---

## Architecture

```
Development:
  Browser --> SvelteKit Dev Server (:5173)  [HMR]
  Browser --> Backend API (:3000)

Production:
  Browser --> Nginx (:80) --+--> /api/*     --> Backend (:3000)
                            +--> /uploads/* --> Backend (:3000)
                            +--> /health    --> Backend (:3000)
                            +--> /chat-ws   --> Backend (:3000) [WebSocket]
                            +--> /*         --> SvelteKit (:3001) [SSR]
```

---

## Related Documentation

- [PRODUCTION-AND-DEVELOPMENT-TESTING.md](./PRODUCTION-AND-DEVELOPMENT-TESTING.md) — Full testing guide
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) — Migration workflow
- [BEFORE-STARTING-DEV.md](./BEFORE-STARTING-DEV.md) — Daily dev checks
