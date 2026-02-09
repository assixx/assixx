# Before Starting Development

> **Time Required:** ~3 minutes (including TypeScript check)
> **Primary Method:** A single command runs all checks!

## MANDATORY: Always run this one command

```bash
# Runs ALL checks (including TypeScript check!)
/home/scs/projects/Assixx/scripts/dev-status.sh
```

**The script automatically checks:**

- Docker Container Status
- API Health Check
- Git Status
- **TypeScript Check** (NEW — now runs automatically!)
- Current Phase Info

# - Unit Tests (Commented out — no longer run automatically)

**If there are problems:**

```bash
# Fix TypeScript errors
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

# Restart Docker
cd /home/scs/projects/Assixx/docker && docker-compose down && docker-compose up -d
```

## Docker Development (Standard)

### Essential Checks

```bash
# Working Directory
cd /home/scs/projects/Assixx/docker

# Container Status & Health
docker-compose ps
curl -s http://localhost:3000/health | jq '.'

# Code Quality Check — DON'T FORGET! This command is CRITICAL!
docker exec assixx-backend pnpm run type-check

# If TypeScript errors occur:
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix"
```

### Expected Output

**Container Status:**

```
NAME                     STATUS              PORTS
assixx-backend          Up X minutes        0.0.0.0:3000->3000/tcp
assixx-redis            Up X minutes        6379/tcp
```

**Health Check:**

```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.456,
  "environment": "dev"
}
```

## Troubleshooting

### Containers not started

```bash
cd /home/scs/projects/Assixx/docker
docker-compose down && docker-compose up -d
docker-compose logs -f  # Check logs
```

### TypeScript Build Errors

```bash
# Rebuild container
docker-compose build --no-cache backend
docker-compose up -d
```

## Additional Commands

### Code Quality

```bash
# Fix everything automatically (Format -> Lint -> TypeCheck)
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

# Individual checks
docker exec assixx-backend pnpm run format       # Prettier
docker exec assixx-backend pnpm run lint:fix     # ESLint
docker exec assixx-backend pnpm run type-check   # TypeScript
```

### Git Workflow

```bash
git status
git log --oneline -5
git branch --show-current
```

## Important Notes

- **Working Directory** for Docker commands: `/home/scs/projects/Assixx/docker`
- **Container Name**: `assixx-backend` (not docker-backend-1)
- **PostgreSQL Port**: 5432

---

**Last updated:** 2025-07-18 — dev-status.sh now runs TypeScript check automatically!
