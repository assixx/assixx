# assixx-backend

## 0.4.13

### Patch Changes

- d512be6: refactor: add participants in kvp
- 5036dfd: fix: cross-origin first-escrow bootstrap (ADR-022 §"New-user scenario")

  The apex-login → subdomain-handoff flow now creates the user's first escrow
  blob automatically via a bootstrap-variant of the unlock ticket. Previously
  documented as deferred in the ADR-022 Amendment 2026-04-22, but every new
  user (and every database restore without escrow rows) hit a non-recoverable
  fail-closed state on the second cross-origin login. The unlock ticket payload
  now optionally carries `argon2Salt + argon2Params` derived on apex; the
  subdomain generates the X25519 key, registers it, and stores the first
  escrow blob — all without re-prompting for the password and without a second
  Argon2id round-trip. Pre-flight check on apex (`GET /e2e/keys/me`) skips
  the bootstrap when the server already holds an active key for that user
  (existing-user-without-escrow case → admin reset remains the recovery).

- 5036dfd: chore: bump grafana v13
- 62727d1: chore(docker): backend production image switches to `pnpm deploy` pattern (closes ADR-027 §3 deferred); cuts `assixx-backend:prod` image size from 1.27 GB to 614 MB (-52%) by mirroring `Dockerfile.frontend`. Moves frontend-only devDeps (Storybook, Stylelint suite, postcss-html, prettier-plugin-css-order) and 4 duplicates (vite, @tailwindcss/vite, prettier-plugin-svelte, prettier-plugin-tailwindcss) out of root `package.json` into `frontend/package.json` (single source of truth). Root scripts (`storybook`, `build-storybook`, `stylelint*`) now wrap to `pnpm --filter assixx-frontend run …`. Removes dead `eslint-plugin-storybook` import from root `eslint.config.mjs`. Fixes `docs/ARCHITECTURE.md` map drift (`Dockerfile.prod` → `Dockerfile`).
- Updated dependencies [d512be6]
- Updated dependencies [5036dfd]
- Updated dependencies [62727d1]
  - @assixx/shared@0.4.13

## 0.4.12

### Patch Changes

- 1031d27: chore: add version reference and bug report
- 1031d27: feat: add subdomain in url | Tenant isolation prevention
- 1031d27: feat: add microsoft oAuth
- 1031d27: feat: add shift handover
- 1031d27: chore: add grafana tempo
- 1031d27: chore: bump node 24.15.0 LTS
- 1031d27: chore: add otelementry
- Updated dependencies [1031d27]
- Updated dependencies [1031d27]
- Updated dependencies [1031d27]
  - @assixx/shared@0.4.12

## 0.4.11

### Patch Changes

- chore: bump typsescript from 5 to 6
- chore: bump postgres from 17 to 18
  - @assixx/shared@0.4.11

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
