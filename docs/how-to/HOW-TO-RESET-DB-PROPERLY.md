# How-To: Datenbank sauber zurücksetzen (Fresh Install)

> Setzt die Datenbank komplett zurück — Schema, Seeds, Sequences — und erstellt einen frischen Test-Tenant. Ergebnis: 100% production-ready DB.

**Stand:** 2026-03-23

---

## Quick Start

```bash
cd /home/scs/projects/Assixx

# 1. Schema-Stand sichern (solange DB intakt!)
./scripts/sync-customer-migrations.sh

# 2. Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/pre_reset_$(date +%Y%m%d_%H%M%S).dump

# 3. Backend stoppen
cd docker && doppler run -- docker-compose stop backend deletion-worker

# 4. Schema droppen + neu erstellen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 5. Fresh Install
cd ../customer/fresh-install
APP_USER_PASSWORD="$(doppler secrets get DB_PASSWORD --plain)" ./install.sh

# 6. Backend starten
cd ../docker && doppler run -- docker-compose start backend deletion-worker

# 7. Test-Tenant erstellen
cd .. && ./scripts/create-test-tenant.sh

# 8. Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT 'Tabellen' AS check, COUNT(*)::text AS result FROM pg_tables WHERE schemaname = 'public'
UNION ALL SELECT 'RLS Policies', COUNT(*)::text FROM pg_policies WHERE schemaname = 'public'
UNION ALL SELECT 'Addons', COUNT(*)::text FROM addons
UNION ALL SELECT 'Migrationen', COUNT(*)::text FROM pgmigrations
UNION ALL SELECT 'Tenants', COUNT(*)::text FROM tenants
UNION ALL SELECT 'Users', COUNT(*)::text FROM users
ORDER BY 1;
"
```

---

## Was passiert bei jedem Schritt?

### Schritt 1: `sync-customer-migrations.sh`

Dumpt den **aktuellen** Schema-Stand (inkl. aller angewandten Migrationen) in `customer/fresh-install/001_schema.sql`. Muss laufen **bevor** die DB gedroppt wird — danach ist der Schema-Stand weg.

**Erzeugt/aktualisiert:**

| Datei                                         | Inhalt                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| `customer/fresh-install/001_schema.sql`       | Komplettes Schema (Tabellen, RLS, Triggers, FK, Indexes) |
| `customer/fresh-install/002_seed_data.sql`    | Seed-Daten (Addons, Kategorien)                          |
| `database/seeds/001_global-seed-data.sql`     | Dev-Seed (gleicher Inhalt wie 002)                       |
| `customer/fresh-install/005_pgmigrations.sql` | Migrations-Tracking für node-pg-migrate                  |

### Schritt 2: Backup

Compressed Binary-Backup (`--format=custom`). Restore mit:

```bash
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
  < database/backups/pre_reset_XXXXXXXX_XXXXXX.dump
```

### Schritt 3: Backend stoppen

Backend und Deletion Worker müssen gestoppt sein, damit keine Verbindungen zur leeren DB aufgebaut werden.

### Schritt 4: DROP SCHEMA

`DROP SCHEMA public CASCADE` löscht **alles**: Tabellen, ENUMs, Funktionen, Triggers, RLS Policies, Sequences. `CREATE SCHEMA public` erstellt ein leeres Schema.

### Schritt 5: `install.sh`

Führt in Reihenfolge aus:

| Datei                  | Was                                                      |
| ---------------------- | -------------------------------------------------------- |
| `000_users.sql`        | `app_user` erstellen/aktualisieren                       |
| `001_schema.sql`       | Komplettes Schema (Tabellen, RLS, Triggers, FK, Indexes) |
| `002_seed_data.sql`    | Seed-Daten (Addons, KVP-Kategorien, Asset-Kategorien)    |
| `003_extensions.sql`   | pg_stat_statements, pg_partman                           |
| `004_grants.sql`       | GRANTs für `app_user` auf alle Tabellen                  |
| `005_pgmigrations.sql` | Alle Migrationen als "applied" registrieren              |

**RLS wird komplett neu erstellt** — alle Policies sind in `001_schema.sql` enthalten.

### Schritt 6: Backend starten

Backend verbindet sich als `app_user` (mit RLS) zur frischen DB.

### Schritt 7: Test-Tenant

Erstellt via `POST /api/v2/signup`:

