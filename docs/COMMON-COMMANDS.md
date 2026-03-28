# Common Commands Reference

# Iterative learning — stets verbessern und korrigieren wenn nötig

# Befehle können falsch sein oder nicht optimal! Achtung! Wir suchen Best Practices, Effizienz und Genauigkeit. Wenn auffällt, dass Befehle suboptimal sind, dann bitte korrigieren.

# npx Befehle können unter Umständen genau so gut sein (eventuell kein Unterschied)

> **Projekt:** Assixx | **Stand:** 2026-03-20
> Alle Befehle, die wir regelmäßig nutzen — kategorisch sortiert.

---

## Tooling-Konvention

| Tool                      | Wir benutzen         | NIEMALS                             |
| ------------------------- | -------------------- | ----------------------------------- |
| Package Manager           | `pnpm`               | `npm`, `yarn`                       |
| Skripte ausführen         | `pnpm run <script>`  | `npm run`, `yarn`                   |
| Binaries ausführen        | `pnpm exec <binary>` | `npx`, bare `vitest`, bare `eslint` |
| Dependencies installieren | `pnpm install`       | `npm install`, `yarn add`           |
| Einmalige Pakete          | `pnpm dlx <package>` | `npx <package>`                     |

**Warum:** `pnpm exec` nutzt die lokale `node_modules/.bin` — garantiert die richtige Version.
Bare Befehle wie `vitest` oder `eslint` können die falsche (globale) Version erwischen.

---

## 1. Docker Compose

```bash
# Working Directory: /home/scs/projects/Assixx/docker

doppler run -- docker-compose up -d                          # Dev-Container starten (Backend, Postgres, Redis, Deletion-Worker, Grafana, Loki, Prometheus)
doppler run -- docker-compose ps                             # Status aller Container anzeigen
doppler run -- docker-compose down                           # Alle Container stoppen und entfernen
doppler run -- docker-compose restart backend                # Nur Backend neustarten (nach Code-Änderungen)
doppler run -- docker-compose restart backend deletion-worker # Backend + Deletion-Worker neustarten
doppler run -- docker-compose logs -f backend                # Backend-Logs live streamen
doppler run -- docker-compose logs backend --tail 50         # Letzte 50 Zeilen Backend-Logs
doppler run -- docker-compose --profile production up -d     # Production-Mode starten (inkl. Frontend + Nginx)
doppler run -- docker-compose --profile production ps        # Production-Container-Status anzeigen
doppler run -- docker-compose --profile production down      # Production komplett stoppen
doppler run -- docker-compose --profile production build frontend          # Frontend-Image neu bauen
doppler run -- docker-compose --profile production up -d --build frontend  # Frontend bauen + starten
doppler run -- docker-compose --profile production build --no-cache        # Alles von Grund auf neu bauen
```

---

## 2. Docker Exec (Container-Befehle)

```bash
# Backend-Container
docker exec assixx-backend pnpm run type-check              # TypeScript-Fehler im Container prüfen
docker exec assixx-backend pnpm run lint:fix                 # ESLint Auto-Fix im Container
docker exec assixx-backend pnpm run format                   # Prettier Format im Container
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"  # Alles auf einmal fixen

# PostgreSQL-Container
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT 1;"                        # DB-Verbindung testen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt"                               # Alle Tabellen auflisten
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d users"                          # Schema einer Tabelle anzeigen
docker exec -it assixx-postgres psql -U assixx_user -d assixx                                    # Interaktive psql-Shell öffnen
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/migration.sql                  # SQL-Datei ausführen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backup.sql                        # Vollständiges Backup erstellen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --format=custom --compress=9 > backup.dump  # Komprimiertes Backup

# Redis-Container
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning KEYS 'throttle:*'  # Rate-Limit-Keys anzeigen
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning FLUSHDB            # Alle Redis-Keys löschen (Rate-Limits resetten)
```

---

## 3. pnpm (Package Manager)

```bash
pnpm install                  # Alle Dependencies installieren (NICHT npm oder yarn!)
pnpm run dev:svelte           # SvelteKit Dev-Server starten (HMR auf :5173)
pnpm run build                # Projekt bauen
pnpm run type-check           # TypeScript-Kompilierung prüfen (ohne Output)
```

---

## 4. ESLint (Linting)

