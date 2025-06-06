# 🚀 Before Starting Development - Pflicht-Checkliste

> **WICHTIG:** Diese Checkliste MUSS bei jedem Entwicklungsstart durchgeführt werden!  
> **Zeitaufwand:** ~5-10 Minuten

## 🐳 Docker Status prüfen (NEUE PRIORITÄT!)

> **INFO:** Wenn Docker verwendet wird, sind viele der lokalen Checks nicht notwendig!

```bash
# Working Directory ist WICHTIG!
cd /home/scs/projects/Assixx/docker

# Docker Compose Services prüfen
docker-compose ps

# Backend Logs prüfen (sollten keine Fehler zeigen)
docker-compose logs backend --tail=50

# MySQL Logs prüfen (sollte stabil laufen)
docker-compose logs mysql --tail=20

# Health Check über Docker
docker exec docker-backend-1 curl -s http://localhost:3000/health | jq '.'

# TypeScript Build im Docker Container prüfen
docker exec docker-backend-1 npm run typecheck

# ODER nutze das neue Status-Script (empfohlen):
/home/scs/projects/Assixx/scripts/dev-status.sh
```

### ✅ Erwartete Docker Ausgabe:

```
NAME                COMMAND                  SERVICE             STATUS              PORTS
docker-backend-1    "docker-entrypoint.s…"   backend             Up 2 minutes        0.0.0.0:3000->3000/tcp
docker-mysql-1      "docker-entrypoint.s…"   mysql               Up 2 minutes        0.0.0.0:3306->3306/tcp, 33060/tcp
```

## ✅ Development Start Checkliste

> **HINWEIS:** Bei Docker-Nutzung können viele dieser Checks mit `docker exec` ausgeführt werden!

### 1️⃣ TypeScript Build & Checks (2-3 Min)

#### 🐳 Docker Version:
```bash
# TypeScript Build im Container
docker exec docker-backend-1 npm run build:ts

# Type-Checking im Container
docker exec docker-backend-1 npm run typecheck

# ESLint im Container
docker exec docker-backend-1 npm run lint:ts

# Auto-Fix mit ESLint (EMPFOHLEN nach Errors)
docker exec docker-backend-1 npm run lint:fix

# Code mit Prettier formatieren
docker exec docker-backend-1 npm run format
```

#### 💻 Lokale Version:
```bash
# Ins Projekt-Root wechseln
cd /home/scs/projects/Assixx

# TypeScript zu JavaScript kompilieren (Frontend & Backend)
npm run build:ts

# TypeScript Type-Checking ohne Kompilierung
npm run typecheck

# ESLint auf alle .ts Dateien ausführen
npm run lint:ts

# Code-Formatierung mit Prettier
npm run format:ts
```

### 2️⃣ API & System Health Checks (1-2 Min)

#### 🐳 Docker Version:
```bash
# Container Status prüfen
docker-compose ps

# Health Check (von außen)
curl -s http://localhost:3000/health | jq '.'

# API Status Check
curl -s http://localhost:3000/api/status | jq '.'

# Logs prüfen für Fehler
docker logs assixx-backend --tail=20
```

#### 💻 Lokale Version:
```bash
# Backend starten (falls nicht läuft)
cd backend && npm run dev &

# Warten bis Server ready (3 Sekunden)
sleep 3

# Health Check
curl -s http://localhost:3000/health | jq '.'

# API Status Check
curl -s http://localhost:3000/api/status | jq '.'

# WebSocket Test
curl -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:3000/chat-ws
```

### 3️⃣ Dependencies & Updates Check (2-3 Min)

#### 🐳 Docker Version:
```bash
# Node.js Version im Container
docker exec assixx-backend node --version

# NPM Version im Container
docker exec assixx-backend npm --version

# TypeScript Version im Container
docker exec assixx-backend npx tsc --version

# MySQL Version prüfen
docker exec assixx-mysql mysql --version

# Security Audit im Container
docker exec assixx-backend npm audit --audit-level=high
```

