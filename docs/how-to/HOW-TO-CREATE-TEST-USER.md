# Test-Tenant erstellen (Development)

> Nach einem Fresh Install ist die DB leer — kein Tenant, kein User. Dieses Script erstellt den apitest-Tenant über die Signup API.

**Stand:** 2026-03-10

---

## Quick Start

```bash
./scripts/create-test-tenant.sh
```

---

## Was passiert?

Das Script ruft `POST /api/v2/signup` auf. Die Signup API erstellt automatisch:

| Was       | Wert                                            |
| --------- | ----------------------------------------------- |
| Tenant    | API Test GmbH (subdomain: `apitest`)            |
| Root-User | admin@apitest.de mit `has_full_access = true`   |
| Passwort  | `ApiTest12345!` (bcrypt-gehasht durch die API)  |
| Adresse   | Musterstraße 42, 10115 Berlin, DE               |
| Features  | Alle 20 Features aktiviert (14 Tage Trial)      |
| Plan      | Basic (Trial-Status)                            |
| Audit-Log | Registrierung wird in `root_logs` protokolliert |

---

## Voraussetzungen

1. Fresh Install muss gelaufen sein (`customer/fresh-install/install.sh`)
2. Backend muss laufen (`http://localhost:3000/health`)
3. Kein Tenant mit Subdomain `apitest` darf existieren

---

## Credentials

```
URL:      http://localhost:5173/login
Domain:   apitest
Email:    admin@apitest.de
Passwort: ApiTest12345!
Rolle:    Root (has_full_access = true)
Adresse:  Musterstraße 42, 10115 Berlin, DE
```

---

## Warum über die API und nicht per SQL?

Die Signup API übernimmt automatisch:

- **Passwort-Hashing** (bcrypt, salt 12) — kein Platzhalter-Hash
- **`has_full_access = true`** für Root — kein vergessenes Pflichtfeld
- **`employee_number`** + **`employee_id`** — automatisch generiert
- **`tenant_addons`** — alle Addons aktiviert mit Ablaufdatum
- **Audit-Log** — Registrierung protokolliert
- **UUID** — UUIDv7 automatisch vergeben

Manuelles SQL erfordert ~15 Spalten korrekt zu setzen und ist fehleranfällig.

---

## Vollständiger Fresh Install Workflow

```bash
# 1. Sync (während DB noch intakt)
./scripts/sync-customer-migrations.sh

# 2. Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 > database/backups/backup_$(date +%Y%m%d_%H%M%S).dump

# 3. Backend stoppen
cd docker && doppler run -- docker-compose stop backend deletion-worker

# 4. DB droppen + Fresh Install
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd ../customer/fresh-install
APP_USER_PASSWORD="$(doppler secrets get DB_PASSWORD --plain)" ./install.sh

# 5. Backend starten
cd ../docker && doppler run -- docker-compose start backend deletion-worker

# 6. Test-Tenant erstellen
cd .. && ./scripts/create-test-tenant.sh
```

---

## Troubleshooting

### "Backend nicht erreichbar"

```bash
cd docker && doppler run -- docker-compose up -d
# 30 Sekunden warten, dann erneut versuchen
```

### "Tenant existiert bereits"

```bash
# Option A: Nichts tun — Tenant ist schon da
# Option B: Tenant löschen und neu erstellen
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DELETE FROM tenants WHERE subdomain = 'apitest' CASCADE;"
./scripts/create-test-tenant.sh
```

### "Signup fehlgeschlagen"

Backend-Logs prüfen:

```bash
docker logs assixx-backend --tail 50
```
