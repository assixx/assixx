# ADR-025: pg_stat_statements — Query Performance Monitoring

| Metadata                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| **Status**              | Accepted                                           |
| **Date**                | 2026-02-16                                         |
| **Decision Makers**     | SCS Technik                                        |
| **Affected Components** | PostgreSQL, Backend Performance, DevOps Monitoring |

---

## Context

### Das Problem: Keine Query-Level Performance-Sichtbarkeit

Assixx hat 109 Tabellen, 89 RLS-Policies und ein wachsendes Feature-Set (Vacation, Shifts, KVP, Chat, Calendar, Blackboard). Die Backend-Services führen hunderte verschiedene SQL-Statements aus — aber bisher gab es **keine systematische Methode**, um zu erkennen:

1. **Welche Queries die meiste Gesamtzeit verbrauchen** — „Death by a Thousand Cuts"-Pattern
2. **Welche Queries schlecht cachen** — fehlende Indexe, Sequential Scans auf große Tabellen
3. **Welche Queries instabile Performance haben** — hohe Standardabweichung = Latenzschwankungen
4. **Ob die Shared Buffers ausreichen** — globale Cache-Hit-Ratio als Gesundheitsindikator

### Warum jetzt?

- **109 Tabellen + RLS**: Jede Query geht durch `SET LOCAL app.tenant_id = $1` + RLS-Policy-Evaluation — Performance-Overhead muss messbar sein
- **Audit Trail Interceptor** (ADR-009): Loggt JEDEN HTTP Request → erzeugt hohe Insert-Last → muss überwacht werden
- **Vacation System** (ADR-023): 7 neue Tabellen + 26 Endpoints → Performance-Baseline nötig vor Go-Live
- **Produktionsvorbereitung**: Ohne Query-Monitoring ist Performance-Debugging in Production blind

### Anforderungen

- Kein externer Service (kein pganalyze, kein Datadog) — Self-Hosted PostgreSQL in Docker
- Kein Performance-Overhead im Hot Path (< 1% CPU Impact)
- Normalisierte Query-Texte (Parameterwerte abstrahiert → `$1`, `$2`)
- Historische Vergleichbarkeit (Reset-Funktion für Before/After Benchmarks)
- Kompatibel mit bestehendem Observability-Stack (Grafana, Loki, Prometheus)

---

## Decision

### pg_stat_statements 1.11 als Standard-Monitoring-Extension

**Gewählt: PostgreSQL-native `pg_stat_statements` Extension**

Die Extension ist bereits installiert und aktiv:

```
PostgreSQL 17.8 (Alpine)
pg_stat_statements: 1.11 (= neueste Version für PG 17)
shared_preload_libraries: pg_stat_statements
```

### Konfiguration (aktueller Stand)

```ini
# postgresql.conf (via Docker)
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 5000          # Default, ausreichend für 1.637 tracked statements
pg_stat_statements.track = top         # Nur Top-Level-Statements (nicht innerhalb von Funktionen)
pg_stat_statements.track_utility = on  # Utility-Commands (CREATE, ALTER, etc.) tracken
pg_stat_statements.track_planning = off # Planning-Stats deaktiviert (Performance-Overhead)
compute_query_id = auto                # Automatische Query-ID-Generierung
```

### Versions-Status

| Komponente         | Installiert | Neueste für PG 17 | Status  |
| ------------------ | ----------- | ----------------- | ------- |
| PostgreSQL         | 17.8        | 17.8 (2026-02-12) | Aktuell |
| pg_stat_statements | 1.11        | 1.11              | Aktuell |

**PG 18** würde Version 1.12 bringen (mit neuen Feldern), ist aber noch kein Upgrade-Ziel.

### Monitoring-Queries (Standard-Repertoire)

#### 1. Top 10 nach Gesamtzeit (Hot Queries)

```sql
SELECT
  left(regexp_replace(query, E'[\n\r]+', ' ', 'g'), 100) AS query,
  calls, total_exec_time::numeric(10,2) AS total_ms,
  mean_exec_time::numeric(10,4) AS mean_ms, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

#### 2. Cache-Hit-Probleme (< 95%)

```sql
SELECT
  left(regexp_replace(query, E'[\n\r]+', ' ', 'g'), 100) AS query,
  calls, shared_blks_read, shared_blks_hit,
  (100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric(5,1) AS hit_pct
FROM pg_stat_statements
WHERE (shared_blks_hit + shared_blks_read) > 10
  AND (100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0)) < 95
ORDER BY shared_blks_read DESC;
```

#### 3. Instabile Queries (hoher Variationskoeffizient)

```sql
SELECT
  left(regexp_replace(query, E'[\n\r]+', ' ', 'g'), 100) AS query,
  calls, mean_exec_time::numeric(10,4) AS mean_ms,
  (stddev_exec_time / NULLIF(mean_exec_time, 0))::numeric(5,2) AS cv
