# Doppler Secret Management Guide

> Assixx - Zentrale Secrets-Verwaltung mit Doppler

**Stand:** 2026-01-26
**Doppler CLI:** v3.75.1
**Project:** assixx
**Config:** dev

---

## Inhaltsverzeichnis

1. [Quick Start](#1-quick-start)
2. [Die 2 Säulen: Doppler + .locklock](#2-die-2-säulen-doppler--locklock)
3. [Token-System verstehen](#3-token-system-verstehen)
4. [Docker Commands mit Doppler](#4-docker-commands-mit-doppler)
5. [Development Workflow](#5-development-workflow)
6. [Production Workflow](#6-production-workflow)
7. [Token verloren? Neuen erstellen](#7-token-verloren-neuen-erstellen)
8. [Secrets verwalten](#8-secrets-verwalten)
9. [Team: Token-Management für Entwickler](#9-team-token-management-für-entwickler)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Start

```bash
# Token setzen + Docker starten
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d
```

**Oder permanent in Shell:**

```bash
# Einmalig in ~/.bashrc
echo 'export DOPPLER_TOKEN="dp.st.dev.xxx"' >> ~/.bashrc
source ~/.bashrc

# Ab jetzt einfach:
doppler run -- docker-compose up -d
```

---

## 2. Die 2 Säulen: Doppler + .locklock

### WICHTIG: Secrets leben NUR in Doppler + .locklock!

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SECRET ÄNDERN?                                     │
│                                                                              │
│   1. DOPPLER        →  Source of Truth für DEV + PROD (EINZIGE Quelle!)    │
│   2. .locklock      →  IMMER als Archiv + Notfall-Backup aktualisieren!     │
│                                                                              │
│   docker/.env enthält KEINE Secrets mehr! Nur Konfiguration (Ports, Hosts). │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Die 2 Säulen erklärt

| Säule         | Zweck                         | Wann aktualisieren? |
| ------------- | ----------------------------- | ------------------- |
| **Doppler**   | Aktive Secrets für DEV + PROD | Bei jeder Änderung  |
| **.locklock** | Archiv + Sicherheit + Notfall | Bei jeder Änderung  |

### Was ist mit docker/.env?

`docker/.env` enthält **nur noch Non-Secrets** (Ports, Hostnames, Versions).
Ohne Doppler schlägt `docker-compose` sofort fehl mit klaren Fehlermeldungen:

```
ERROR: required variable REDIS_PASSWORD is missing a value:
  REDIS_PASSWORD must be set - use doppler run
```

### Warum nur 2 Säulen?

```
Szenario 1: Doppler funktioniert (Normalfall)
├── doppler run -- docker-compose up -d
└── ✅ Secrets kommen von Doppler

Szenario 2: Doppler down / Token verloren
├── docker-compose up -d (ohne doppler run)
├── ❌ Fehler: "JWT_SECRET must be set - use doppler run"
├── .locklock öffnen → Secrets manuell als ENV setzen
└── ✅ Notfall-Recovery möglich

Szenario 3: Alles kaputt / Neuer Rechner / Disaster Recovery
├── .locklock öffnen
└── ✅ Alle Secrets + History + Tokens dokumentiert
```

### Workflow bei Secret-Änderung

```bash
# Beispiel: JWT_SECRET rotieren

# 1. Neues Secret generieren
NEW_JWT=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# 2. In DOPPLER aktualisieren (Primary)
doppler secrets set JWT_SECRET="$NEW_JWT" --project assixx --config dev

# 3. In .locklock dokumentieren (Archiv)
# → Manuell: Alten Wert in ARCHIV Sektion verschieben
# → Neuen Wert in AKTUELL Sektion eintragen

# docker/.env muss NICHT aktualisiert werden (enthält keine Secrets!)
```

### Checkliste bei jeder Secret-Änderung

```
□ Doppler aktualisiert?     → doppler secrets set ...
□ .locklock aktualisiert?   → Archiv + Dokumentation
```

---

## 3. Token-System verstehen

### Was ist der DOPPLER_TOKEN?

| Eigenschaft          | Wert                              |
| -------------------- | --------------------------------- |
| **Was ist es?**      | Service Token für Doppler API     |
| **Wer braucht ihn?** | Docker, CI/CD, Scripts            |
| **Berechtigung**     | Read-Only auf `assixx/dev` Config |

### WICHTIG: Token wird nur EINMAL angezeigt!

```
┌─────────────────────────────────────────────────────────────┐
│  Token erstellen                                            │
│  └── doppler configs tokens create NAME ...                 │
│      └── Token wird EINMAL angezeigt: dp.st.dev.xxxxx       │
│          └── SOFORT in .locklock speichern!                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Danach in Doppler Cloud                                    │
│  └── Token-WERT ist NICHT mehr sichtbar                     │
│  └── Nur Token-NAME und Metadaten sichtbar                  │
│  └── Das ist ein SICHERHEITSFEATURE!                        │
└─────────────────────────────────────────────────────────────┘
```

### Wo finde ich meinen Token?

| Ort                          | Token-Wert sichtbar? | Anmerkung                 |
| ---------------------------- | -------------------- | ------------------------- |
| `.locklock`                  | ✅ JA                | **Deine lokale Referenz** |
| Doppler Cloud Dashboard      | ❌ NEIN              | Nur Name/Metadaten        |
| `doppler configs tokens` CLI | ❌ NEIN              | Nur Name/Metadaten        |

**Der Token-Wert steht NUR in `.locklock`!**

```bash
# Token aus .locklock anzeigen
grep -A 2 "docker-dev:" /home/scs/projects/Assixx/.locklock
```

---

## 4. Docker Commands mit Doppler

### Basis-Befehle

```bash
cd /home/scs/projects/Assixx/docker

# Basis (Backend + PostgreSQL + Redis)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose up -d

# Mit Observability (+ Prometheus, Loki, Grafana)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile observability up -d

# Mit Production Frontend (+ Nginx, SvelteKit SSR)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production up -d

# Alles zusammen (Observability + Production)
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile observability --profile production up -d
```

### Stoppen

```bash
# Basis stoppen
doppler run -- docker-compose down

# Mit Profilen stoppen
doppler run -- docker-compose --profile observability down
doppler run -- docker-compose --profile production down
```

### Neubauen (nach Dependency-Änderung)

```bash
# DEV Backend neu bauen
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose build --no-cache backend

# PROD komplett neu bauen
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production build --no-cache
```

---

## 5. Development Workflow

### DEV Starten (Standard)

```bash
# Terminal 1: Docker Services
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile observability up -d

# Terminal 2: Frontend Dev Server (HMR)
cd /home/scs/projects/Assixx
pnpm run dev:svelte
```

### DEV URLs

| Service        | URL                   | Beschreibung     |
| -------------- | --------------------- | ---------------- |
| Frontend (HMR) | http://localhost:5173 | Vite Dev Server  |
| Backend API    | http://localhost:3000 | NestJS + Fastify |
| Grafana        | http://localhost:3050 | Dashboards       |
| Prometheus     | http://localhost:9090 | Metrics          |
| Loki           | http://localhost:3100 | Logs             |

### Nach Code-Änderung

| Änderung              | Befehl                                                 |
| --------------------- | ------------------------------------------------------ |
| Backend Code          | `docker-compose restart backend`                       |
| Frontend Code         | **Nichts** - HMR lädt automatisch neu                  |
| Backend Dependencies  | `docker-compose build backend && docker-compose up -d` |
| Frontend Dependencies | **Nichts** - läuft lokal, `pnpm add` reicht            |

### DEV Zusammenfassung

```
┌──────────────┬───────────────────────┬──────────────────────┐
│   Änderung   │        Backend        │       Frontend       │
├──────────────┼───────────────────────┼──────────────────────┤
│ Code         │ restart backend       │ nichts (HMR)         │
├──────────────┼───────────────────────┼──────────────────────┤
│ Dependencies │ build backend + up -d │ nichts (läuft lokal) │
└──────────────┴───────────────────────┴──────────────────────┘
```

---

## 6. Production Workflow

### PROD Starten

```bash
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- docker-compose --profile production up -d
```

### PROD URLs

| Service           | URL                   | Beschreibung     |
| ----------------- | --------------------- | ---------------- |
| Frontend (SSR)    | http://localhost      | Via Nginx        |
| Frontend (direkt) | http://localhost:3001 | SvelteKit Node   |
| Backend API       | http://localhost:3000 | NestJS + Fastify |

### Nach Code-Änderung

| Änderung      | Befehl                                                       |
| ------------- | ------------------------------------------------------------ |
| Backend Code  | `docker-compose restart backend`                             |
| Frontend Code | `docker-compose --profile production up -d --build frontend` |

### PROD Zusammenfassung

```
┌──────────────┬──────────────────────────────────────────────────────┐
│   Schritt    │                        Befehl                        │
├──────────────┼──────────────────────────────────────────────────────┤
│ PROD bauen   │ docker-compose --profile production build --no-cache │
├──────────────┼──────────────────────────────────────────────────────┤
│ PROD starten │ docker-compose --profile production up -d            │
├──────────────┼──────────────────────────────────────────────────────┤
│ PROD stoppen │ docker-compose --profile production down             │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## 7. Token verloren? Neuen erstellen

### Schritt 1: Alten Token widerrufen

```bash
doppler configs tokens revoke docker-dev --project assixx --config dev
```

### Schritt 2: Neuen Token erstellen

```bash
doppler configs tokens create docker-dev-v2 \
  --project assixx \
  --config dev \
  --max-age 0 \
  --plain
```

**Output (EINMALIG!):**

```
dp.st.dev.NEUERTOKENxxxxxxxxxxxxxxxxxxxxx
```

### Schritt 3: SOFORT in .locklock speichern

```bash
# .locklock öffnen und Token aktualisieren
nano /home/scs/projects/Assixx/.locklock

# Unter "Doppler Service Tokens:" den neuen Wert eintragen
```

### Schritt 4: ~/.bashrc aktualisieren (falls verwendet)

```bash
# Alte Zeile ersetzen
nano ~/.bashrc
# export DOPPLER_TOKEN="dp.st.dev.NEUERTOKEN..."
source ~/.bashrc
```

---

## 8. Secrets verwalten

### Alle Secrets anzeigen

```bash
doppler secrets --project assixx --config dev
```

### Einzelnes Secret abrufen

```bash
doppler secrets get JWT_SECRET --project assixx --config dev
```

### Secret hinzufügen/ändern

```bash
doppler secrets set NEW_SECRET="wert" --project assixx --config dev
```

### Secret löschen

```bash
doppler secrets delete OLD_SECRET --project assixx --config dev
```

### Mehrere Secrets auf einmal (JSON Upload)

```bash
# 1. JSON erstellen
cat > /tmp/secrets.json << 'EOF'
{
  "NEW_KEY_1": "value1",
  "NEW_KEY_2": "value2"
}
EOF

# 2. Hochladen
doppler secrets upload /tmp/secrets.json --project assixx --config dev

# 3. JSON löschen!
rm /tmp/secrets.json
```

### Activity Log (Wer hat was geändert?)

```bash
doppler activity --project assixx
```

---

## 9. Team: Token-Management für Entwickler

### Grundregel: Token pro Entwickler

```
┌─────────────────────────────────────────────────────────────┐
│  NIEMALS einen Token für alle teilen!                       │
│  → Jeder Entwickler bekommt seinen EIGENEN Token            │
└─────────────────────────────────────────────────────────────┘
```

### Token für neuen Entwickler erstellen

```bash
# Du (Admin) erstellst Token für "Max"
doppler configs tokens create max-dev \
  --project assixx \
  --config dev \
  --max-age 90d \
  --plain

# Output: dp.st.dev.MAXTOKENxxxxx
# → Token EINMAL angezeigt, sofort notieren!
```

### Token sicher an Entwickler übergeben

| Methode                                    | Sicherheit   |
| ------------------------------------------ | ------------ |
| ❌ Email                                   | NIEMALS      |
| ❌ Slack/Teams                             | NIEMALS      |
| ⚠️ Signal/WhatsApp (verschwindend)         | Okay         |
| ✅ Persönlich / Videocall                  | Beste Option |
| ✅ Passwort-Manager (1Password, Bitwarden) | Beste Option |

### Was der neue Entwickler tun muss

```bash
# 1. Doppler CLI installieren
curl -Ls --tlsv1.2 --proto "=https" \
  "https://cli.doppler.com/install.sh" | sudo sh

# 2. Docker starten MIT Token (explizit, kein export!)
cd /home/scs/projects/Assixx/docker
DOPPLER_TOKEN="dp.st.dev.MAXTOKENxxx" doppler run -- docker-compose up -d

# 3. Mit Observability
DOPPLER_TOKEN="dp.st.dev.MAXTOKENxxx" doppler run -- docker-compose --profile observability up -d
```

### Was der Entwickler NICHT braucht

| Braucht er? | Was?                            |
| ----------- | ------------------------------- |
| ❌ NEIN     | Doppler Account                 |
| ❌ NEIN     | Doppler Login (`doppler login`) |
| ❌ NEIN     | Zugang zum Doppler Dashboard    |
| ✅ JA       | Seinen Service Token            |
| ✅ JA       | Doppler CLI installiert         |
| ✅ JA       | Docker installiert              |

### Alle Team-Tokens anzeigen

```bash
doppler configs tokens --project assixx --config dev
```

### Token widerrufen (Entwickler verlässt Team)

```bash
# Max verlässt das Team → Token sofort widerrufen
doppler configs tokens revoke max-dev --project assixx --config dev
```

### Token-Namenskonvention

```
Format: [name]-[environment]

Beispiele:
├── docker-dev      → Dein lokaler Token
├── max-dev         → Max's Token
├── anna-dev        → Anna's Token
├── ci-github-dev   → GitHub Actions
└── ci-github-prod  → GitHub Actions Production
```

### Team-Token Checkliste

```
Neuer Entwickler:
□ Token erstellt: doppler configs tokens create NAME-dev ...
□ Token sicher übergeben (NICHT per Email!)
□ In .locklock dokumentiert (nur Token-NAME, nicht Wert!)

Entwickler verlässt Team:
□ Token widerrufen: doppler configs tokens revoke NAME-dev ...
□ Aus .locklock entfernen
```

### Audit: Wer hat wann zugegriffen?

```bash
# Activity Log anzeigen
doppler activity --project assixx

# Zeigt: Token-Name, Zeitpunkt, Aktion
```

---

## 10. Troubleshooting

### "you must provide a token"

```bash
# Token nicht gesetzt
export DOPPLER_TOKEN="dp.st.dev.xxx"
# oder
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- ...
```

### "invalid token"

```bash
# Token falsch oder widerrufen
# → Neuen Token erstellen (siehe Abschnitt 6)
```

### "Secrets not injected"

```bash
# Test: Werden Secrets geladen?
DOPPLER_TOKEN="dp.st.dev.xxx" doppler run -- printenv | grep JWT

# Wenn leer → Token prüfen
doppler whoami
```

### Container startet nicht

```bash
# 1. Logs prüfen
docker logs assixx-backend

# 2. Secrets prüfen
doppler secrets --project assixx --config dev | grep -i error

# 3. Notfall: Secrets manuell aus .locklock setzen
export JWT_SECRET="wert-aus-locklock"
export DB_PASSWORD="wert-aus-locklock"
export REDIS_PASSWORD="wert-aus-locklock"
# ... weitere Secrets aus .locklock
docker-compose up -d
```

### Wie funktioniert die Secret-Injection?

```
doppler run -- docker-compose up -d
       │
       ▼
┌─────────────────────────────────────┐
│ 1. Doppler injiziert Secrets als    │
│    Environment Variables            │
│ 2. docker-compose liest ${VAR}      │
│ 3. docker/.env liefert NUR          │
│    Non-Secrets (Ports, Hosts)       │
│ 4. Fehlende Secrets → klarer Fehler │
│    "must be set - use doppler run"  │
└─────────────────────────────────────┘
```

**Ohne Doppler startet NICHTS.** Das ist gewollt - keine versehentlichen Starts mit leeren Secrets.

---

## Quick Reference

```bash
# === DOPPLER CLI ===
doppler login                                    # Browser Auth
doppler whoami                                   # Aktueller User
doppler secrets --project assixx --config dev   # Alle Secrets

# === TOKEN MANAGEMENT ===
doppler configs tokens --project assixx --config dev              # Tokens auflisten
doppler configs tokens create NAME --project assixx --config dev  # Neuer Token
doppler configs tokens revoke NAME --project assixx --config dev  # Token löschen

# === DOCKER MIT DOPPLER (PFLICHT!) ===
DOPPLER_TOKEN="xxx" doppler run -- docker-compose up -d
DOPPLER_TOKEN="xxx" doppler run -- docker-compose --profile observability up -d
DOPPLER_TOKEN="xxx" doppler run -- docker-compose --profile production up -d

# === NOTFALL (ohne Doppler - Secrets aus .locklock) ===
# export JWT_SECRET="..." DB_PASSWORD="..." REDIS_PASSWORD="..." etc.
# docker-compose up -d
```

---

## Wichtige Dateien

| Datei                                 | Inhalt                                   | In Git? |
| ------------------------------------- | ---------------------------------------- | ------- |
| `.locklock`                           | Token-Werte, Passwörter, Archiv          | ❌ NEIN |
| `docker/.env`                         | Nur Non-Secrets (Ports, Hosts, Versions) | ❌ NEIN |
| `docker/.env.example`                 | Template mit CHANGE_ME Platzhaltern      | ✅ JA   |
| `docs/DOPPLER-IMPLEMENTATION-PLAN.md` | Implementierungs-Details                 | ✅ JA   |
| `HOW-TO-DOPPLER-GUIDE.md`             | Diese Anleitung                          | ❌ NEIN |

---

**Letzte Aktualisierung:** 2026-01-26