| Was       | Wert                                |
| --------- | ----------------------------------- |
| Tenant    | API Test GmbH (subdomain: `assixx`) |
| Root-User | info@assixx.com                     |
| Passwort  | `ApiTest12345!`                     |
| Addons    | Alle aktiviert (14 Tage Trial)      |

### Schritt 8: Verifikation

**Erwartete Werte:**

| Check        | Erwartet                 |
| ------------ | ------------------------ |
| Tabellen     | ~327 (inkl. Partitionen) |
| RLS Policies | ~121                     |
| Addons       | 22                       |
| Migrationen  | 114+                     |
| Tenants      | 1                        |
| Users        | 1                        |

---

## Erwartete Warnungen

Diese NOTICE-Meldungen sind **normal** und können ignoriert werden:

```
NOTICE: extension "pg_stat_statements" already exists, skipping
NOTICE: schema "partman" already exists, skipping
NOTICE: extension "pg_partman" already exists, skipping
```

Extensions überleben den `DROP SCHEMA` teilweise, weil sie im `pg_catalog` registriert sind.

---

## Wann diesen Reset verwenden?

| Situation                       | Empfehlung                                     |
| ------------------------------- | ---------------------------------------------- |
| Testdaten aufräumen             | Dieser Guide                                   |
| Vor einem Demo/Review           | Dieser Guide                                   |
| Nach fehlgeschlagener Migration | Dieser Guide + Backup prüfen                   |
| Nur Tenant-Daten löschen        | `DELETE FROM tenants CASCADE;` (Schema bleibt) |
| Nur Sequences resetten          | Siehe `HOW-TO-RESET-POSTGRESQL-ID.md`          |
| Production-Deployment           | `customer/fresh-install/install.sh` direkt     |

---

## Voraussetzungen

- Docker läuft (`docker ps` zeigt `assixx-postgres`)
- Doppler konfiguriert (oder `docker/.env` vorhanden)
- `customer/fresh-install/` ist aktuell (`sync-customer-migrations.sh` gelaufen)

---

## Troubleshooting

### "Container is not running"

```bash
cd docker && doppler run -- docker-compose up -d
```

### Backend startet nicht nach Reset

Backend-Logs prüfen:

```bash
docker logs assixx-backend --tail 50
```

Häufigste Ursache: `install.sh` nicht vollständig durchgelaufen. Erneut ausführen:

```bash
cd customer/fresh-install
APP_USER_PASSWORD="$(doppler secrets get DB_PASSWORD --plain)" ./install.sh
```

### RLS Policies fehlen

`install.sh` erstellt RLS automatisch. Verifizieren:

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';"
```

Falls 0: `install.sh` erneut mit `--schema-only` ausführen.

### psql-Befehl liefert keine Ausgabe, Exit 0

Wenn ein `docker exec assixx-postgres psql ... <<'SQL' ... SQL`-Heredoc stumm bleibt (kein Ergebnis, kein Fehler): Es fehlt `-i`. `docker exec` ohne `-i` leitet stdin nicht an den Container weiter — psql bekommt leeren Input, endet mit Exit 0. Lösung: `docker exec -i ...` oder besser `psql -c "..."` verwenden. Details: [HOW-TO-POSTGRESQL-CLI.md](./HOW-TO-POSTGRESQL-CLI.md#troubleshooting).

### Backup wiederherstellen

```bash
# Backend stoppen
cd docker && doppler run -- docker-compose stop backend deletion-worker

# Schema droppen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Backup einspielen
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
  < database/backups/pre_reset_XXXXXXXX_XXXXXX.dump

# GRANTs wiederherstellen (gehen beim Restore verloren!)
cd ../customer/fresh-install && ./install.sh --grants-only

# Backend starten
cd ../docker && doppler run -- docker-compose start backend deletion-worker
```

---

## Verwandte Dokumente

- [HOW-TO-CREATE-TEST-USER.md](./HOW-TO-CREATE-TEST-USER.md) — Test-Tenant erstellen
- [HOW-TO-RESET-POSTGRESQL-ID.md](./HOW-TO-RESET-POSTGRESQL-ID.md) — Einzelne Sequences resetten
- [HOW-TO-POSTGRESQL-CLI.md](./HOW-TO-POSTGRESQL-CLI.md) — psql-Patterns & Troubleshooting (Heredoc braucht `docker exec -i`)
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) — Migrations-Workflow
- [customer/README.md](../../customer/README.md) — Fresh Install Dokumentation
