# How-To: Einen einzelnen Tenant löschen

> Komplettes Entfernen EINES Tenants inkl. aller zugehörigen Daten (Users, Addons, Documents, etc.). Für Test-Tenant-Cleanup, fehlgeschlagene Signups, GDPR-Löschanfragen.
> **Nicht** für kompletten DB-Reset — dafür siehe [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md).

**Stand:** 2026-04-19

---

## ⚠️ Vor jedem Schritt lesen

1. **Backup ist Pflicht.** Nicht "mach ich später". Siehe [DATABASE-MIGRATION-GUIDE.md §HARD BLOCK](../DATABASE-MIGRATION-GUIDE.md).
2. **Niemals `TRUNCATE`.** TRUNCATE kennt kein `WHERE` — löscht immer die ganze Tabelle. Für Tenant-Scope-Löschung ist `DELETE FROM tenants WHERE id = X` der einzige richtige Weg.
3. **Niemals direkt aus Verzeichnis löschen.** Das Schema schützt sich via Foreign-Key-Constraints — in der richtigen Reihenfolge löschen lassen, NICHT Tabellen einzeln truncaten.
4. **Nur `assixx_user` (BYPASSRLS).** `app_user` hat RLS aktiv, würde cross-tenant-Queries blockieren.

---

## Quick Start

```bash
cd /home/scs/projects/Assixx
TENANT_ID=4   # ← hier die zu löschende Tenant-ID

# 1. Tenant-Existenz + Daten-Umfang prüfen (read-only)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT id, subdomain, company_name, created_at FROM tenants WHERE id = ${TENANT_ID};
SELECT 'users' AS tbl, COUNT(*) FROM users WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'tenant_addons', COUNT(*) FROM tenant_addons WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'tenant_domains', COUNT(*) FROM tenant_domains WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'departments', COUNT(*) FROM departments WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'documents', COUNT(*) FROM documents WHERE tenant_id = ${TENANT_ID}
ORDER BY 1;
"

# 2. Full-DB-Backup (MANDATORY)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
  --format=custom --compress=9 \
  > database/backups/pre_delete_tenant${TENANT_ID}_${TIMESTAMP}.dump

# 3. DELETE in Transaction (users zuerst, dann tenant)
docker exec assixx-postgres psql -U assixx_user -d assixx -v ON_ERROR_STOP=1 -c "
BEGIN;
DELETE FROM users WHERE tenant_id = ${TENANT_ID};
DELETE FROM tenants WHERE id = ${TENANT_ID};
SELECT 'tenants(id=${TENANT_ID})' AS check, COUNT(*)::text FROM tenants WHERE id = ${TENANT_ID}
UNION ALL SELECT 'users(tenant_id=${TENANT_ID})', COUNT(*)::text FROM users WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'tenant_addons', COUNT(*)::text FROM tenant_addons WHERE tenant_id = ${TENANT_ID}
UNION ALL SELECT 'tenant_domains', COUNT(*)::text FROM tenant_domains WHERE tenant_id = ${TENANT_ID};
COMMIT;
"
```

**Erwartete Ausgabe Schritt 3:** Alle `remaining`-Counts = 0, endet mit `COMMIT`.

---

## Warum die Reihenfolge? — FK-Cascade-Situation

Assixx's `tenants.id` wird von **115+ Tabellen** referenziert. Delete-Regeln sind **nicht einheitlich**:

| Delete-Regel | Anzahl Tabellen | Verhalten bei `DELETE FROM tenants`                                  |
| ------------ | --------------- | -------------------------------------------------------------------- |
| **CASCADE**  | ~95             | Auto-Delete aller Rows mit passender tenant_id ✅                    |
| **RESTRICT** | ~18             | **Blockiert** DELETE, wenn Rows existieren ❌                        |
| **SET NULL** | 2               | tenant_id wird auf NULL gesetzt (legal_holds, tenant_deletion_queue) |

### Die RESTRICT-Tabellen

