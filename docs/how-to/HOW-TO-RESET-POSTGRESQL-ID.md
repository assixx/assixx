# How-To: PostgreSQL ID-Sequenz zurücksetzen

> Nach `TRUNCATE` startet die ID-Sequenz **nicht** automatisch bei 1.
> Dieses Dokument zeigt wie man sie korrekt resetted.

## Quick Reference

```sql
-- 1. Sequenz-Name herausfinden
SELECT pg_get_serial_sequence('tabellenname', 'id');

-- 2. Sequenz auf 1 resetten (nächster INSERT → ID 1)
SELECT setval('sequenzname', 1, false);

-- 3. Verifizieren
SELECT last_value, is_called FROM sequenzname;
-- Erwartung: last_value=1, is_called=f
```

## Konkretes Beispiel: audit_trail

```sql
-- Sequenz finden
SELECT pg_get_serial_sequence('audit_trail', 'id');
-- → public.audit_trail_partitioned_id_seq

-- Resetten
SELECT setval('audit_trail_partitioned_id_seq', 1, false);

-- Verifizieren
SELECT last_value, is_called FROM audit_trail_partitioned_id_seq;
```

## Achtung: Sequenznamen NIE raten

Partitionierte Tabellen verwenden `{tabelle}_partitioned_id_seq` statt `{tabelle}_id_seq`. Den Namen **immer** per `pg_get_serial_sequence()` nachschlagen — nie aus dem Tabellennamen ableiten.

```sql
-- ✅ Korrekt: Immer nachschlagen
SELECT pg_get_serial_sequence('root_logs', 'id');
-- → public.root_logs_partitioned_id_seq (NICHT root_logs_id_seq!)

-- ❌ Falsch: Namen raten
SELECT last_value FROM root_logs_id_seq;
-- ERROR: relation "root_logs_id_seq" does not exist
```

## Warum `setval()` statt `ALTER SEQUENCE`?

`ALTER SEQUENCE ... RESTART WITH 1` funktioniert bei **partitionierten Tabellen** nicht zuverlässig — die Sequenz-Metadaten werden intern nicht korrekt aktualisiert.

`setval()` schreibt direkt in die Sequenz-Metadaten und funktioniert immer.

## Der dritte Parameter (`is_called`)

```sql
SELECT setval('seq', 1, false);  -- Nächster INSERT → ID 1
SELECT setval('seq', 1, true);   -- Nächster INSERT → ID 2
```

| Wert    | Bedeutung                        | Nächste ID |
| ------- | -------------------------------- | ---------- |
| `false` | "1 wurde noch **nicht** benutzt" | **1**      |
| `true`  | "1 wurde **bereits** benutzt"    | **2**      |

## Docker-Befehl (Copy-Paste)

```bash
# audit_trail
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT setval('audit_trail_partitioned_id_seq', 1, false);"

# root_logs
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT setval(pg_get_serial_sequence('root_logs', 'id'), 1, false);"
```