```bash
# Backend-Lint (vom Root-Verzeichnis aus)
cd /home/scs/projects/Assixx && docker exec assixx-backend pnpm exec eslint backend/src           # Gesamtes Backend linten
cd /home/scs/projects/Assixx && docker exec assixx-backend pnpm exec eslint backend/src/nest/vacation  # Einzelnes Modul linten

# Frontend-Lint (lokal, nicht im Container)
cd /home/scs/projects/Assixx/frontend && pnpm run lint       # Frontend ESLint prüfen
cd /home/scs/projects/Assixx/frontend && pnpm run lint:fix   # Frontend ESLint Auto-Fix

# Backend im Container
docker exec assixx-backend pnpm run lint                     # Backend ESLint prüfen
docker exec assixx-backend pnpm run lint:fix                 # Backend ESLint Auto-Fix
```

---

## 5. Prettier (Code-Formatierung)

```bash
docker exec assixx-backend pnpm run format                   # Backend mit Prettier formatieren
docker exec assixx-backend pnpm run format:check             # Prüfen ohne zu ändern
cd /home/scs/projects/Assixx/frontend && pnpm run format     # Frontend formatieren
```

---

## 6. TypeScript

```bash
docker exec assixx-backend pnpm run type-check               # Backend TypeScript-Check (0 Errors = Pflicht)
cd /home/scs/projects/Assixx/frontend && pnpm run check      # Frontend svelte-check (Svelte + TS)
```

---

## 7. Testing (Vitest)

> **Config:** `vitest.config.ts` (Root) | **4 Projekte:** `api`, `unit`, `permission`, `frontend-unit`
> **Details:** [HOW-TO-TEST-WITH-VITEST.md](./how-to/HOW-TO-TEST-WITH-VITEST.md)

```bash
# API Integration Tests (gegen laufenden Docker-Backend)
pnpm run test:api                                                                     # Alle 38 API-Testmodule ausführen
pnpm exec vitest run --project api                                                    # Alternativ: direkt via vitest CLI
pnpm exec vitest run --project api backend/test/calendar.api.test.ts                  # Einzelnes Testmodul
pnpm exec vitest run --project api backend/test/calendar.api.test.ts --reporter verbose  # Mit detaillierter Ausgabe
pnpm exec vitest run --project api -t "should return 200"                             # Tests nach Name filtern

# Unit Tests
pnpm run test:unit                                                                    # Alle Backend + Shared Unit-Tests
pnpm exec vitest run --project unit backend/src/nest/vacation/vacation.service.test.ts # Einzelner Unit-Test
pnpm run test:unit:leaks                                                              # Unit-Tests mit Async-Leak-Erkennung

# Frontend Unit Tests
pnpm exec vitest run --project frontend-unit                                          # Frontend-Unit-Tests (Projekt aus Root)

# Permission Tests
pnpm run test:permission                                                              # Alle Permission-Guard-Tests
pnpm exec vitest run --project permission                                             # Alternativ: direkt via vitest CLI

# Alle Tests
pnpm run test                                                                         # Alle Projekte auf einmal

# Watch Mode (re-run bei Dateiänderungen)
pnpm exec vitest --project api                                                        # API-Tests im Watch-Mode
pnpm exec vitest --project unit                                                       # Unit-Tests im Watch-Mode

# Coverage
pnpm run test:coverage                                                                # Unit-Tests mit V8-Coverage-Report
```

---

## 8. Datenbank-Migrationen (node-pg-migrate)

```bash
# Migrationen ausführen
doppler run -- ./scripts/run-migrations.sh up                # Alle ausstehenden Migrationen anwenden
doppler run -- ./scripts/run-migrations.sh down              # Letzte Migration zurückrollen
doppler run -- ./scripts/run-migrations.sh up --dry-run      # Trockenlauf (zeigt was passieren würde)
doppler run -- ./scripts/run-migrations.sh redo              # Letzte Migration zurückrollen + erneut anwenden
doppler run -- ./scripts/run-migrations.sh up --fake         # Als "angewendet" markieren ohne SQL auszuführen

# Direkte pnpm-Scripts (ohne Shell-Wrapper)
doppler run -- pnpm run db:migrate:up                        # Alle ausstehenden Migrationen
doppler run -- pnpm run db:migrate:down                      # Letzte Migration zurückrollen
doppler run -- pnpm run db:migrate:dry                       # Trockenlauf
doppler run -- pnpm run db:migrate:redo                      # Redo (down + up)

# Neue Migration erstellen
doppler run -- pnpm run db:migrate:create add-employee-skills  # Erstellt Datei mit UTC-Timestamp

# Seeds anwenden (idempotent, sicher mehrfach ausführbar)
doppler run -- pnpm run db:seed                              # Globale Seed-Daten einspielen

# Migrationsstatus prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT id, name, run_on FROM pgmigrations ORDER BY run_on;"

# Customer-Deployment synchronisieren
./scripts/sync-customer-migrations.sh                        # Schema + Seeds für Fresh-Install aktualisieren
```

