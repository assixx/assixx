# 🚀 Before Starting Development

> **Zeitaufwand:** ~2-3 Minuten mit Status-Script  
> **Primäre Methode:** Docker (Empfohlen)

## ⚡ Quick Start (Empfohlen)

```bash
# 1. Status-Script ausführen (prüft alles automatisch)
/home/scs/projects/Assixx/scripts/dev-status.sh

# 2. Bei Fehlern: Code automatisch fixen
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

# 3. Git Status prüfen
git status
```

## 🐳 Docker Development (Standard)

### Essential Checks

```bash
# Working Directory
cd /home/scs/projects/Assixx/docker

# Container Status & Health
docker-compose ps
curl -s http://localhost:3000/health | jq '.'

# Code Quality Check
docker exec assixx-backend pnpm run type-check

# Bei TypeScript Errors (außer den 56 bekannten Test-Errors):
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix"
```

### Erwartete Ausgaben

**Container Status:**

```
NAME                     STATUS              PORTS
assixx-backend          Up X minutes        0.0.0.0:3000->3000/tcp
assixx-mysql            Up X minutes        0.0.0.0:3307->3306/tcp
assixx-redis            Up X minutes        6379/tcp
```

**Health Check:**

```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123.456,
  "environment": "production"
}
```

## 🔴 Troubleshooting

### Container nicht gestartet

```bash
cd /home/scs/projects/Assixx/docker
docker-compose down && docker-compose up -d
docker-compose logs -f  # Logs prüfen
```

### TypeScript Build Fehler

```bash
# Container neu builden
docker-compose build --no-cache backend
docker-compose up -d
```

### MySQL Connection Fehler

```bash
docker logs assixx-mysql
docker-compose restart mysql
```

### Port 3000 bereits belegt

```bash
lsof -i :3000 && kill -9 <PID>
# oder
docker-compose down
```

## 📋 Zusätzliche Befehle

### Code Quality

```bash
# Alles automatisch fixen (Format → Lint → TypeCheck)
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

# Einzelne Checks
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

## 📝 Wichtige Hinweise

- **56 TypeScript Errors** in Test-Dateien sind bekannt und können ignoriert werden
- **Working Directory** für Docker-Befehle: `/home/scs/projects/Assixx/docker`
- **Container-Name**: `assixx-backend` (nicht docker-backend-1)
- **MySQL Port**: 3307 (nicht 3306)

---

**Zuletzt aktualisiert:** 17.07.2025
