# 🚀 Before Starting Development

> **Zeitaufwand:** ~3 Minuten (inklusive TypeScript Check)
> **Primäre Methode:** Ein einziger Befehl führt alle Checks aus!

## ⚠️ PFLICHT: Diesen einen Befehl IMMER ausführen

```bash
# Führt ALLE Checks aus (inklusive TypeScript Check!)
/home/scs/projects/Assixx/scripts/dev-status.sh
```

**Das Script prüft automatisch:**

- ✅ Docker Container Status
- ✅ API Health Check
- ✅ Git Status
- ✅ **TypeScript Check** (NEU - wird jetzt automatisch ausgeführt!)
- ✅ Aktuelle Phase Info

# - ✅ Unit Tests (Auskommentiert - werden nicht mehr automatisch ausgeführt)

**Bei Problemen:**

```bash
# TypeScript Errors fixen
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

# Docker neu starten
cd /home/scs/projects/Assixx/docker && docker-compose down && docker-compose up -d
```

## 🐳 Docker Development (Standard)

### Essential Checks

```bash
# Working Directory
cd /home/scs/projects/Assixx/docker

# Container Status & Health
docker-compose ps
curl -s http://localhost:3000/health | jq '.'

# Code Quality Check - NICHT VERGESSEN! Dieser Befehl ist KRITISCH!
docker exec assixx-backend pnpm run type-check

# Bei TypeScript Errors:
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix"
```

### Erwartete Ausgaben

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

- **Working Directory** für Docker-Befehle: `/home/scs/projects/Assixx/docker`
- **Container-Name**: `assixx-backend` (nicht docker-backend-1)
- **PostgreSQL Port**: 5432

---

**Zuletzt aktualisiert:** 18.07.2025 - dev-status.sh führt jetzt TypeScript Check automatisch aus!