---

## 9. PostgreSQL-Abfragen (Diagnose)

> **Bevorzugt:** `docker exec assixx-postgres psql` (arbeitet besser damit).
> **Alternative für Menschen:** `psql -h localhost` (wenn psql lokal installiert → `export PGPASSWORD=$(docker exec assixx-postgres printenv POSTGRES_PASSWORD)`).
> **Details:** [HOW-TO-POSTGRESQL-CLI.md](./how-to/HOW-TO-POSTGRESQL-CLI.md)

```bash
# Tabellen & Schema
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt"                                    # Alle Tabellen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d table_name"                           # Spalten einer Tabelle
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"  # Tabellenanzahl

# RLS (Row Level Security)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"  # Alle RLS-Policies
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"  # Tabellen mit RLS

# RLS testen (als app_user MIT Tenant Context — simuliert Backend)
docker exec assixx-postgres psql -U app_user -d assixx -c "SET app.tenant_id = '1'; SELECT COUNT(*) FROM users;"  # Nur Tenant 1 sichtbar

# ENUMs
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid ORDER BY t.typname, e.enumsortorder;"  # Alle ENUM-Werte

# Tabellengrößen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"  # Top 10 größte Tabellen

# Datenbankgröße
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT pg_size_pretty(pg_database_size('assixx'));"  # Gesamtgröße der DB

# Verbindungen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'assixx';"  # Aktive DB-Verbindungen

# Foreign Keys einer Tabelle
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'YOUR_TABLE';"

# Indexes einer Tabelle
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'YOUR_TABLE';"

# Interaktive Shell (mit Meta-Befehlen: \dt, \d, \x, \timing, \q)
docker exec -it assixx-postgres psql -U assixx_user -d assixx
```

---

## 10. pg_stat_statements (Query-Performance)

```bash
# Top 10 langsamste Queries (nach Gesamtzeit)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT left(query, 80) AS query, calls, round(total_exec_time::numeric, 2) AS total_ms, round(mean_exec_time::numeric, 2) AS avg_ms, rows FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' ORDER BY total_exec_time DESC LIMIT 10;"

# Häufigste Queries (N+1 Problem erkennen)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT left(query, 80) AS query, calls, rows, round(mean_exec_time::numeric, 4) AS avg_ms FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' ORDER BY calls DESC LIMIT 10;"

# Cache-Hit-Probleme (< 95%)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT left(query, 80) AS query, calls, (100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric(5,1) AS hit_pct FROM pg_stat_statements WHERE (shared_blks_hit + shared_blks_read) > 10 AND (100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0)) < 95 ORDER BY shared_blks_read DESC;"

# Globale Cache-Hit-Ratio
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT round(100.0 * sum(shared_blks_hit) / NULLIF(sum(shared_blks_hit + shared_blks_read), 0), 2) AS global_hit_pct FROM pg_stat_statements;"

# Statistiken zurücksetzen (vor Performance-Tests)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT pg_stat_statements_reset();"
```

---

## 11. Health Checks & API-Tests

```bash
# Backend
curl -s http://localhost:3000/health | jq '.'                # Backend-Health (direkt)
curl -s http://localhost/health | jq '.'                     # Backend-Health (via Nginx, Production)

# Frontend
curl -s http://localhost:3001/health | jq '.'                # Frontend-Health (Production, direkt)
curl -s http://localhost:5173                                 # Dev-Server erreichbar?

# API Login testen
curl -s http://localhost:3000/api/v2/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@apitest.de","password":"ApiTest12345!"}' | jq '.'

# Nginx Routing prüfen (Production)
curl -sI http://localhost/login | head -10                   # Response-Headers der Login-Seite
curl -sI http://localhost/api/v2/health | head -10           # API via Nginx
```

---

## 12. Backup & Restore

```bash
# Backup erstellen
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --format=custom --compress=9 > database/backups/full_backup_${TIMESTAMP}.dump  # Komprimiert (empfohlen)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > database/backups/full_backup_${TIMESTAMP}.sql                                # SQL-Format
docker exec assixx-postgres pg_dump -U assixx_user -d assixx --schema-only > database/backups/schema_only.sql                               # Nur Schema
docker exec assixx-postgres pg_dump -U assixx_user -d assixx -t users > database/backups/users_backup.sql                                   # Einzelne Tabelle

# Restore
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx < database/backups/full_backup_XXXXXX.dump   # Aus .dump
docker exec -i assixx-postgres psql -U assixx_user -d assixx < database/backups/backup.sql                      # Aus .sql
```

