# PostgreSQL CLI (psql) - Setup & Referenz

> **psql** ist der offizielle PostgreSQL-Kommandozeilen-Client.
> Installiert als **Client-only** (kein Server!) auf WSL2 Ubuntu.
> Der PostgreSQL-Server läuft weiterhin ausschließlich in Docker.

---

## Quick Reference

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| **Version**    | PostgreSQL 17.7                      |
| **Paket**      | `postgresql-client-17` (kein Server) |
| **Host**       | `localhost`                          |
| **Port**       | `5432` (Docker-exposed)              |
| **Database**   | `assixx`                             |
| **Admin User** | `assixx_user` (BYPASSRLS)            |
| **App User**   | `app_user` (RLS enforced)            |
| **APT Repo**   | `apt.postgresql.org` (noble-pgdg)    |

---

## Installation (WSL2 Ubuntu)

### Voraussetzungen

- WSL2 mit Ubuntu 24.04 (Noble)
- Docker-Container `assixx-postgres` läuft

### 1. PostgreSQL APT Repository hinzufügen

```bash
# Signing Key herunterladen
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc

# Repository hinzufügen
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
```

### 2. Client installieren (KEIN Server!)

```bash
sudo apt update
sudo apt install -y postgresql-client-17
```

**WICHTIG:** NUR `postgresql-client-17` installieren, NICHT `postgresql` oder `postgresql-contrib`. Der Server läuft in Docker -- ein zweiter auf dem Host würde Port 5432 blockieren.

### 3. Installation prüfen

```bash
psql --version
# Erwartete Ausgabe: psql (PostgreSQL) 17.7
```

---

## Verbindung zur Datenbank

### Direkt via psql

```bash
# Interaktive Shell (Passwort wird abgefragt)
psql -h localhost -U assixx_user -d assixx

# Einzelner SQL-Befehl
psql -h localhost -U assixx_user -d assixx -c "SELECT COUNT(*) FROM users;"

# SQL-Datei ausführen
psql -h localhost -U assixx_user -d assixx -f /path/to/script.sql
```

### Mit Passwort als Env-Variable (kein Prompt)

```bash
# Passwort aus Docker-Container lesen
PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD) \
  psql -h localhost -U assixx_user -d assixx -c "SELECT 1;"
```

### Via Docker (Alternative, kein lokales psql nötig)

```bash
# Weiterhin möglich - psql im Container ausführen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT 1;"

# Interaktive Shell im Container
docker exec -it assixx-postgres psql -U assixx_user -d assixx
```

---

## Häufige Befehle

### Datenbank-Übersicht

```bash
# Alle Tabellen auflisten
psql -h localhost -U assixx_user -d assixx -c "\dt"

# Tabellen-Schema anzeigen
psql -h localhost -U assixx_user -d assixx -c "\d users"

# Datenbankgröße
psql -h localhost -U assixx_user -d assixx -c "SELECT pg_size_pretty(pg_database_size('assixx'));"

# Tabellengrößen (Top 10)
psql -h localhost -U assixx_user -d assixx -c "
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
"
```

### RLS und Policies

```bash
# Tabellen mit RLS
psql -h localhost -U assixx_user -d assixx -c "
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
"

# RLS Policies anzeigen
psql -h localhost -U assixx_user -d assixx -c "
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### Migrationen

```bash
# Migration-Status prüfen
psql -h localhost -U assixx_user -d assixx -c "
SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;
"
```

### Seeds

```bash
# Seeds anwenden (über pnpm)
pnpm run db:seed

# Oder manuell
psql -h localhost -U assixx_user -d assixx -f database/seeds/001_global-seed-data.sql

