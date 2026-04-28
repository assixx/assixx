<!--
Titel-Konvention für Auto-Label (siehe .github/workflows/pr-auto-label.yml):
  feat:     -> enhancement
  fix:      -> bug
  docs:     -> documentation
  refactor: -> refactor
  perf:     -> performance
  security: -> security
  chore:    -> chore
  ci:       -> github_actions
  breaking: -> breaking-change
-->

## Zusammenfassung

<!-- 1-3 Bullet Points: WAS und WARUM (das WIE zeigt der Diff). -->

-

## Bezug

<!-- "Closes #123" / "Fixes #123" schließt das Issue beim Merge. -->

- Closes #
- ADR:
- Masterplan:

## Art der Änderung

- [ ] `feat:` Neues Feature / Addon
- [ ] `fix:` Bug-Fix
- [ ] `refactor:` Refactoring (kein Verhalten geändert)
- [ ] `perf:` Performance-Verbesserung
- [ ] `security:` Sicherheitsfix
- [ ] `docs:` Dokumentation / ADR
- [ ] `chore:` Wartung / Dependencies
- [ ] `ci:` CI / GitHub Actions
- [ ] `breaking:` Breaking Change (Konsumenten müssen anpassen)

## Test-Plan

<!-- Wie wurde validiert, dass die Änderung korrekt ist und nichts Bestehendes bricht? -->

- [ ]
- [ ]

## Definition of Done

### Code-Qualität (immer)

- [ ] `pnpm run validate:all` (Format + Lint + Type-Check + Stylelint) grün
- [ ] Relevante Tests grün (`unit` / `api` / `permission` / `frontend-unit` / `e2e`)
- [ ] Keine `// TODO:`-Kommentare hinterlassen (CLAUDE-KAIZEN-MANIFEST)
- [ ] Kommentare erklären **WHY**, nicht WHAT — mit Verweis auf ADR/Issue/Vorentscheidung
- [ ] Keine `any`-Types ohne dokumentierte Begründung
- [ ] KISS: nur das umgesetzt, was die Aufgabe fordert (keine Premature Abstractions)

### Backend & Datenbank (falls zutreffend)

- [ ] Migration via `pnpm run db:migrate:create` erstellt (NIE manuell, ADR-014)
- [ ] Backup vor Apply, Dry-Run grün, `down()` implementiert oder bewusst Lossy markiert
- [ ] RLS aktiviert + Policy `tenant_isolation` mit `NULLIF(current_setting(...), '')::int` (ADR-019)
- [ ] `GRANT ... TO app_user` UND `TO sys_user` (Triple-User-Model)
- [ ] DTOs via `createZodDto(Schema)` und `idField` / `createIdParamSchema` aus `common/dto/` (ADR-030)
- [ ] `IS_ACTIVE` aus `@assixx/shared/constants` statt Magic Numbers
- [ ] DB-Zugriff via passende `DatabaseService`-Methode (`tenantQuery` / `tenantTransaction` / `systemQuery`)
- [ ] Mutationen mit `@RequirePermission(ADDON, MODULE, 'canWrite')` — kein `@Roles('admin', 'root')` als alleiniger Guard (ADR-045)

### Frontend (falls zutreffend)

- [ ] Route in passender Group: `(root)` / `(admin)` / `(shared)` (ADR-012)
- [ ] Addon-Gate via `requireAddon(activeAddons, '<code>')` in `+page.server.ts` (ADR-033)
- [ ] 403-Pfad: `apiFetchWithPermission()` + `<PermissionDenied />` (ADR-020)
- [ ] Hierarchy-Labels via `createMessages(data.hierarchyLabels)` propagiert (ADR-034)
- [ ] Svelte-5-Runes (`$state`, `$derived`, `$effect`) — keine Legacy-Stores in neuem Code
- [ ] Session-Expired-Handling via `$lib/utils/session-expired.ts` (kein Re-Implement)

### Dokumentation

- [ ] `docs/ARCHITECTURE.md` §1 Navigation-Map aktualisiert (Datei verschoben/umbenannt oder neues Konzept)
- [ ] ADR neu erstellt oder bestehender ergänzt (bei Architektur-Entscheidungen)
- [ ] Masterplan-Status aktualisiert (bei laufendem Feature)
- [ ] Changeset erstellt via `pnpm changeset` (bei user-sichtbarer Änderung)

## Screenshots / Demo

<!-- Vorher/Nachher-Screenshots oder kurzes GIF/MP4 bei UI-Änderungen. -->

## Risiken & Rollback

<!-- Gibt es einen Rollback-Plan? Folge-PRs nötig? Migrations-Risiken? -->