---

## 13. Troubleshooting

```bash
# Port belegt?
lsof -i :3000                                               # Welcher Prozess nutzt Port 3000?
lsof -i :5173                                               # Welcher Prozess nutzt Port 5173?

# Container crasht?
docker logs assixx-backend --tail 100                        # Letzte 100 Zeilen Backend-Logs
docker logs assixx-frontend --tail 100                       # Letzte 100 Zeilen Frontend-Logs
docker logs assixx-nginx --tail 50                           # Nginx-Logs

# Postgres erreichbar?
docker exec assixx-postgres pg_isready -U assixx_user -d assixx  # DB-Readiness-Check

# Alles von vorn (Nuclear Option)
cd /home/scs/projects/Assixx/docker && doppler run -- docker-compose down && doppler run -- docker-compose up -d  # Dev neu starten

# TypeScript-Fehler komplett beheben
docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"
```

---

## 14. Doppler (Secrets Management)

```bash
doppler run -- <command>                                     # Beliebigen Befehl mit injizierten Secrets ausführen
doppler run -- docker-compose up -d                          # Docker mit Secrets starten
doppler run -- ./scripts/run-migrations.sh up                # Migrationen mit DB-Credentials
doppler run -- pnpm run db:seed                              # Seeds mit Credentials
```

---

## 15. Changesets (Versionierung & Changelog)

```bash
# Changeset erstellen (nach relevanter Änderung, vor PR)
pnpm changeset                                              # Interaktiver Prompt: Bump-Typ + Beschreibung

# Status prüfen (welche Changesets liegen bereit?)
pnpm changeset:status                                       # Zeigt ausstehende Changesets

# Version bumpen (vor Release — bumpt alle package.json + generiert CHANGELOG.md)
pnpm changeset:version                                      # Konsumiert Changesets, bumpt Versionen

# Git-Tags erstellen (nach Version-Bump)
pnpm changeset:tag                                          # Erstellt v0.x.x Tags basierend auf Versionen

# Leeres Changeset (wenn CI eins verlangt, aber nichts versionswürdiges geändert wurde)
pnpm changeset --empty                                      # Erstellt Changeset ohne Package-Zuordnung
```

**Workflow:** `pnpm changeset` → PR mergen → `pnpm changeset:version` → committen → `pnpm changeset:tag` → pushen mit Tags

---

## 16. Stylelint (CSS/Svelte)

```bash
pnpm run stylelint                                           # CSS + Svelte-Dateien prüfen (cached)
pnpm run stylelint:fix                                       # Auto-Fix (cached)
pnpm run stylelint:report                                    # JSON-Report generieren
```

---

## 17. Knip (Dead Code & Unused Dependencies)

> **Details:** [HOW-TO-KNIP.md](./how-to/HOW-TO-KNIP.md)

```bash
pnpm run knip                                                # Dead Code + unused Dependencies finden
pnpm run knip:fix                                            # Automatisch aufräumen (Vorsicht: prüfen was gelöscht wird!)
```

---

## 18. Validierung & Fixes (Komplett-Befehle)

```bash
# Alles auf einmal prüfen + fixen (empfohlen vor Commit/PR)
pnpm run validate:all                                        # Format + Lint:Fix + Type-Check + Stylelint (bricht bei Fehler ab)
pnpm run fix:all                                             # Format + Lint:Fix + Stylelint:Fix (nur Fixes, kein Type-Check)
pnpm run check:all                                           # Format + Lint:Fix + Type-Check + Stylelint (im Container)

# Type-Coverage
pnpm run type-coverage                                       # Prozentsatz typisierter Stellen anzeigen
```

---

## 19. Storybook

```bash
pnpm run storybook                                           # Dev-Server starten (Port 6006)
pnpm run build-storybook                                     # Static Build nach storybook-static/
```

---

## 20. CSS-Analyse

```bash
pnpm run css:analyze                                         # CSS-Nutzung analysieren
pnpm run css:analyze:verbose                                 # Detaillierte Analyse
pnpm run css:analyze:file                                    # Pro-Datei-Analyse
```

---

## 21. Skripte

