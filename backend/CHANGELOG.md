# assixx-backend

## 0.4.10

### Patch Changes

- ebd08ea: feat: add swap requests for shifts
- 4a73906: feature: add inventory list
- f929814: refactor: cleanup
  - @assixx/shared@0.4.10

## 0.4.9

### Patch Changes

- a180d70: refactor: add TPM apporval system
- a180d70: feat: add defects chart
  - @assixx/shared@0.4.9

## 0.4.8

### Patch Changes

- feat: add position master
- Updated dependencies
  - @assixx/shared@0.4.8

## 0.4.7

### Patch Changes

- feat: add position master
- Updated dependencies
  - @assixx/shared@0.4.7

## 0.4.6

### Minor Changes

- feat: PermissionControl (docs/infrastructure/adr/ADR-036-organizational-scope-access-control.md and docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md)

### Patch Changes

- Updated dependencies
  - @assixx/shared@0.4.6

## 0.4.5

### Patch Changes

- a283d00: Refactor: is_active Magic Numbers durch IS_ACTIVE-Konstanten ersetzt (466 Stellen in 134 Dateien). Regressions-Schutz durch 4 Architektur-Tests in CI. Dokumentiert in TYPESCRIPT-STANDARDS.md Section 7.4 + No-Go #16.
- ffd60c9: feat: add organigramm
  feat: add dynamic postions
  refactor: renaming feature to addon (module)
  chore: docs updated
  style: adjust landingpage to addon modules
  chore: bump deps
  chore: stabilisation
- bbba1ef: Partition Health: /health/partitions Endpoint + API-Test
  - Neuer Endpoint `/health/partitions` zur Verifizierung der pg_partman-Konfiguration (Extension, part_config, Partitionen, Defaults)
  - HTTP 200 bei gesundem Zustand, HTTP 503 bei Problemen
  - 9 API-Integrationstests (`partitions.api.test.ts`) verifizieren Partition-Coverage automatisch
  - GRANT für `app_user` auf `partman`-Schema (read-only, Monitoring)

- eaec9d5: refactor: add adress for customer in db and signup page
- eaec9d5: feat: add organigramm
- Updated dependencies [ffd60c9]
  - @assixx/shared@0.4.5

## 0.4.0

### Minor Changes

- 852a237: TPM (Total Productive Maintenance) feature complete: maintenance plans, Kamishibai board, card execution workflow, approval system, schedule projection, slot assistant, escalation, photo uploads, execution history, plan archive/unarchive, work order integration, shift assignments, category/interval/status color config, time estimates, rename machine to assets, audit trail logging, TPM card creation limits, template removal, API tests and full frontend UI

### Patch Changes

- @assixx/shared@0.4.0