FROM pg_stat_statements
WHERE calls >= 10 AND mean_exec_time > 1
ORDER BY (stddev_exec_time / NULLIF(mean_exec_time, 0)) DESC LIMIT 10;
```

#### 4. Baseline Reset (vor Performance-Tests)

```sql
SELECT pg_stat_statements_reset();
```

### Analyse-Ergebnisse (Baseline 2026-02-16)

#### Globale Gesundheit

| Metrik                  | Wert       | Bewertung                    |
| ----------------------- | ---------- | ---------------------------- |
| Tracked Statements      | 1.637      | OK (Limit: 5.000)            |
| Total Calls             | 521.079    | —                            |
| Total Execution Time    | 41,16s     | Seit Reset 2026-02-11        |
| Overall Cache Hit Ratio | **99,57%** | Exzellent (Ziel: > 99%)      |
| Temp Block Writes       | **0**      | Perfekt — kein Disk-Spilling |
| Deallocations           | **0**      | Statement-Limit nie erreicht |

#### Top 5 nach Gesamtzeit

| Query (gekürzt)                          | Calls  | Total ms | Mean ms | Hit % |
| ---------------------------------------- | ------ | -------- | ------- | ----- |
| `INSERT INTO audit_trail`                | 11.836 | 6.297    | 0,53    | 99,2  |
| `pg_total_relation_size` (Introspection) | 18     | 2.613    | 145,19  | 100,0 |
| FK-Constraint Analysis (einmalig)        | 1      | 1.447    | 1.447   | 100,0 |
| Health Check `pg_stat_activity`          | 7.491  | 1.366    | 0,18    | 100,0 |
| `DELETE FROM teams` (API Tests)          | 96     | 1.302    | 13,56   | 99,1  |

#### Auffälligkeiten

**1. Audit Trail dominiert (15% der Gesamtzeit)**

- 11.836 INSERT-Aufrufe = jeder HTTP Request
- 0,53ms Mean ist akzeptabel, aber Volumen macht es zum #1 Consumer
- **Handlungsbedarf:** Keine sofortige Aktion — bei steigender Last Batch-Insert evaluieren

**2. COPY-Exports mit katastrophaler Cache-Hit-Ratio**

- `COPY audit_trail_2026_02`: **4,1%** Hit Rate
- `COPY root_logs_2026_01`: **3,4%** Hit Rate
- **Ursache:** Sequential Full-Table-Scan bei `pg_dump` oder Export
- **Handlungsbedarf:** Erwartet bei Exports — kein Bug, aber Export-Operationen nicht während Peak-Hours

**3. Root-Logs COUNT mit 6-fach JOIN (92,9% Hit)**

- `SELECT COUNT(DISTINCT rl.id) FROM root_logs rl LEFT JOIN users ... LEFT JOIN user_departments ... LEFT JOIN departments ... LEFT JOIN areas ... LEFT JOIN user_teams ... LEFT JOIN teams`
- 93 Calls, 1.409 Block Reads
- **Handlungsbedarf:** Materialized View oder separater Counter erwägen wenn > 1000 Calls

**4. Audit Trail COUNT bei 61,6% Hit Rate**

- `SELECT COUNT(*) FROM audit_trail WHERE tenant_id = $1 AND created_at >= $2`
- 48 Calls, 208 Block Reads vs. 334 Hits
- **Handlungsbedarf:** BRIN-Index auf `created_at` prüfen (Partitioned Table nutzt bereits Monthly Partitions)

**5. `DELETE FROM teams/departments` mit hoher Varianz**

- Teams DELETE: CV = 0,87 (einige Deletes 5-10x langsamer als Durchschnitt)
- **Ursache:** FK-Cascades auf `shift_favorites`, `user_teams`, `shift_plans`, etc.
- **Handlungsbedarf:** Nur in API Tests relevant — kein Production-Problem

**6. `SELECT EXISTS (SELECT FROM pg_tables)` — 704 Calls**

- Migration/Schema-Check — läuft bei jedem Backend-Start oder Migration-Run
- **Handlungsbedarf:** Kein Production-Problem, aber bei Startup-Optimierung relevant

**7. `pg_catalog.unnest` — 285.056 Calls**

- Höchste Aufruffrequenz aller Statements
- 0,0008ms Mean — extrem schnell
- **Ursache:** Parametrisierte `IN ($1, $2, ...)` Clauses werden intern als `unnest` ausgeführt
- **Handlungsbedarf:** Keiner — völlig normal und performant

---

## Alternatives Considered

### 1. pganalyze (SaaS)

| Pro                        | Contra                             |
| -------------------------- | ---------------------------------- |
| Automatische Query-Analyse | Kostenpflichtig (ab $500/mo)       |
| EXPLAIN-Plan-Sammlung      | Externe Datenübertragung           |
| Alerting auf Slow Queries  | Overkill für Single-Instance Setup |

**Verworfen:** Kein Self-Hosted, Kostenfaktor, Datenschutz (Multi-Tenant SaaS mit deutschen Industriekunden).

### 2. pg_stat_monitor (Percona)

| Pro                                 | Contra                                           |
| ----------------------------------- | ------------------------------------------------ |
| Histogramme statt nur Mean/Stddev   | Nicht in Standard-PG-Image enthalten             |
| Top-Query-Tracking mit Zeitfenstern | Erfordert Custom Docker Image                    |
| Bucket-basierte Analyse             | Weniger Community-Support als pg_stat_statements |

**Verworfen:** Custom Docker Image nötig, erhöhte Maintenance-Last, Standard-Extension reicht für aktuelle Anforderungen.

### 3. Application-Level Query Logging (Pino)

| Pro                         | Contra                                            |
| --------------------------- | ------------------------------------------------- |
| Volle Kontrolle über Format | Kein Query-Normalisierung (jede Variante separat) |
| Bereits in Loki/Grafana     | Kein Block-Level I/O Tracking                     |
| Kein DB-Extension nötig     | Performance-Overhead durch String-Serialisierung  |

**Verworfen:** Keine Cache-Hit/Miss-Analyse möglich, keine WAL-Statistiken, kein Planning-Time-Tracking.

### 4. Prometheus + pg_exporter

| Pro                              | Contra                                       |
| -------------------------------- | -------------------------------------------- |
| Integration in bestehenden Stack | Braucht zusätzlichen Exporter-Container      |
| Alerting via Grafana             | Query-Text nicht in Prometheus speicherbar   |
| Historische Metriken             | pg_stat_statements trotzdem als Quelle nötig |

**Entscheidung:** Nicht verworfen — **zukünftige Ergänzung**. `pg_exporter` kann pg_stat_statements-Metriken nach Prometheus scrapen. Aktuell: manuelle Analyse reicht.

---

## Consequences

### Positive

1. **Sofortige Sichtbarkeit** — Jede Query ist messbar (Calls, Time, Rows, Cache, WAL)
2. **Null-Overhead-Installation** — Bereits aktiv, keine Konfigurationsänderung nötig
3. **Query-Normalisierung** — `WHERE id = 42` und `WHERE id = 99` werden zu `WHERE id = $1` zusammengefasst
4. **Baseline-Fähigkeit** — `pg_stat_statements_reset()` vor/nach Änderungen für A/B-Vergleiche
5. **Produktionsreife** — 99,57% Cache Hit, 0 Temp Writes, 0 Deallocations — DB ist gesund
6. **Keine externen Kosten** — PostgreSQL-native Extension, kein SaaS-Vendor

### Negative

1. **Kein automatisches Alerting** — Manuelle Query-Analyse erforderlich (bis Prometheus-Integration)
2. **Kein EXPLAIN-Plan-Tracking** — Nur Statistiken, keine Query Plans (dafür auto_explain Extension nötig)
3. **Shared Memory Verbrauch** — ~5.000 Statement-Slots belegen konstant RAM (minimal)
4. **Kein Real-Time Dashboard** — Momentan keine Grafana-Integration (nur CLI/psql)

### Empfohlene nächste Schritte

| Priorität | Maßnahme                                        | Aufwand |
| --------- | ----------------------------------------------- | ------- |
| Niedrig   | BRIN-Index auf `audit_trail` Partitionen prüfen | 1h      |
| Niedrig   | Root-Logs COUNT-Query optimieren (6 JOINs)      | 2h      |
| Mittel    | Grafana Dashboard für pg_stat_statements        | 4h      |
| Mittel    | pg_exporter Container für Prometheus-Scraping   | 3h      |
| Niedrig   | `track_planning = on` temporär für Plan-Analyse | 15min   |

---

## Verification

| Szenario                           | Erwartet                   | Status    |
| ---------------------------------- | -------------------------- | --------- |
| Extension installiert + geladen    | `installed_version = 1.11` | Bestätigt |
| `shared_preload_libraries` gesetzt | `pg_stat_statements`       | Bestätigt |
| Version aktuell für PG 17          | 1.11 = neueste             | Bestätigt |
| Globale Cache Hit Ratio > 99%      | 99,57%                     | Bestätigt |
| Keine Temp Block Writes            | 0                          | Bestätigt |
| Keine Statement Deallocations      | 0                          | Bestätigt |
| Baseline seit 2026-02-11 verfügbar | `stats_reset` korrekt      | Bestätigt |

---

## References

- [PostgreSQL pg_stat_statements Dokumentation](https://www.postgresql.org/docs/17/pgstatstatements.html)
- [ADR GitHub — Architecture Decision Records](https://adr.github.io/)
- [ADR-009: Central Audit Logging](./ADR-009-central-audit-logging.md) — Audit Trail als Top-Consumer identifiziert
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) — node-pg-migrate Schema-Checks
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS-Overhead-Monitoring
- [ADR-023: Vacation Request Architecture](./ADR-023-vacation-request-architecture.md) — 7 neue Tabellen, Performance-Baseline nötig