```sql
-- Alle FK-Regeln auf tenants.id auflisten
SELECT tc.table_name, kcu.column_name, rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'tenants' AND ccu.column_name = 'id'
ORDER BY rc.delete_rule, tc.table_name;
```

RESTRICT-Tabellen (Stand 2026-04-19):

- `users`
- `api_keys`
- `assets`, `asset_documents`, `asset_maintenance_history`, `asset_metrics`
- `blackboard_confirmations`
- `calendar_events`, `calendar_recurring_patterns`
- `deletion_dry_run_reports`
- `departments`
- `document_permissions`, `document_shares`
- `kvp_comments`, `kvp_votes`
- `oauth_tokens`
- `tenant_webhooks`

**Pro RESTRICT-Tabelle mit Daten → eigener `DELETE` VOR dem `DELETE FROM tenants`.**
In 99% aller Fälle ist nur `users` betroffen (Tenant-Admin). Testet das mit der Pre-Check-Query oben.

### users.id-Kette (2nd-Level)

Beim `DELETE FROM users WHERE tenant_id = X` können weitere Blocker auftauchen, weil **`users.id`** von weiteren Tabellen referenziert wird:

- 28 Tabellen haben RESTRICT (`admin_logs`, `surveys.created_by`, `notifications.created_by`, `api_keys.created_by`, …)
- 17 Tabellen haben NO ACTION (= Default RESTRICT)
- 32 CASCADE + 37 SET NULL (harmlos)

→ Wenn der Tenant-Admin Content erstellt hat (Surveys, Docs, etc.), blockt der `DELETE FROM users`.
Lösung siehe **Troubleshooting**.

---

## Troubleshooting

### Problem 1: `DELETE FROM tenants` blockiert

```
ERROR: update or delete on table "tenants" violates RESTRICT setting of foreign key constraint "fk_X_tenant" on table "X"
DETAIL: Key (id)=(4) is referenced from table "X".
```

**Ursache:** Tabelle `X` ist RESTRICT und hat noch Rows für diesen Tenant.

**Fix:** Reihenfolge — erst aus `X` löschen, dann aus `tenants`:

```sql
BEGIN;
DELETE FROM X WHERE tenant_id = 4;
DELETE FROM tenants WHERE id = 4;
COMMIT;
```

### Problem 2: `DELETE FROM users` blockiert

```
ERROR: update or delete on table "users" violates foreign key constraint "fk_Y_created_by" on table "Y"
```

**Ursache:** Der User hat Content in `Y` erstellt (z.B. `surveys`, `notifications`), und `Y.created_by` ist RESTRICT.

**Fix (in der Transaction):**

```sql
BEGIN;
-- 1. Content des Users löschen (Y hat meist CASCADE auf tenant_id → wird sowieso weg)
DELETE FROM Y WHERE tenant_id = 4;
-- 2. Dann Users
DELETE FROM users WHERE tenant_id = 4;
-- 3. Dann Tenant
DELETE FROM tenants WHERE id = 4;
COMMIT;
```

**Vollständige Blocker-Analyse** (wenn unklar welche Tabellen stören):

```sql
-- Zeigt welche RESTRICT-Tabellen für diesen Tenant Rows haben
SELECT c.table_name, rc.delete_rule, (xpath('/row/count/text()',
  query_to_xml(format('SELECT COUNT(*) FROM %I WHERE tenant_id = 4', c.table_name),
  true, true, '')))[1]::text::int AS rows_for_tenant
FROM information_schema.columns c
JOIN information_schema.referential_constraints rc ON rc.constraint_name IN (
  SELECT constraint_name FROM information_schema.key_column_usage
  WHERE table_name = c.table_name AND column_name = c.column_name
)
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
  AND rc.delete_rule = 'RESTRICT'
  AND c.table_name NOT LIKE '%_default'
ORDER BY c.table_name;
```

### Problem 3: Transaction bleibt hängen (offene Backend-Verbindungen)

Wenn der Backend während DELETE Queries feuert, kann eine Row-Lock-Kollision entstehen. Lösung:

