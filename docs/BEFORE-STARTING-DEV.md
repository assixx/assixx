# Before Starting Development

> **Time Required:** ~1 minute
> **Ziel:** Sicherstellen, dass Docker läuft und Code Quality stimmt.

## Essential Checks

```bash
# Working Directory
cd /home/scs/projects/Assixx/docker

# Container Status & Health
doppler run -- docker-compose ps
curl -s http://localhost:3000/health | jq '.'

# Code Quality Check
docker exec assixx-backend pnpm run type-check

# If TypeScript errors occur:
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"
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



## Important Notes

- **Working Directory** for Docker commands: `/home/scs/projects/Assixx/docker`
- **Container Name**: `assixx-backend` (not docker-backend-1)
- **PostgreSQL Port**: 5432

---

**Last updated:** 2026-02-17
