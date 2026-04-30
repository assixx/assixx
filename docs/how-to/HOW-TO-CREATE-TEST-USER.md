# Test-Tenants erstellen (Development)

> Nach einem Fresh Install ist die DB leer — kein Tenant, kein User. Es gibt zwei Wege, Dev-Test-Daten zu erzeugen. Der **SQL-Seed-Weg ist kanonisch** (vollständige 5-Tenant-Fixture, fixed IDs, atomar). Die Signup-API-Variante ist ein Smoke-Test für die `/auth/signup`-Route — kein Ersatz für den Seed.

**Stand:** 2026-04-30

---

## Empfohlen: SQL Seed (alle 5 Dev-Tenants)

```bash
doppler run -- pnpm run db:seed
```

Erzeugt 5 Tenants in einer einzigen Transaktion — alle mit `is_active=1`, Trial-Addons und (außer `unverified-e2e`) verifizierten Domains.

| ID  | Subdomain        | Root-User                | Passwort           | Domain-Status | Verwendet für                   |
| --- | ---------------- | ------------------------ | ------------------ | ------------- | ------------------------------- |
| 1   | `assixx`         | info@assixx.com          | `ApiTest12345!`    | verified      | API-Tier-2/3/4 Workhorse        |
| 2   | `firma-a`        | test@firma-a.test        | `TestFirmaA12345!` | verified      | RLS Cross-Tenant-Isolation      |
| 3   | `firma-b`        | test@firma-b.test        | `TestFirmaB12345!` | verified      | Tenant-Subdomain-Routing-Tests  |
| 4   | `scs`            | test@scs-technik.de      | `TestScs12345!`    | verified      | Persönlicher Dev-Tenant         |
| 5   | `unverified-e2e` | test@unverified-e2e.test | `Unverified12345!` | **pending**   | Playwright unverifizierter-Flow |

**Voraussetzung:** Komplett leere `tenants`-Tabelle. Entweder:

- `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + Fresh Install (siehe [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md)), oder
- `TRUNCATE TABLE tenants RESTART IDENTITY CASCADE;` (Schema bleibt, Daten weg)

Der Seed nutzt **plain INSERT ohne ON CONFLICT** und bricht bei subdomain-unique-Conflict ab — _by design, fail-loud_. Re-seeden ohne TRUNCATE ist nicht möglich.

> **Warum fixed IDs (1–5) wichtig sind:** API-Tests in `backend/test/` setzen die Tenant-IDs hart voraus — z.B. `tenant-domains.api.test.ts:895` queryt `WHERE tenant_id=2 AND domain='firma-a.test'`, `shift-handover.api.test.ts:677` sucht `teams WHERE tenant_id <> 1`. `RESTART IDENTITY` nach `DROP SCHEMA` garantiert, dass `firma-a` immer auf `id=2` landet.

> **2026-04 Migration:** Tenant 1 hieß früher `apitest` (Subdomain) mit Domain `apitest.de` — fremde reale Domain, Catch-All-Risiko bei Password-Reset / Notification-Mails. Migration auf projekt-eigenes `assixx`/`assixx.com`. `apitest` darf nirgendwo im Stack mehr auftauchen (Code, Docs, DB).

---

## Alternative: Nur `assixx` via Signup-API

```bash
./scripts/create-test-tenant.sh
```

Ruft `POST /api/v2/signup` auf — testet den live Signup-Flow durchs gesamte System (Controller → Service → DB → Audit-Log). Erzeugt nur den `assixx`-Tenant (id wird automatisch vergeben — _nicht_ deterministisch fixed). Verwende dies nur für:

- Smoke-Test der Signup-API nach Backend-Refactor
- Frontend-Dev ohne Cross-Tenant-Tests
- **Nicht** zusätzlich zu `pnpm run db:seed` — der Seed legt assixx schon an, das Script erkennt das und exited.

### Bekannter Quirk: `is_active=0` nach Signup

Auf dem `feat/add-2FA`-Branch (Stand 2026-04-30) legt der Signup-Service den Root-User mit `is_active=0` an — die Verifikations-Mail erreicht Mailpit pending nicht zuverlässig. `JwtAuthGuard` (ADR-005) lehnt Logins mit `403 "Ihr Account ist nicht aktiv"` ab.

**Quick-Fix nach Script-Lauf:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "UPDATE users SET is_active = 1 WHERE email = 'info@assixx.com' AND tenant_id = 1;"
```

> **WHY:** `IS_ACTIVE.ACTIVE = 1` (siehe `@assixx/shared/constants` + DATABASE-MIGRATION-GUIDE §`is_active Convention`). `assixx_user` ist BYPASSRLS, der UPDATE braucht keinen Tenant-Context.

> **Langfristige Lösung:** Wird obsolet durch konsistente Verwendung von `pnpm run db:seed` — der Seed setzt `is_active=1` direkt. Tracker: `feat/add-2FA` Verifikations-Mail-Pipeline.

---

## Vollständiger Fresh Install Workflow

Detailliert in [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md). Empfohlene Reihenfolge:

```bash
# 1. Schema-Stand sichern (solange DB intakt)
./scripts/sync-customer-migrations.sh

# 2. Backup
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/backup_$(date +%Y%m%d_%H%M%S).dump

# 3. Backend stoppen
cd docker && doppler run -- docker-compose stop backend deletion-worker

# 4. Schema droppen + Identity reset
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 5. Fresh Install (Schema + Grants + Migration-Tracking)
cd ../customer/fresh-install
APP_USER_PASSWORD="$(doppler secrets get DB_PASSWORD --plain)" ./install.sh

# 6. Backend starten
cd ../docker && doppler run -- docker-compose start backend deletion-worker

# 7. Dev-Tenants seeden (5 Tenants atomar)
cd .. && doppler run -- pnpm run db:seed

# 8. Verifizieren (erwartet: Tenants=5, Users=5)
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT COUNT(*) AS tenants FROM tenants UNION ALL SELECT COUNT(*) AS users FROM users;"
```

---

## Troubleshooting

### "Tenant 'assixx' existiert bereits"

Der Seed wurde schon angewendet, oder du hast `create-test-tenant.sh` parallel laufen lassen. Vor Re-Seed:

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "TRUNCATE TABLE tenants RESTART IDENTITY CASCADE;"
doppler run -- pnpm run db:seed
```

### Backend nicht erreichbar

```bash
cd docker && doppler run -- docker-compose up -d
# 30 Sekunden warten, dann erneut versuchen
```

### Login: "Ihr Account ist nicht aktiv" (HTTP 403)

Nur beim Signup-API-Path — siehe [Quick-Fix](#bekannter-quirk-is_active0-nach-signup) oben. `pnpm run db:seed` umgeht das komplett.

### Seed bricht ab mit `duplicate key value violates unique constraint`

Die `tenants`-Tabelle ist nicht leer. Prüfen:

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT id, subdomain, status FROM tenants ORDER BY id;"
```

Wenn unerwartete Rows da sind: TRUNCATE (siehe oben) oder DROP SCHEMA (vollständiger Reset).

---

## Verwandte Dokumente

- [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md) — Vollständiger Fresh-Install-Reset (Schema + Seed)
- [HOW-TO-REMOVE-ONE-TENANT.md](./HOW-TO-REMOVE-ONE-TENANT.md) — Einzelnen Tenant löschen
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) — Migrations-Workflow
- `database/seeds/002_test-tenants-dev-only.sql` — Source of truth für die 5 Dev-Tenants
- `scripts/create-test-tenant.sh` — Signup-API-Smoke-Test (Alternative-Path)