```bash
# Backend kurz stoppen
cd docker && doppler run -- docker-compose stop backend deletion-worker

# DELETE durchführen

# Backend wieder starten
cd docker && doppler run -- docker-compose start backend deletion-worker
```

### Problem 4: `docker exec … psql <<'SQL'` liefert keine Ausgabe

Bekannter Heredoc-Stderr-Bug: `docker exec` ohne `-i` leitet stdin nicht weiter → psql liest leeren Input → Exit 0 ohne Output.
**Fix:** `docker exec -i …` oder `psql -c "…"` mit inline-SQL.

---

## Rollback

Wenn ein DELETE schiefgegangen ist oder im Nachgang revidiert werden muss:

```bash
# 1. Backend stoppen
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose stop backend deletion-worker

# 2. Schema resetten
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Backup einspielen
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
  < /home/scs/projects/Assixx/database/backups/pre_delete_tenantX_YYYYMMDD_HHMMSS.dump

# 4. GRANTs wiederherstellen (pg_restore entfernt sie per `--no-privileges`)
cd /home/scs/projects/Assixx/customer/fresh-install && ./install.sh --grants-only

# 5. Backend starten
cd ../docker && doppler run -- docker-compose start backend deletion-worker
```

---

## Wann NICHT diesen Guide verwenden?

| Situation                      | Richtiger Weg                                                       |
| ------------------------------ | ------------------------------------------------------------------- |
| Komplette DB resetten          | [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md)        |
| Tenant soft-löschen (Archiv)   | `UPDATE tenants SET is_active = 4` (IS_ACTIVE.DELETED)              |
| Mehrere Tenants löschen        | Schleife über diesen Guide — jeden einzeln, jeder mit Pre-Check     |
| Tenant-Deletion via Backend-UI | `tenant_deletion_queue` + Deletion-Worker (zeitversetzt, mit Audit) |
| Production-Kundendaten         | **Immer** UI/API + `tenant_deletion_queue` — nie raw SQL            |

---

## Pre-Check-Checklist

Vor dem DELETE:

- [ ] **Tenant-ID bestätigt** — `SELECT id, subdomain, company_name FROM tenants WHERE id = X;` geprüft
- [ ] **Backup erstellt** — `.dump`-Datei in `database/backups/` vorhanden
- [ ] **Blocker-Tabellen identifiziert** — RESTRICT-Tabellen mit Rows bekannt
- [ ] **Backend-State klar** — entweder gestoppt (sicherste Option) oder leichte Last (Lock-Kollision unwahrscheinlich)
- [ ] **Explizites User-OK** — "Ja, DELETE ausführen", nicht nur "ok" (KAIZEN-Manifest #8)

---

## Warum ist `DELETE FROM tenants WHERE id = X` überhaupt erlaubt?

Die `tenants`-Tabelle ist **nicht** in der "Protected Tables"-Liste (im Gegensatz zu `addons`, siehe [DATABASE-MIGRATION-GUIDE.md §Protected Tables](../DATABASE-MIGRATION-GUIDE.md)).
Das Schema ist bewusst so designed, dass Tenant-Löschung möglich ist — für GDPR-Compliance, Test-Cleanup und Subscription-Cancellations.
Die Sicherheit kommt aus: (1) BYPASSRLS nur für `assixx_user`, (2) UI/API nutzt `tenant_deletion_queue` mit Audit-Trail, (3) dieser Guide requires explicit dev-approval.

---

## Verwandte Dokumente

- [HOW-TO-RESET-DB-PROPERLY.md](./HOW-TO-RESET-DB-PROPERLY.md) — Kompletter DB-Reset
- [HOW-TO-RESET-POSTGRESQL-ID.md](./HOW-TO-RESET-POSTGRESQL-ID.md) — Sequences resetten
- [HOW-TO-POSTGRESQL-CLI.md](./HOW-TO-POSTGRESQL-CLI.md) — psql-Patterns, Heredoc-Falle
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) — Backup, Restore, Protected Tables
- [ADR-019](../infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md) — RLS, Triple-User-Model (warum `assixx_user` für diese Operation)
