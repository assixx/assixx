# @assixx/shared

## 0.4.14

### Patch Changes

- [Added] Added 2FA on login and signup

## 0.4.13

### Patch Changes

- d512be6: [Changed] Added participants in kvp
- 5036dfd: [Maintenance] Bumped grafana v13
- 62727d1: [Maintenance] Backend prod image: `pnpm deploy` pattern — image size 1.27 GB → 614 MB (-52%). Closes ADR-027 §3.
- 62727d1: [Maintenance] Moved frontend-only devDeps from root `package.json` into `frontend/package.json` (single source of truth)
- 62727d1: [Maintenance] Removed dead `eslint-plugin-storybook` import from root `eslint.config.mjs`
- 62727d1: [Docs] Fixed `docs/ARCHITECTURE.md` map drift (`Dockerfile.prod` → `Dockerfile`)

## 0.4.12

### Patch Changes

- 1031d27: [Added] Added subdomain in url | Tenant isolation prevention
- 1031d27: [Added] Added shift handover
- 1031d27: [Maintenance] Bumped node 24.15.0 LTS

## 0.4.11

## 0.4.10

## 0.4.9

## 0.4.8

### Patch Changes

- [Added] Added position master

## 0.4.7

### Patch Changes

- [Added] Added position master

## 0.4.6

### Minor Changes

- [Added] PermissionControl (docs/infrastructure/adr/ADR-036-organizational-scope-access-control.md and docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md)

## 0.4.5

### Patch Changes

- ffd60c9: [Added] Added organigramm
  feat: add dynamic postions
  refactor: renaming feature to addon (module)
  chore: docs updated
  style: adjust landingpage to addon modules
  chore: bump deps
  chore: stabilisation

## 0.4.0