#### 💻 Lokale Version:
```bash
# Node.js Version prüfen (sollte >= 18.x sein)
node --version

# NPM Version prüfen
npm --version

# TypeScript Version prüfen
npx tsc --version

# Veraltete Dependencies prüfen
npm outdated

# MySQL Connection Test
mysql -u root -p -e "SELECT VERSION();" 2>/dev/null || echo "MySQL nicht erreichbar"

# Kritische Security Updates prüfen
npm audit --audit-level=high
```

### 4️⃣ Projekt-Status Review (1 Min)

```bash
# Git Status
git status

# Letzte Commits anzeigen
git log --oneline -5

# Aktuelle Branch
git branch --show-current

# Uncommitted Changes?
git diff --stat
```

### 5️⃣ Frontend Build Check (1-2 Min)

#### 🐳 Docker Version:
```bash
# Frontend Build im Container
docker exec assixx-backend sh -c "cd frontend && npm run build"

# Dist-Ordner prüfen
docker exec assixx-backend ls -la frontend/dist/
```

#### 💻 Lokale Version:
```bash
# Frontend Build erstellen
cd frontend && npm run build

# Dist-Ordner prüfen
ls -la dist/

# Zurück zum Root
cd ..
```

## 🔴 Bei Fehlern:

### Docker Container nicht gestartet

```bash
# Container neu starten
docker-compose down
docker-compose up -d

# Logs prüfen
docker-compose logs -f
```

### TypeScript Build Fehler

#### 🐳 Docker:
```bash
# Container neu builden
docker-compose build --no-cache backend
docker-compose up -d
```

#### 💻 Lokal:
```bash
# Cache löschen und neu builden
rm -rf node_modules/.cache
npm run build:ts
```

### MySQL Connection Fehler

#### 🐳 Docker:
```bash
# MySQL Container prüfen
docker logs assixx-mysql
docker-compose restart mysql
```

#### 💻 Lokal:
```bash
# MySQL Service starten
sudo systemctl start mysql
# oder
sudo service mysql start
```

### Port 3000 bereits belegt

```bash
# Prozess auf Port 3000 finden und beenden
lsof -i :3000
kill -9 <PID>

# Oder Docker Container stoppen
docker-compose down
```

## 📊 Erwartete Ausgaben

### ✅ Health Check sollte zeigen:

```json
{
  "status": "ok",
  "timestamp": "2025-05-31T...",
  "uptime": 123.456,
  "environment": "development"
}
```

### ✅ API Status sollte zeigen:

```json
{
  "status": "ok",
  "version": "0.0.2",
  "environment": "development"
}
```

## ⚡ Quick Start (Alle Checks in einem Befehl)

### 🐳 Docker Quick Start:
```bash
# Docker Status und alle wichtigen Checks
docker-compose ps && \
docker exec assixx-backend npm run typecheck && \
docker exec assixx-backend npm run lint:ts && \
curl -s http://localhost:3000/health | jq '.' && \
docker logs assixx-backend --tail=10 && \
git status
```

### 💻 Lokale Quick Start:
```bash
# One-Liner für alle Checks
cd /home/scs/projects/Assixx && \
npm run build:ts && \
npm run typecheck && \
npm run lint:ts && \
curl -s http://localhost:3000/health && \
npm outdated && \
git status
```

## 📝 Notizen

### 🐳 Docker-spezifisch:
- **Docker ist jetzt die primäre Entwicklungsmethode!**
- Bei Docker-Nutzung sind viele lokale Checks nicht notwendig
- Container-Logs regelmäßig prüfen: `docker-compose logs -f`
- Bei Problemen: `docker-compose down && docker-compose up -d --build`

### 💻 Allgemein:
- Bei **lint:ts Warnings**: Nicht kritisch, aber sollten zeitnah behoben werden
- Bei **outdated packages**: Major Updates genau prüfen (Breaking Changes)
- Bei **TypeScript Errors**: MÜSSEN vor Entwicklung behoben werden

---

**Zuletzt aktualisiert:** 06.06.2025  
**Wichtige Änderungen:** 
- Docker ist jetzt die primäre Entwicklungsmethode!
- NEU: Code-Formatierung & Auto-Fix Befehle hinzugefügt
- ESLint v9 Konfiguration wird jetzt unterstützt
**Zweck:** Sicherstellen dass Entwicklungsumgebung stabil ist bevor neue Features entwickelt werden