```bash
/home/scs/projects/Assixx/scripts/check-production.sh        # Production Health-Check
/home/scs/projects/Assixx/scripts/sync-customer-migrations.sh # Customer Fresh-Install synchronisieren
```

---

## 22. Headless Mode (`claude -p`)

> **Was ist das?** ohne interaktive Session — du gibst einen Befehl, Claude arbeitet ihn ab, fertig.
> Kein Chat, kein Bestätigen, kein Warten. Ideal für mechanische, repetitive Aufgaben.
>
> **Wann sinnvoll:** Lint-Fixes, Type-Error-Fixes, Import-Sortierung, Formatting — alles wo keine kreative Entscheidung nötig ist.
> **Wann NICHT:** Feature-Entwicklung, Architektur-Entscheidungen, Debugging mit Kontext.

```bash
# ═══════════════════════════════════════════════════════════════
# Alle Lint-Errors fixen (Backend + Frontend)
# ═══════════════════════════════════════════════════════════════
claude -p "Fix all ESLint errors in the project.
1. Run 'docker exec assixx-backend pnpm run lint' to identify backend errors
2. Run 'cd /home/scs/projects/Assixx/frontend && pnpm run lint' to identify frontend errors
3. Fix all errors
4. Verify: 'docker exec assixx-backend pnpm run lint' must pass with 0 errors
5. Verify: 'cd /home/scs/projects/Assixx/frontend && pnpm run lint' must pass with 0 errors" \
  --allowedTools "Edit" "Read" "Bash(docker exec *)" "Bash(cd /home/scs/projects/Assixx/frontend && pnpm run lint*)" "Grep" "Glob"

# ═══════════════════════════════════════════════════════════════
# TypeScript-Errors fixen (Backend + Frontend)
# ═══════════════════════════════════════════════════════════════
claude -p "Fix all TypeScript errors in the project.
1. Run 'docker exec assixx-backend pnpm run type-check' to find backend TS errors
2. Run 'cd /home/scs/projects/Assixx/frontend && pnpm run check' to find frontend errors
3. Fix all errors
4. Verify both commands pass with 0 errors" \
  --allowedTools "Edit" "Read" "Bash(docker exec *)" "Bash(cd /home/scs/projects/Assixx/frontend && pnpm run check*)" "Grep" "Glob"

# ═══════════════════════════════════════════════════════════════
# Alles auf einmal: Format + Lint + Type-Check
# ═══════════════════════════════════════════════════════════════
claude -p "Fix all code quality issues in the Assixx project.
1. Run 'docker exec assixx-backend pnpm run format' to auto-format backend
2. Run 'docker exec assixx-backend pnpm run lint:fix' to auto-fix backend lint
3. Run 'docker exec assixx-backend pnpm run type-check' to check backend types
4. Run 'cd /home/scs/projects/Assixx/frontend && pnpm run lint:fix' to auto-fix frontend lint
5. Run 'cd /home/scs/projects/Assixx/frontend && pnpm run check' to check frontend types
6. Fix any remaining errors manually
7. Re-run all checks — all must pass with 0 errors" \
  --allowedTools "Edit" "Read" "Bash(docker exec *)" "Bash(cd /home/scs/projects/Assixx/frontend && pnpm run *)" "Grep" "Glob"

# ═══════════════════════════════════════════════════════════════
# Nützliche Flags
# ═══════════════════════════════════════════════════════════════
# --output-format json          # Anlagenlesbare Ausgabe (für Skripte)
# --output-format stream-json   # Streaming JSON (für Live-Monitoring)
# --max-turns 20                # Maximale Anzahl Durchläufe begrenzen
# --max-budget-usd 2.00         # Budget-Limit setzen (Kostenkontrolle)
# --model sonnet                # Günstigeres Modell für einfache Aufgaben
# --verbose                     # Detaillierte Ausgabe zum Debuggen
# -c -p "query"                 # Letzte Session fortsetzen (headless)
```

**Workflow:** Befehl starten → Kaffee holen → Ergebnis prüfen. Kein Babysitten nötig.

---

---

## HOW-TO Guides

> 11 eigenständige Anleitungen zu Tools, Workflows und Patterns.
> Vollständiger Katalog mit Beschreibungen: **[docs/how-to/README.md](./how-to/README.md)**

---

**Hinweis:** Alle Docker-Befehle von `/home/scs/projects/Assixx/docker` ausführen. Alle pnpm-Befehle von `/home/scs/projects/Assixx` (Root) oder `/home/scs/projects/Assixx/frontend`.