# Seed-Daten prüfen
psql -h localhost -U assixx_user -d assixx -c "SELECT id, name FROM kvp_categories ORDER BY id;"
psql -h localhost -U assixx_user -d assixx -c "SELECT id, name FROM features ORDER BY id;"
psql -h localhost -U assixx_user -d assixx -c "SELECT id, name FROM plans ORDER BY id;"
```

---

## psql Meta-Befehle (in der interaktiven Shell)

| Befehl          | Beschreibung                   |
| --------------- | ------------------------------ |
| `\dt`           | Alle Tabellen auflisten        |
| `\d tablename`  | Tabellen-Schema anzeigen       |
| `\di`           | Alle Indexes auflisten         |
| `\du`           | Alle Benutzer/Rollen auflisten |
| `\dn`           | Alle Schemas auflisten         |
| `\dT`           | Alle Typen (ENUMs) auflisten   |
| `\l`            | Alle Datenbanken auflisten     |
| `\conninfo`     | Aktuelle Verbindungsinfo       |
| `\x`            | Erweiterte Ausgabe (toggle)    |
| `\timing`       | Query-Timing anzeigen (toggle) |
| `\i filename`   | SQL-Datei ausführen            |
| `\copy`         | CSV Import/Export              |
| `\q`            | psql beenden                   |
| `\?`            | Hilfe zu Meta-Befehlen         |
| `\h SQL_BEFEHL` | Hilfe zu einem SQL-Befehl      |

---

## Backup & Restore

### pg_dump (lokal, nicht mehr docker exec nötig)

```bash
# Vollständiges Backup (komprimiert)
PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD) \
  pg_dump -h localhost -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/full_backup_$(date +%Y%m%d_%H%M%S).dump

# Schema-only
PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD) \
  pg_dump -h localhost -U assixx_user -d assixx --schema-only \
  > database/backups/schema_only.sql

# Einzelne Tabelle
PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD) \
  pg_dump -h localhost -U assixx_user -d assixx -t users \
  > database/backups/users_backup.sql
```

### pg_restore

```bash
# Aus .dump wiederherstellen
PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD) \
  pg_restore -h localhost -U assixx_user -d assixx \
  < database/backups/full_backup_XXXXXX.dump
```

---

## Zwei User -- Wann welchen?

| User          | Verwendung                          | RLS  |
| ------------- | ----------------------------------- | ---- |
| `assixx_user` | Migrationen, Backups, Admin-Queries | Nein |
| `app_user`    | RLS testen, wie Backend sich sieht  | Ja   |

```bash
# Als app_user MIT Tenant Context (simuliert Backend)
psql -h localhost -U app_user -d assixx -c "
SET app.tenant_id = '1';
SELECT COUNT(*) FROM users;
"

# Als assixx_user (sieht alles, kein RLS)
psql -h localhost -U assixx_user -d assixx -c "
SELECT COUNT(*) FROM users;
"
```

---

## Lokal vs Docker -- Was verwenden?

| Methode             | Wann                                              |
| ------------------- | ------------------------------------------------- |
| `psql -h localhost` | Standard für Entwicklung (schneller, direkt)      |
| `docker exec`       | Wenn psql nicht installiert oder Container-intern |
| `pnpm run db:seed`  | Seeds anwenden (nutzt psql intern)                |
| DBeaver (Windows)   | GUI für komplexe Schema-Exploration               |

**Empfehlung:** `psql -h localhost` als Standard, `docker exec` nur als Fallback.

---

## Troubleshooting

| Problem                            | Ursache                   | Lösung                                                   |
| ---------------------------------- | ------------------------- | -------------------------------------------------------- |
| `connection refused`               | Docker-Container nicht da | `cd docker && doppler run -- docker-compose up -d`       |
| `password authentication failed`   | Falsches Passwort         | `docker exec assixx-postgres printenv POSTGRES_PASSWORD` |
| `psql: command not found`          | Client nicht installiert  | `sudo apt install postgresql-client-17`                  |
| `FATAL: role "scs" does not exist` | Kein `-U` angegeben       | Immer `-U assixx_user` mitgeben                          |
| `could not connect to server`      | Port 5432 nicht exposed   | `docker-compose.yml` prüfen: `127.0.0.1:5432->5432`      |

---

## Verwandte Dokumentation

- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - Migrationen mit node-pg-migrate
- [HOW-TO-TEST-WITH-BRUNO.md](./HOW-TO-TEST-WITH-BRUNO.md) - API Testing
- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Datenbankstruktur

---

**Erstellt:** 2026-01-31
**Paket:** `postgresql-client-17` (Client-only, kein Server)
**Quelle:** [postgresql.org/docs/current/app-psql.html](https://www.postgresql.org/docs/current/app-psql.html)
