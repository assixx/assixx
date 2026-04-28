# @assixx/shared

## 0.4.13

### Patch Changes

- d512be6: refactor: add participants in kvp
- 5036dfd: chore: bump grafana v13
- 62727d1: chore(docker): backend production image switches to `pnpm deploy` pattern (closes ADR-027 §3 deferred); cuts `assixx-backend:prod` image size from 1.27 GB to 614 MB (-52%) by mirroring `Dockerfile.frontend`. Moves frontend-only devDeps (Storybook, Stylelint suite, postcss-html, prettier-plugin-css-order) and 4 duplicates (vite, @tailwindcss/vite, prettier-plugin-svelte, prettier-plugin-tailwindcss) out of root `package.json` into `frontend/package.json` (single source of truth). Root scripts (`storybook`, `build-storybook`, `stylelint*`) now wrap to `pnpm --filter assixx-frontend run …`. Removes dead `eslint-plugin-storybook` import from root `eslint.config.mjs`. Fixes `docs/ARCHITECTURE.md` map drift (`Dockerfile.prod` → `Dockerfile`).

## 0.4.12

### Patch Changes

- 1031d27: feat: add subdomain in url | Tenant isolation prevention
- 1031d27: feat: add shift handover
- 1031d27: chore: bump node 24.15.0 LTS

## 0.4.11

## 0.4.10

## 0.4.9

## 0.4.8

### Patch Changes

- feat: add position master

## 0.4.7

### Patch Changes

- feat: add position master

## 0.4.6

### Minor Changes

- feat: PermissionControl (docs/infrastructure/adr/ADR-036-organizational-scope-access-control.md and docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md)

## 0.4.5

### Patch Changes

- ffd60c9: feat: add organigramm
  feat: add dynamic postions
  refactor: renaming feature to addon (module)
  chore: docs updated
  style: adjust landingpage to addon modules
  chore: bump deps
  chore: stabilisation

## 0.4.0
