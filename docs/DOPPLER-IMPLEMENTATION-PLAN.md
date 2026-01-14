# Doppler Implementation Plan

> Migration von .env zu Doppler SecretOps Platform

**Status:** ✅ PHASE 1-3 ABGESCHLOSSEN
**Erstellt:** 2026-01-13
**Abgeschlossen:** 2026-01-14
**Geschätzte Dauer:** 2-3 Stunden für Basis-Setup

---

## Inhaltsverzeichnis

1. [Warum Doppler](#1-warum-doppler)
2. [Architektur-Übersicht](#2-architektur-übersicht)
3. [Voraussetzungen](#3-voraussetzungen)
4. [Phase 1: Doppler Setup](#4-phase-1-doppler-setup)
5. [Phase 2: Secrets Migration](#5-phase-2-secrets-migration)
6. [Phase 3: Docker Integration](#6-phase-3-docker-integration)
7. [Phase 4: CI/CD Integration](#7-phase-4-cicd-integration)
8. [Phase 5: Cleanup & Verification](#8-phase-5-cleanup--verification)
9. [Access Control & Security](#9-access-control--security)
10. [Rollback Plan](#10-rollback-plan)
11. [Checkliste](#11-checkliste)

---

## 1. Warum Doppler

### Aktuelle Probleme mit .env

| Problem                 | Risiko                                   |
| ----------------------- | ---------------------------------------- |
| Secrets in .env Dateien | Können versehentlich committed werden    |
| Keine Audit Logs        | Wer hat wann was geändert? Unbekannt     |
| Kein Access Control     | Jeder mit Dateizugriff sieht alles       |
| Manuelle Rotation       | Secrets werden nie rotiert               |
| Environment Sync        | Dev/Staging/Prod manuell synchronisieren |

### Doppler Vorteile

| Feature               | Nutzen                        |
| --------------------- | ----------------------------- |
| Zentrales Dashboard   | Alle Secrets an einem Ort     |
| Granulare Permissions | Nur du hast vollen Zugriff    |
| Audit Trail           | Jede Änderung protokolliert   |
| Environment Configs   | dev, staging, prod getrennt   |
| CLI Integration       | `doppler run -- command`      |
| Service Tokens        | Sichere Docker/CI Integration |
| Secret Referencing    | DRY - Secrets wiederverwenden |
| Versioning & Rollback | Jede Version gespeichert      |

---

## 2. Architektur-Übersicht

### Vorher (Aktuell)

```
┌─────────────────────────────────────────────────────────┐
│                     HOST SYSTEM                          │
│  ┌─────────────────┐                                    │
│  │  docker/.env    │ ← Secrets im Dateisystem           │
│  └────────┬────────┘                                    │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Docker Compose                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
│  │  │ Backend │  │ Frontend│  │ Postgres│         │    │
│  │  │  .env   │  │  .env   │  │  .env   │         │    │
│  │  └─────────┘  └─────────┘  └─────────┘         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Nachher (Mit Doppler)

```
┌──────────────────────────────────────────────────────────┐
│                    DOPPLER CLOUD                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Project: assixx                                    │  │
│  │  ├── dev     (Development Secrets)                 │  │
│  │  ├── staging (Staging Secrets)                     │  │
│  │  └── prod    (Production Secrets)                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
              │
              │ Service Token (DOPPLER_TOKEN)
              ▼
┌──────────────────────────────────────────────────────────┐
│                     HOST SYSTEM                           │
│  ┌─────────────────┐                                     │
│  │ DOPPLER_TOKEN   │ ← Einziges Secret auf Host          │
│  │ (Environment)   │                                     │
│  └────────┬────────┘                                     │
│           │                                               │
│           ▼                                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Docker Compose                       │    │
│  │  ┌───────────────────────────────────────────┐   │    │
│  │  │  doppler run -- node dist/main.js         │   │    │
│  │  │  ↓                                         │   │    │
│  │  │  Secrets werden zur Laufzeit injiziert    │   │    │
│  │  └───────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Voraussetzungen

### System Requirements

- [ ] Docker läuft
- [ ] Internet-Zugang (Doppler ist cloud-basiert)
- [ ] Bash/Zsh Shell

### Aktuelle Secrets Inventar

Aus `SECRET-MANAGEMENT-PLAN.md`:

| Kategorie    | Secrets                                         | Anzahl  |
| ------------ | ----------------------------------------------- | ------- |
| **JWT**      | JWT_SECRET, JWT_REFRESH_SECRET                  | 2       |
| **Session**  | SESSION_SECRET                                  | 1       |
| **Database** | DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | 5       |
| **Redis**    | REDIS_HOST, REDIS_PORT, REDIS_PASSWORD          | 3       |
| **SMTP**     | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD  | 4       |
| **Sentry**   | SENTRY_DSN                                      | 1       |
| **Grafana**  | GF_SECURITY_ADMIN_PASSWORD                      | 1       |
| **App**      | NODE_ENV, PORT, API_PREFIX                      | 3       |
| **Total**    |                                                 | **~20** |

---

## 4. Phase 1: Doppler Setup

### 4.1 CLI Installation

```bash
# Linux (WSL2)
curl -Ls --tlsv1.2 --proto "=https" \
  "https://cli.doppler.com/install.sh" | sudo sh

# Verify Installation
doppler --version
```

### 4.2 Account & Login

```bash
# Browser öffnet sich für Authentifizierung
doppler login

# Verify
doppler whoami
```

### 4.3 Project erstellen

```bash
# Project erstellen
doppler projects create assixx

# Verify
doppler projects list
```

### 4.4 Environments/Configs

Doppler erstellt automatisch:

- `dev` (Development)
- `stg` (Staging)
- `prd` (Production)

```bash
# Configs anzeigen
doppler configs --project assixx
```

---

## 5. Phase 2: Secrets Migration

### 5.1 Secrets aus .env exportieren

```bash
# Aktuelles .env Inventar erstellen (ohne Werte!)
cd /home/scs/projects/Assixx/docker
grep -E "^[A-Z]" .env | cut -d'=' -f1 > /tmp/env-keys.txt

# Output prüfen
cat /tmp/env-keys.txt
```

### 5.2 Secrets in Doppler importieren

**Option A: Manuell via Dashboard (Empfohlen für erste Migration)**

1. Öffne https://dashboard.doppler.com
2. Project: assixx → Config: dev
3. "Add Secret" für jeden Key
4. Werte aus .env kopieren

**Option B: Via CLI (Bulk Import)**

```bash
# Einzeln setzen
doppler secrets set JWT_SECRET="dein-wert" --project assixx --config dev
doppler secrets set DB_PASSWORD="dein-wert" --project assixx --config dev
# ... für jeden Key

# Oder via JSON Upload
doppler secrets upload secrets.json --project assixx --config dev
```

### 5.3 Secrets-Struktur in Doppler

```
assixx/
├── dev/
│   ├── JWT_SECRET=dev-jwt-secret-xxx
│   ├── JWT_REFRESH_SECRET=dev-refresh-xxx
│   ├── DB_HOST=assixx-postgres
│   ├── DB_PORT=5432
│   ├── DB_USER=assixx_user
│   ├── DB_PASSWORD=dev-db-password
│   ├── DB_NAME=assixx
│   ├── REDIS_HOST=assixx-redis
│   ├── REDIS_PORT=6379
│   ├── REDIS_PASSWORD=dev-redis-password
│   ├── SESSION_SECRET=dev-session-xxx
│   ├── SMTP_HOST=smtp.example.com
│   ├── SMTP_PORT=587
│   ├── SMTP_USER=noreply@example.com
│   ├── SMTP_PASSWORD=dev-smtp-password
│   ├── SENTRY_DSN=https://xxx@sentry.io/xxx
│   ├── NODE_ENV=development
│   ├── PORT=3000
│   └── API_PREFIX=/api/v2
│
├── stg/ (Staging - später)
│   └── ... (andere Werte)
│
└── prd/ (Production - später)
    └── ... (andere Werte)
```

---

## 6. Phase 3: Docker Integration

### 6.1 Service Token erstellen

```bash
# Service Token für dev Environment
doppler configs tokens create dev-docker \
  --project assixx \
  --config dev \
  --max-age 0  # Kein Ablauf (oder z.B. 90d)

# Output: dp.st.dev.xxxxxxxxxxxx
# DIESEN TOKEN SICHER SPEICHERN!
```

### 6.2 Dockerfile anpassen

**Neues `docker/Dockerfile.doppler`** (oder in bestehendes integrieren):

```dockerfile
# Doppler CLI zu Backend Image hinzufügen
FROM node:24-alpine AS base

# Doppler CLI installieren
RUN wget -q -t3 'https://packages.doppler.com/public/cli/rsa.8004D9FF50437357.key' -O /etc/apk/keys/cli@doppler-8004D9FF50437357.rsa.pub && \
    echo 'https://packages.doppler.com/public/cli/alpine/any-version/main' >> /etc/apk/repositories && \
    apk add --no-cache doppler

# ... rest of Dockerfile
```

### 6.3 docker-compose.yml anpassen

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    container_name: assixx-backend
    environment:
      # Nur DOPPLER_TOKEN wird vom Host übergeben
      - DOPPLER_TOKEN=${DOPPLER_TOKEN}
    # Command verwendet doppler run
    command: >
      sh -c "doppler run --project assixx --config dev -- node dist/main.js"
    # ENTFERNT: env_file: - .env
    depends_on:
      - postgres
      - redis

  # PostgreSQL braucht noch direkte Env-Vars (Bootstrap)
  postgres:
    image: postgres:17-alpine
    container_name: assixx-postgres
    environment:
      # Diese werden von Doppler CLI auf Host geholt
      - POSTGRES_USER=${DB_USER:-assixx_user}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME:-assixx}
    # ...

  redis:
    image: redis:7-alpine
    container_name: assixx-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    # ...
```

### 6.4 Alternative: doppler run auf Host-Level

Statt Doppler CLI in Container:

```bash
# Start-Script: scripts/start-dev.sh
#!/bin/bash

# Doppler holt alle Secrets und startet docker-compose
doppler run --project assixx --config dev -- docker-compose up -d
```

**Vorteil:** Kein Doppler CLI in Docker Images nötig.

### 6.5 .env.doppler Template erstellen

```bash
# docker/.env.doppler (Template - KEINE echten Werte!)
# Diese Datei dokumentiert welche Secrets von Doppler kommen

# === VON DOPPLER VERWALTET ===
# JWT_SECRET           → Doppler: assixx/dev
# JWT_REFRESH_SECRET   → Doppler: assixx/dev
# DB_PASSWORD          → Doppler: assixx/dev
# REDIS_PASSWORD       → Doppler: assixx/dev
# SESSION_SECRET       → Doppler: assixx/dev
# SMTP_PASSWORD        → Doppler: assixx/dev
# SENTRY_DSN           → Doppler: assixx/dev

# === LOKALER DOPPLER TOKEN ===
DOPPLER_TOKEN=dp.st.dev.XXXXXXXX  # ← Dein Service Token hier

# === NICHT-SECRETS (können hier bleiben) ===
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v2
DB_HOST=assixx-postgres
DB_PORT=5432
REDIS_HOST=assixx-redis
REDIS_PORT=6379
```

---

## 7. Phase 4: CI/CD Integration

### 7.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3

      - name: Deploy with Secrets
        run: doppler run -- ./scripts/deploy.sh
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PROD }}
```

### 7.2 Service Tokens für CI/CD

```bash
# Separater Token für GitHub Actions
doppler configs tokens create github-actions \
  --project assixx \
  --config prd \
  --max-age 90d  # 90 Tage Gültigkeit

# In GitHub: Settings → Secrets → DOPPLER_TOKEN_PROD
```

---

## 8. Phase 5: Cleanup & Verification

### 8.1 Alte .env Dateien sichern

```bash
# Backup vor Löschung
cp docker/.env docker/.env.backup.$(date +%Y%m%d)

# Nach erfolgreicher Migration: .env entfernen
# NICHT SOFORT - erst nach Tests!
```

### 8.2 .gitignore aktualisieren

```bash
# .gitignore
.env
.env.*
!.env.example
!.env.doppler  # Template ist OK

# Doppler
.doppler.yaml  # Falls lokal verwendet
```

### 8.3 Verification Commands

```bash
# Doppler Secrets prüfen
doppler secrets --project assixx --config dev

# Test: Secrets werden korrekt injiziert?
doppler run --project assixx --config dev -- printenv | grep JWT

# Docker mit Doppler starten
DOPPLER_TOKEN=dp.st.dev.xxx docker-compose up -d

# Logs prüfen
docker logs assixx-backend 2>&1 | head -20
```

---

## 9. Access Control & Security

### 9.1 Wer hat Zugriff?

| Rolle                      | Zugriff               | Wie                   |
| -------------------------- | --------------------- | --------------------- |
| **Du (Owner)**             | Alles                 | Doppler Account Login |
| **Service Token dev**      | Nur dev Secrets       | `dp.st.dev.xxx` Token |
| **Service Token prod**     | Nur prod Secrets      | `dp.st.prd.xxx` Token |
| **Jemand mit Docker-Repo** | NICHTS                | Braucht Token         |
| **GitHub Actions**         | Nur was Token erlaubt | Secret in GitHub      |

### 9.2 Token Security Best Practices

```bash
# ❌ NIEMALS
DOPPLER_TOKEN=xxx  # Im Code/Repo

# ✅ RICHTIG
export DOPPLER_TOKEN=xxx  # Nur in Terminal Session
# Oder in ~/.bashrc (nur dein User)
# Oder in GitHub Secrets (verschlüsselt)
```

### 9.3 Token Rotation

```bash
# Alten Token widerrufen
doppler configs tokens revoke dev-docker --project assixx --config dev

# Neuen Token erstellen
doppler configs tokens create dev-docker-v2 \
  --project assixx \
  --config dev
```

### 9.4 Audit Log prüfen

```bash
# Via Dashboard: https://dashboard.doppler.com → Activity
# Zeigt: Wer, Wann, Was (Secret gelesen/geändert)
```

---

## 10. Rollback Plan

### Falls Doppler nicht funktioniert:

```bash
# 1. Alte .env wiederherstellen
cp docker/.env.backup.YYYYMMDD docker/.env

# 2. docker-compose.yml zurücksetzen
git checkout docker/docker-compose.yml

# 3. Neu starten
cd docker && docker-compose down && docker-compose up -d
```

### Falls Doppler-Service down:

```bash
# Fallback: Secrets lokal cachen (nur für Notfall!)
doppler secrets download --project assixx --config dev \
  --no-file --format env > .env.emergency

# Mit gecachter .env starten
docker-compose --env-file .env.emergency up -d
```

---

## 11. Checkliste

### Phase 1: Setup ✅

- [x] Doppler CLI installiert (v3.75.1)
- [x] Doppler Account erstellt (SCS-Technik)
- [x] `doppler login` erfolgreich
- [x] Project "assixx" erstellt

### Phase 2: Migration ✅

- [x] Alle Secrets aus .env dokumentiert (in .locklock)
- [x] Secrets in Doppler/dev importiert (37 Secrets)
- [x] Secrets in Doppler verifiziert
- [x] PUBLIC_SENTRY_DSN (Frontend) zu .locklock hinzugefügt

### Phase 3: Docker ✅

- [x] Service Token erstellt (docker-dev)
- [x] docker-compose.yml kompatibel (nutzt ${VAR} Syntax)
- [x] `doppler run -- docker-compose up -d` funktioniert
- [x] Backend startet mit Doppler Secrets
- [x] Health Check erfolgreich
- [x] Database Connection verifiziert

### Phase 4: CI/CD (Optional)

- [ ] GitHub Actions Token erstellt
- [ ] Workflow angepasst
- [ ] Deployment getestet

### Phase 5: Cleanup

- [ ] Alte .env gesichert (OPTIONAL - .env bleibt als Fallback)
- [x] .locklock aktualisiert (Service Token dokumentiert)
- [x] Dokumentation aktualisiert
- [ ] Team informiert (falls vorhanden)

---

## 12. Schnellstart (Nach Setup)

```bash
# Docker starten mit Doppler
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d

# Oder: Token in Shell setzen
export DOPPLER_TOKEN="dp.st.dev.xxx"
doppler run -- docker-compose up -d

# Secrets prüfen
doppler secrets --project assixx --config dev
```

---

## Quick Reference Commands

```bash
# === DOPPLER CLI ===
doppler login                                    # Browser Auth
doppler whoami                                   # Aktueller User
doppler projects list                            # Alle Projects
doppler configs --project assixx                 # Configs anzeigen
doppler secrets --project assixx --config dev    # Secrets anzeigen

# === SECRETS MANAGEMENT ===
doppler secrets set KEY="value" --project assixx --config dev
doppler secrets delete KEY --project assixx --config dev
doppler secrets download --project assixx --config dev --format env

# === TOKENS ===
doppler configs tokens create NAME --project assixx --config dev
doppler configs tokens revoke NAME --project assixx --config dev
doppler configs tokens list --project assixx --config dev

# === EXECUTION ===
doppler run --project assixx --config dev -- command
DOPPLER_TOKEN=xxx doppler run -- command

# === DOCKER ===
DOPPLER_TOKEN=xxx docker-compose up -d
doppler run -- docker-compose up -d
```

---

## Ressourcen

- [Doppler Docs](https://docs.doppler.com)
- [Doppler CLI Reference](https://docs.doppler.com/docs/cli)
- [Docker Integration](https://docs.doppler.com/docs/docker)
- [GitHub Actions Integration](https://docs.doppler.com/docs/github-actions)

---

**Letzte Aktualisierung:** 2026-01-13
**Autor:** Claude Code
**Version:** 1.0.0
