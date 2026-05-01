<!--
Title prefix drives auto-label (see .github/workflows/pr-auto-label.yml):
  feat / fix / docs / refactor / perf / security / chore / ci / breaking
-->

## Summary

<!-- 1–3 bullets: WHAT and WHY (the diff shows HOW). -->

-

## Links

- Closes #
- ADR / Masterplan:

## Test plan

<!-- How did you verify it works and nothing else broke? -->

-

## Definition of Done

- [ ] `pnpm run validate:all` green + relevant tests pass (`unit` / `api` / `permission` / `frontend-unit` / `e2e`)
- [ ] Comments explain **WHY** with ADR / issue references where the reasoning is non-obvious

### Database (if touched)

- [ ] Migration created via `pnpm run db:migrate:create` — never manually (ADR-014)
- [ ] Backup taken, dry-run green, `down()` implemented or explicitly marked lossy
- [ ] RLS enabled + `tenant_isolation` policy + GRANTs to `app_user` AND `sys_user` (ADR-019)

### Backend mutation (if added)

- [ ] Guarded with `@RequirePermission(ADDON, MODULE, 'canWrite')` — no bare `@Roles(...)` for mutations (ADR-045)
- [ ] DTO via `createZodDto()` + `idField` / `createIdParamSchema` from `common/dto/` (ADR-030)

### Frontend page (if added)

- [ ] Placed in correct route group: `(root)` / `(admin)` / `(shared)` (ADR-012)
- [ ] Addon-gated via `requireAddon()` in `+page.server.ts`; 403 path uses `apiFetchWithPermission()` + `<PermissionDenied />` (ADR-020, ADR-033)

### Documentation

- [ ] `docs/ARCHITECTURE.md` §1 Navigation Map updated (file moved/renamed or new concept)
- [ ] ADR / Masterplan / Changeset (`pnpm changeset`) updated where relevant

## Screenshots / Demo

<!-- Before/after for UI changes. -->

## Risks & rollback (if applicable)

<!-- Migration risks? Follow-up PRs? Rollback plan? -->

---

> Reference: [HOW-TO-TEST](../docs/how-to/HOW-TO-TEST.md) · [Changesets](../docs/how-to/HOW-TO-USE-CHANGESETS.md)
