# 🚀 Before Starting Development - Pflicht-Checkliste

> **WICHTIG:** Diese Checkliste MUSS bei jedem Entwicklungsstart durchgeführt werden!  
> **Zeitaufwand:** ~5-10 Minuten

## ✅ Development Start Checkliste

### 1️⃣ TypeScript Build & Checks (2-3 Min)

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

```bash
# Frontend Build erstellen
cd frontend && npm run build

# Dist-Ordner prüfen
ls -la dist/

# Zurück zum Root
cd ..
```

## 🔴 Bei Fehlern:

### TypeScript Build Fehler
```bash
# Cache löschen und neu builden
rm -rf node_modules/.cache
npm run build:ts
```

### MySQL Connection Fehler
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

- Bei **lint:ts Warnings**: Nicht kritisch, aber sollten zeitnah behoben werden
- Bei **outdated packages**: Major Updates genau prüfen (Breaking Changes)
- Bei **TypeScript Errors**: MÜSSEN vor Entwicklung behoben werden

---

**Zuletzt aktualisiert:** 31.05.2025  
**Zweck:** Sicherstellen dass Entwicklungsumgebung stabil ist bevor neue Features entwickelt werden