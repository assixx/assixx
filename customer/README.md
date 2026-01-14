# Assixx Database Setup Guide fuer Kunden-Deployments

> **Version:** 1.1.0 | **Stand:** 2026-01-14

---

## Uebersicht

Dieses Dokument beschreibt, wie man eine frische Assixx-Datenbank fuer einen neuen Kunden aufsetzt.

**Wichtig:** Der `customer/` Ordner ist in `.gitignore` und wird NICHT committed. Er enthaelt kundenspezifische Scripts und Daten.

---

## PostgreSQL User-Architektur

### Zwei-User-System

| User | Rolle | RLS | Verwendung |
|------|-------|-----|------------|
| `assixx_user` | Superuser | **UMGANGEN** | Migrations, Admin-Tasks, Installation |
| `app_user` | Applikation | **ERZWUNGEN** | Backend-Anwendung (Multi-Tenant sicher) |

**KRITISCH:** Das Backend MUSS `app_user` verwenden, um Row Level Security zu erzwingen!

### Wo werden User definiert?

| Ort | User | Wann erstellt |
|-----|------|---------------|
| Docker `POSTGRES_USER` env | `assixx_user` | Container erster Start |
| `000_users.sql` | `app_user` | Waehrend install.sh |

---

## Passwort-Verwaltung

### Passwoerter aendern

#### Option 1: Waehrend Installation (empfohlen)

```bash
# Passwort als Umgebungsvariable setzen
export APP_USER_PASSWORD="KundenSicheresPasswort123"
./install.sh
```

#### Option 2: Interaktive Eingabe

```bash
./install.sh
# Script fragt nach Passwort
```

#### Option 3: Nach Installation aendern

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
    "ALTER ROLE app_user WITH PASSWORD 'NeuesPasswort';"
```

### Wo Passwoerter aktualisieren?

| Datei | Variable | Zweck |
|-------|----------|-------|
| `docker/.env` | `POSTGRES_PASSWORD` | Superuser (Migrations) |
| `docker/.env` | `DB_PASSWORD` | App-User (Backend) |
| Doppler (falls genutzt) | `DB_PASSWORD` | Secrets Management |

### Passwort-Anforderungen

- Minimum 16 Zeichen
- Alphanumerisch empfohlen (keine Sonderzeichen wie `@`, `!`, `$`)
- Generieren: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Voraussetzungen

1. **Docker & Docker Compose** installiert
2. **Git Repository** geklont: `git clone https://github.com/SCS-Technik/Assixx.git`
3. **Umgebungsvariablen** konfiguriert in `docker/.env`

---

## Schnellstart

### 1. Volumes erstellen

```bash
docker volume create assixx_postgres_data
docker volume create assixx_redis_data
```

### 2. Docker starten

```bash
cd /home/scs/projects/Assixx/docker
docker-compose up -d postgres redis
```

### 3. Warten bis PostgreSQL healthy ist

```bash
sleep 30
docker-compose ps
# assixx-postgres sollte "healthy" zeigen
```

### 4. Fresh Install ausfuehren

```bash
cd /home/scs/projects/Assixx/customer/fresh-install

# Mit Passwort aus Environment
export APP_USER_PASSWORD="KundenSicheresPasswort"
./install.sh

# Oder interaktiv (Script fragt nach Passwort)
./install.sh
```

### 5. docker/.env aktualisieren

```bash
nano /home/scs/projects/Assixx/docker/.env
# DB_PASSWORD=KundenSicheresPasswort  (gleiches Passwort wie oben!)
```

### 6. Full Stack starten

```bash
cd /home/scs/projects/Assixx/docker
docker-compose up -d
```

### 7. Verifizieren

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT 'Tables', COUNT(*) FROM pg_tables WHERE schemaname = 'public'
UNION ALL SELECT 'Users', COUNT(*) FROM pg_roles WHERE rolname IN ('assixx_user', 'app_user')
UNION ALL SELECT 'Plans', COUNT(*) FROM plans;"
```

**Erwartete Ausgabe:**
```
 ?column? | count
----------+-------
 Tables   |   109
 Users    |     2
 Plans    |     3
```

---

## Scripts im `fresh-install/` Ordner

| Datei | Beschreibung |
|-------|--------------|
| `000_users.sql` | App-User Erstellung (app_user) |
| `001_schema.sql` | Komplettes DB-Schema (109 Tabellen, RLS, FK, Triggers) |
| `002_seed_data.sql` | Seed-Daten (Plans, Features, Kategorien) |
| `install.sh` | Automatisches Installations-Script |
| `README.md` | Detaillierte Dokumentation |

### Install-Optionen

```bash
./install.sh                # Vollinstallation (Users + Schema + Seed)
./install.sh --users-only   # Nur app_user erstellen/aktualisieren
./install.sh --schema-only  # Nur Schema (ohne Users, ohne Seed)
./install.sh --seed-only    # Nur Seed-Daten (Schema muss existieren)
```

---

## Was wird installiert?

### Users (000_users.sql)

- `app_user` mit kundenspezifischem Passwort
- Berechtigungen fuer alle Tabellen
- RLS wird fuer diesen User erzwungen

### Schema (001_schema.sql)

- **109 Tabellen** - Alle Anwendungstabellen
- **108 Sequences** - Auto-Increment fuer IDs
- **474 Indexes** - Performance-Optimierung
- **89 RLS Policies** - Multi-Tenant Isolation
- **68 Triggers** - Automatische Timestamps, Schutz
- **260 Foreign Keys** - Referentielle Integritaet

### Seed-Daten (002_seed_data.sql)

| Tabelle | Eintraege | Inhalt |
|---------|-----------|--------|
| `plans` | 3 | Basic (49), Professional (149), Enterprise (299) |
| `features` | 12 | Dashboard, Mitarbeiter, Abteilungen, Teams, etc. |
| `plan_features` | 36 | Zuordnung Features zu Plans |
| `kvp_categories` | 6 | Sicherheit, Effizienz, Qualitaet, etc. |
| `machine_categories` | 11 | CNC, Spritzguss, Pressen, etc. |

---

## Worauf achten?

### 1. Zwei verschiedene Passwoerter!

- `POSTGRES_PASSWORD` = Superuser (fuer Migrations)
- `DB_PASSWORD` = App-User (fuer Backend)

Diese koennen gleich sein, aber fuer maximale Sicherheit unterschiedlich.

### 2. RLS (Row Level Security)

- `assixx_user` UMGEHT RLS (Superuser)
- `app_user` ERZWINGT RLS (Multi-Tenant sicher)
- Backend MUSS `app_user` verwenden!

### 3. Encoding (UTF-8)

Alle Dateien sind UTF-8 kodiert. Deutsche Umlaute muessen korrekt sein.

### 4. Erster Tenant/Admin

Nach DB-Installation muss der erste Tenant + Admin erstellt werden:
- Via API (Signup-Endpunkt)
- Oder via SQL (mit assixx_user)

---

## Troubleshooting

| Problem | Loesung |
|---------|---------|
| Container nicht running | `docker-compose up -d postgres redis` |
| Volume not found | `docker volume create assixx_postgres_data` |
| app_user existiert schon | OK - Script aktualisiert das Passwort |
| Password auth failed | `DB_PASSWORD` in docker/.env pruefen |
| Permission denied | `assixx_user` statt `app_user` fuer Admin-Tasks |

---

## Backup vor Aenderungen

**IMMER** ein Backup erstellen:

```bash
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 > backup_$(date +%Y%m%d_%H%M%S).dump
```

---

**Dieser Ordner ist in .gitignore** - Aenderungen hier werden NICHT committed!
