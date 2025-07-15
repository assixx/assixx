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
docker exec docker-backend-1 pnpm run typecheck

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
docker exec docker-backend-1 pnpm run build:ts

# Type-Checking im Container (inkl. Test-Dateien mit 56 bekannten Errors)
docker exec assixx-backend pnpm run type-check

# HINWEIS: Die 56 TypeScript Errors in Test-Dateien sind bekannt und können für v0.1.0 ignoriert werden.
# Diese betreffen nur Test-Code, nicht den Produktionscode.

# ESLint im Container
docker exec assixx-backend pnpm run lint:ts

# Auto-Fix mit ESLint (EMPFOHLEN nach Errors)
docker exec assixx-backend pnpm run lint:fix

# Code mit Prettier formatieren
docker exec assixx-backend pnpm run format
```

#### 💻 Lokale Version:

```bash
# Ins Projekt-Root wechseln
cd /home/scs/projects/Assixx

# TypeScript zu JavaScript kompilieren (Frontend & Backend)
pnpm run build:ts

# TypeScript Type-Checking ohne Kompilierung
pnpm run type-check

# ESLint auf alle .ts Dateien ausführen
pnpm run lint:ts

# Auto-Fix mit ESLint (EMPFOHLEN nach Errors)
pnpm run lint:fix

# Code-Formatierung mit Prettier
pnpm run format
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
cd backend && pnpm dev &

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

# pnpm Version im Container
docker exec assixx-backend pnpm --version

# TypeScript Version im Container
docker exec assixx-backend npx tsc --version

# MySQL Version prüfen
docker exec assixx-mysql mysql --version

# Security Audit im Container
docker exec assixx-backend pnpm audit --audit-level=high
```

#### 💻 Lokale Version:

```bash
# Node.js Version prüfen (sollte >= 18.x sein)
node --version

# pnpm Version prüfen
pnpm --version

# TypeScript Version prüfen
npx tsc --version

# Veraltete Dependencies prüfen
pnpm outdated

# MySQL Connection Test
mysql -u root -p -e "SELECT VERSION();" 2>/dev/null || echo "MySQL nicht erreichbar"

# Kritische Security Updates prüfen
pnpm audit --audit-level=high
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
docker exec assixx-backend sh -c "cd frontend && pnpm run build"

# Dist-Ordner prüfen
docker exec assixx-backend ls -la frontend/dist/
```

#### 💻 Lokale Version:

```bash
# Frontend Build erstellen
cd frontend && pnpm run build

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
pnpm run build:ts
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

## 🔧 Code-Formatierung & Auto-Fixes (NEU!)

### 🐳 Docker Auto-Fix Befehle:

```bash
# ESLint Auto-Fix für alle Dateien (EMPFOHLEN)
docker exec assixx-backend pnpm run lint:fix

# Nur TypeScript Dateien mit ESLint fixen
docker exec assixx-backend pnpm exec eslint backend/src/**/*.ts --fix

# Prettier für alle Dateien formatieren
docker exec assixx-backend pnpm run format

# Prettier nur prüfen (ohne Änderungen)
docker exec assixx-backend pnpm run format:check
```

### 💻 Lokale Auto-Fix Befehle:

```bash
# ESLint Auto-Fix für alle Dateien
pnpm run lint:fix

# Nur TypeScript Dateien fixen
pnpm exec eslint backend/src/**/*.ts --fix

# Prettier formatieren
pnpm run format

# Prettier Check
pnpm run format:check
```

### ✅ Empfohlene Reihenfolge:

1. Erst `pnpm run format` für Code-Formatierung
2. Dann `pnpm run lint:fix` für ESLint-Regeln
3. Abschließend `pnpm run type-check` für TypeScript-Prüfung

### 🚀 Kombinierter Befehl (EMPFOHLEN):

```bash
# Alles in einem Befehl - Format, Lint und TypeCheck
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"
```

## ⚡ Quick Start (Alle Checks in einem Befehl)

### 🐳 Docker Quick Start:

```bash
# Docker Status und alle wichtigen Checks
docker-compose ps && \
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check" && \
curl -s http://localhost:3000/health | jq '.' && \
docker logs assixx-backend --tail=10 && \
git status
```

### 💻 Lokale Quick Start:

```bash
# One-Liner für alle Checks
cd /home/scs/projects/Assixx && \
pnpm run build:ts && \
pnpm run type-check && \
pnpm run lint:ts && \
curl -s http://localhost:3000/health && \
pnpm outdated && \
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
