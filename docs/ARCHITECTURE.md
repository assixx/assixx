# Assixx System Architecture

**Version:** 4.3.0 · **Updated:** 2026-05-01 · **Status:** living document

> Single navigation map into the Assixx codebase. **Read this first** when joining a session or touching an unfamiliar area. Auto-loaded into every Claude Code session via [CLAUDE.md](../CLAUDE.md) mandatory checklist.

---

## Purpose

Most questions about "where is X implemented?" are answered by the tables below. Each row points at the authoritative entry file (`path:line` for class/function definitions) and the ADR that governs the design. When a row becomes wrong, the code has moved — update this doc in the same PR.

**This is not an introduction.** For that, read [`README.md`](../README.md). For detailed rationale, read the referenced ADR. For step-by-step workflows, read [`docs/how-to/README.md`](./how-to/README.md).

---

## 1. Navigation Map — Concept → Entry Point

### 1.1 Core Architecture

| Concept                   | Entry Point                                                                                          | Why it is the entry point · ADR                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| App bootstrap             | `backend/src/nest/main.ts` · `backend/src/nest/app.module.ts`                                        | NestJS 11 + Fastify adapter, module graph root                                                                                                |
| Tenant CLS context        | `backend/src/nest/app.module.ts:134` (`ClsModule.forRoot`)                                           | Per-request Continuation-Local-Storage, populated by JwtAuthGuard · [ADR-006](./infrastructure/adr/ADR-006-multi-tenant-context-isolation.md) |
| Tenant-host resolution    | `backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts`                              | Maps subdomain → tenant before guards run · [ADR-050](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)                               |
| Database pool             | `backend/src/nest/database/database.service.ts`                                                      | `pg` v8 pool, sets `app.tenant_id` per connection · [ADR-019](./infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md)                     |
| Global API response shape | `backend/src/nest/common/interceptors/response.interceptor.ts`                                       | `{ success, data, error, meta }` envelope · [ADR-007](./infrastructure/adr/ADR-007-api-response-standardization.md)                           |
| Validation (Zod + DTO)    | `backend/docs/ZOD-INTEGRATION-GUIDE.md` · `backend/src/nest/*/dto/*.dto.ts`                          | `createZodDto()` via nestjs-zod, sole validation library · [ADR-030](./infrastructure/adr/ADR-030-zod-validation-architecture.md)             |
| Audit trail               | `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` · `backend/src/nest/common/audit/` | Cross-cutting audit_logs writer · [ADR-009](./infrastructure/adr/ADR-009-central-audit-logging.md)                                            |
| Distributed tracing       | `backend/src/nest/instrument.ts`                                                                     | Sentry + OpenTelemetry/Tempo · [ADR-048](./infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md)                                      |

### 1.2 Authentication & Permissions (3-Layer Stack · ADR-045)

| Concept                          | Entry Point                                                                                                                                                                                       | Why it is the entry point · ADR                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT authentication               | `backend/src/nest/common/guards/jwt-auth.guard.ts:46`                                                                                                                                             | `JwtAuthGuard.canActivate()` — fresh DB lookup per request, populates CLS · [ADR-005](./infrastructure/adr/ADR-005-authentication-strategy.md)                                                                                                                                                                                                                              |
| Login/refresh/logout             | `backend/src/nest/auth/auth.service.ts` · `backend/src/nest/auth/auth.controller.ts`                                                                                                              | Token issuing + connection-ticket flow                                                                                                                                                                                                                                                                                                                                      |
| 2FA email challenge (mandatory)  | `backend/src/nest/two-factor-auth/two-factor-auth.service.ts` · `backend/src/nest/two-factor-auth/two-factor-code.service.ts` · `backend/src/nest/users/email-change.service.ts` (DD-32 two-code) | Mandatory email-based 2FA on every password login + signup, hardcoded — no opt-out. Discriminated `LoginResult` returned from `auth.service.ts:222`; OAuth bypasses via `loginWithVerifiedUser()` at `auth.service.ts:278` (DD-7). Email-change requires two-code verify (old + new mailbox, DD-32 / R15). · [ADR-054](./infrastructure/adr/ADR-054-mandatory-email-2fa.md) |
| SSR auth-cookie state            | `frontend/src/lib/server/auth-cookies.ts`                                                                                                                                                         | `setAuthCookies` / `clearAuthCookies` — single source of the 4-cookie invariant (access/refresh/role/exp); `secure` derived from `url.protocol`, NOT `NODE_ENV` · ADR-046 · [ADR-050](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)                                                                                                                             |
| OAuth sign-in (MS/Google)        | `backend/src/nest/auth/oauth/`                                                                                                                                                                    | Azure AD + Google OIDC · [ADR-046](./infrastructure/adr/ADR-046-oauth-sign-in.md)                                                                                                                                                                                                                                                                                           |
| **Layer 0** — Addon subscription | `backend/src/nest/common/guards/tenant-addon.guard.ts`                                                                                                                                            | "Has the tenant booked this addon?" — checks `tenant_addons`. Fail → `/addon-unavailable` · [ADR-033](./infrastructure/adr/ADR-033-addon-based-saas-model.md)                                                                                                                                                                                                               |
| **Layer 1** — Management gate    | `backend/src/nest/common/guards/permission.guard.ts:35` (via `@RequirePermission(ADDON, MODULE)`)                                                                                                 | "Can this user manage this module at all?" — combines role + `has_full_access` + Lead-scope + Deputy-toggle. Replaces `isAdmin` shortcuts. Fail → `/permission-denied` or 403                                                                                                                                                                                               |
| **Layer 2** — Action permission  | `backend/src/nest/user-permissions/user-permissions.service.ts` (via `@RequirePermission(ADDON, MODULE, 'canWrite')`)                                                                             | Fine-grained `canRead`/`canWrite`/`canDelete` stored in `user_addon_permissions` · [ADR-020](./infrastructure/adr/ADR-020-per-user-feature-permissions.md)                                                                                                                                                                                                                  |
| Creator bypass (optional)        | service-internal per feature (`authorId === currentUser.id`)                                                                                                                                      | Authors edit/delete own content regardless of Layers 1/2 — decided per feature · ADR-045                                                                                                                                                                                                                                                                                    |
| Permission registry              | `backend/src/nest/common/permission-registry/permission-registry.service.ts`                                                                                                                      | Decentralized — each module registers via `*.permission.registrar.ts`                                                                                                                                                                                                                                                                                                       |
| Roles (root/admin/employee)      | `backend/src/nest/common/guards/roles.guard.ts` · `backend/src/nest/roles/`                                                                                                                       | `@Roles()` decorator check · [ADR-010](./infrastructure/adr/ADR-010-user-role-assignment-permissions.md)                                                                                                                                                                                                                                                                    |
| Admin-level management           | `backend/src/nest/admin-permissions/admin-permissions.service.ts`                                                                                                                                 | `has_full_access` + area/dept-scoped admins · [ADR-010](./infrastructure/adr/ADR-010-user-role-assignment-permissions.md)                                                                                                                                                                                                                                                   |
| Role switching (dev/debug)       | `backend/src/nest/role-switch/`                                                                                                                                                                   | Root only — impersonation audit-logged                                                                                                                                                                                                                                                                                                                                      |
| Root account protection          | `backend/src/nest/root/root-protection.service.ts` · `backend/src/nest/root/root-self-termination.service.ts` · DB trigger `trg_root_protection`                                                  | 4-layer defense (Frontend UX hint → Service Guard → Peer-Approval Workflow → DB Trigger): cross-root immutability + last-root protection + 4-eyes peer-approved self-termination · [ADR-055](./infrastructure/adr/ADR-055-root-account-lifecycle-protection.md)                                                                                                             |
| Frontend route gates             | `frontend/src/routes/(app)/(root)/+layout.server.ts` · `(admin)/+layout.server.ts` · `(shared)/+layout.server.ts`                                                                                 | Fail-closed RBAC at SSR layer · [ADR-012](./infrastructure/adr/ADR-012-frontend-route-security-groups.md) · [ADR-024](./infrastructure/adr/ADR-024-frontend-feature-guards.md)                                                                                                                                                                                              |
| Addon-unavailable page           | `frontend/src/routes/(app)/addon-unavailable/+page.svelte`                                                                                                                                        | Layer 1 denial UI                                                                                                                                                                                                                                                                                                                                                           |
| Permission-denied page           | `frontend/src/routes/(app)/permission-denied/+page.svelte`                                                                                                                                        | Layer 3 denial UI                                                                                                                                                                                                                                                                                                                                                           |

### 1.3 Organizational Hierarchy

| Concept                        | Entry Point                                                                                                  | Why it is the entry point · ADR                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hierarchy labels (UI rename)   | `backend/src/nest/organigram/organigram.service.ts` · `frontend/src/lib/components/UserPositionChips.svelte` | Tenant can rename `area` → "Abteilung" in UI, DB stays `area_id` · [ADR-034](./infrastructure/adr/ADR-034-hierarchy-labels-propagation.md) |
| Areas CRUD                     | `backend/src/nest/areas/` · `frontend/src/routes/(app)/(shared)/manage-areas/`                               | DB: `areas`, NOT `departments` (label ≠ column)                                                                                            |
| Departments                    | `backend/src/nest/departments/` · `frontend/src/routes/(app)/(shared)/manage-departments/`                   | DB: `departments`                                                                                                                          |
| Teams                          | `backend/src/nest/teams/` · `frontend/src/routes/(app)/(shared)/manage-teams/`                               | DB: `teams`                                                                                                                                |
| Area/Dept/Team Leads           | `backend/src/nest/hierarchy-permission/hierarchy-permission.service.ts`                                      | Lead-role scope check — inherits down                                                                                                      |
| Organizational scope filtering | `backend/src/nest/hierarchy-permission/scope.service.ts`                                                     | "What subset of users/entities can this lead see?" · [ADR-036](./infrastructure/adr/ADR-036-organizational-scope-access-control.md)        |
| Deputy scope toggle            | `backend/src/nest/hierarchy-permission/` + tenant setting                                                    | Per-tenant on/off · [ADR-039](./infrastructure/adr/ADR-039-per-tenant-deputy-scope-toggle.md)                                              |
| Position catalog               | `backend/src/nest/organigram/` · related DTOs                                                                | Job titles per tenant · [ADR-038](./infrastructure/adr/ADR-038-position-catalog-architecture.md)                                           |

### 1.4 Feature Modules (Addons)

| Addon                              | Backend                                                                                                                                                                                                                        | Frontend                                                                                  | ADR / Masterplan                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shift handover (current work)      | `backend/src/nest/shift-handover/`                                                                                                                                                                                             | `frontend/src/routes/(app)/(shared)/shift-handover-templates/`                            | [ADR-052](./infrastructure/adr/ADR-052-shift-handover-protocol.md) · [Masterplan](./FEAT_SHIFT_HANDOVER_MASTERPLAN.md)                                                                                                                  |
| Shifts                             | `backend/src/nest/shifts/`                                                                                                                                                                                                     | `frontend/src/routes/(app)/(shared)/shifts/`                                              | [ADR-011](./infrastructure/adr/ADR-011-shift-data-architecture.md)                                                                                                                                                                      |
| TPM (Total Productive Maintenance) | `backend/src/nest/tpm/`                                                                                                                                                                                                        | `frontend/src/routes/(app)/(shared)/lean-management/tpm/`                                 | [ADR-026](./infrastructure/adr/ADR-026-tpm-architecture.md) · Masterplans `FEAT_TPM_*.md`                                                                                                                                               |
| Calendar                           | `backend/src/nest/calendar/`                                                                                                                                                                                                   | `frontend/src/routes/(app)/(shared)/calendar/`                                            | FullCalendar 6                                                                                                                                                                                                                          |
| KVP (suggestions)                  | `backend/src/nest/kvp/`                                                                                                                                                                                                        | `frontend/src/routes/(app)/(shared)/kvp/` + `kvp-detail/`                                 | —                                                                                                                                                                                                                                       |
| Blackboard                         | `backend/src/nest/blackboard/`                                                                                                                                                                                                 | `frontend/src/routes/(app)/(shared)/blackboard/`                                          | —                                                                                                                                                                                                                                       |
| Chat                               | `backend/src/nest/chat/`                                                                                                                                                                                                       | `frontend/src/routes/(app)/(shared)/chat/`                                                | WebSocket                                                                                                                                                                                                                               |
| Documents                          | `backend/src/nest/documents/`                                                                                                                                                                                                  | `frontend/src/routes/(app)/(shared)/documents-explorer/`                                  | [ADR-042](./infrastructure/adr/ADR-042-multipart-file-upload-pipeline.md)                                                                                                                                                               |
| Surveys                            | `backend/src/nest/surveys/`                                                                                                                                                                                                    | `frontend/src/routes/(app)/(shared)/surveys/` + `manage-surveys/` + `survey-results/`     | —                                                                                                                                                                                                                                       |
| Notifications (Push + SSE)         | `backend/src/nest/notifications/`                                                                                                                                                                                              | built into layouts                                                                        | [ADR-003](./infrastructure/adr/ADR-003-notification-system.md) · [ADR-004](./infrastructure/adr/ADR-004-persistent-notification-counts.md) · [ADR-031](./infrastructure/adr/ADR-031-centralized-read-tracking.md)                       |
| Vacation                           | `backend/src/nest/vacation/`                                                                                                                                                                                                   | `frontend/src/routes/(app)/(shared)/vacation/` + `(admin)/vacation/` + `(root)/vacation/` | [ADR-023](./infrastructure/adr/ADR-023-vacation-request-architecture.md)                                                                                                                                                                |
| Approvals                          | `backend/src/nest/approvals/`                                                                                                                                                                                                  | `frontend/src/routes/(app)/(shared)/manage-approvals/`                                    | [ADR-037](./infrastructure/adr/ADR-037-approvals-architecture.md)                                                                                                                                                                       |
| Work Orders                        | `backend/src/nest/work-orders/`                                                                                                                                                                                                | `frontend/src/routes/(app)/(shared)/work-orders/`                                         | [ADR-028](./infrastructure/adr/ADR-028-work-orders-architecture.md)                                                                                                                                                                     |
| Inventory                          | `backend/src/nest/inventory/`                                                                                                                                                                                                  | `frontend/src/routes/(app)/(shared)/inventory/` + `(admin)/manage-assets/`                | [ADR-040](./infrastructure/adr/ADR-040-inventory-addon-architecture.md)                                                                                                                                                                 |
| E2E encryption + key escrow        | `backend/src/nest/e2e-keys/` · `backend/src/nest/e2e-escrow/`                                                                                                                                                                  | —                                                                                         | [ADR-021](./infrastructure/adr/ADR-021-e2e-encryption.md) · [ADR-022](./infrastructure/adr/ADR-022-e2e-key-escrow.md)                                                                                                                   |
| Cross-origin escrow bootstrap      | `backend/src/nest/e2e-escrow/escrow-unlock-ticket.service.ts` · `frontend/src/lib/crypto/e2e-state.svelte.ts` (`bootstrapFromUnlockTicket`) · `frontend/src/routes/(public)/login/+page.svelte` (`mintUnlockTicketOrFallback`) | `frontend/src/routes/(app)/+layout.svelte` (`bootstrapE2eFromUrlAndInitialize`)           | Apex→subdomain handoff: unlock OR bootstrap variant, ADR-022 §"New-user scenario" resolved 2026-04-25 · [ADR-022](./infrastructure/adr/ADR-022-e2e-key-escrow.md) · [ADR-050](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md) |
| Addon check + visits telemetry     | `backend/src/nest/addon-check/` · `backend/src/nest/addon-visits/`                                                                                                                                                             | —                                                                                         | Telemetry for addon usage                                                                                                                                                                                                               |

### 1.5 Frontend (SvelteKit 5)

| Concept                        | Entry Point                                             | Why / ADR                                                                                                    |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Route groups                   | `frontend/src/routes/(app)/` · `(public)/`              | Top split: authenticated vs public                                                                           |
| Role-based groups              | `(app)/(root)/` · `(app)/(admin)/` · `(app)/(shared)/`  | Fail-closed · [ADR-012](./infrastructure/adr/ADR-012-frontend-route-security-groups.md)                      |
| Tenant root redirect           | `frontend/src/routes/(app)/+layout.server.ts`           | Loads session, routes by role                                                                                |
| Design system                  | `frontend/src/design-system/README.md`                  | 29+ components, theme tokens · [ADR-017](./infrastructure/adr/ADR-017-design-system-theming-architecture.md) |
| Base CSS / Tailwind v4         | `frontend/src/styles/tailwind/base.css`                 | Token source for Tailwind 4                                                                                  |
| Feature guards (FE)            | `frontend/src/lib/` helpers used in `+layout.server.ts` | Hide UI for missing addons · [ADR-024](./infrastructure/adr/ADR-024-frontend-feature-guards.md)              |
| CSS scoping (legacy migration) | Masterplan `FEAT_CSS_SCOPING_MASTERPLAN.md`             | Moving from global to scoped styles                                                                          |

### 1.6 Data Layer

| Concept                       | Entry Point                                                                                                             | Why / ADR                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations                    | `database/migrations/*.ts`                                                                                              | node-pg-migrate, TypeScript · [ADR-014](./infrastructure/adr/ADR-014-database-migration-architecture.md) · [guide](./DATABASE-MIGRATION-GUIDE.md) |
| Triple-user model             | `database/migrations/*_baseline.ts`                                                                                     | `assixx_user` (superuser), `sys_user` (tooling), `app_user` (RLS) · [ADR-019](./infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md)         |
| Seeds                         | `database/seeds/`                                                                                                       | Baseline tenant/user/addon seed · [ADR-016](./infrastructure/adr/ADR-016-tenant-customizable-seed-data.md)                                        |
| Partitioning (pg_partman)     | `database/migrations/*audit*partition*.ts` · [ADR-029](./infrastructure/adr/ADR-029-pg-partman-partition-management.md) | Audit-log + high-volume tables · Masterplan `FEAT_PG_PARTMAN_MASTERPLAN.md`                                                                       |
| pg_stat_statements monitoring | — (DB-side)                                                                                                             | Query telemetry · [ADR-025](./infrastructure/adr/ADR-025-pg-stat-statements-query-monitoring.md)                                                  |
| Repository pattern            | `backend/src/nest/database/repositories/`                                                                               | Shared repo base class                                                                                                                            |
| Shared types (cross-package)  | `shared/src/types/` · `shared/src/index.ts`                                                                             | Zod schemas + TS types re-exportable · [ADR-015](./infrastructure/adr/ADR-015-shared-package-architecture.md)                                     |
| Shared constants              | `shared/src/constants/`                                                                                                 | `IS_ACTIVE` (0/1/3/4), enum values                                                                                                                |

### 1.7 Infrastructure & Tooling

| Concept                    | Entry Point                                                                                                         | Why                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Docker Compose             | `docker/docker-compose.yml` · `docker/Dockerfile.dev` · `docker/Dockerfile` · `docker/Dockerfile.frontend`          | Dev + prod profiles · [ADR-027](./infrastructure/adr/ADR-027-dockerfile-hardening.md)                              |
| Nginx reverse proxy (prod) | `docker/nginx/`                                                                                                     | Port 80 → SvelteKit:3001 + Backend:3000                                                                            |
| Environment secrets        | Doppler (`doppler run -- ...`)                                                                                      | No committed `.env` · [HOW-TO-DOPPLER-GUIDE.md](./how-to/HOW-TO-DOPPLER-GUIDE.md)                                  |
| CI/CD                      | `.github/workflows/` · [ADR-013](./infrastructure/adr/ADR-013-ci-cd-pipeline-hardening.md)                          | Build/test/deploy gates                                                                                            |
| TypeScript strict config   | `tsconfig.json` (root + per-package) · [ADR-041](./infrastructure/adr/ADR-041-typescript-compiler-configuration.md) | Never weaken strict flags                                                                                          |
| ESLint (backend)           | `eslint.config.mjs`                                                                                                 | Flat config                                                                                                        |
| ESLint (frontend)          | `frontend/eslint.config.mjs`                                                                                        | Svelte-aware rules                                                                                                 |
| Backend tests (Vitest)     | `backend/src/nest/**/*.test.ts`                                                                                     | Collocated · [ADR-018](./infrastructure/adr/ADR-018-testing-strategy.md)                                           |
| E2E tests (Playwright)     | `e2e/`                                                                                                              | See [HOW-TO-TEST.md](./how-to/HOW-TO-TEST.md)                                                                      |
| Rate limiting              | `backend/src/nest/throttler/` · `backend/src/nest/common/guards/throttler.guard.ts`                                 | Redis-backed · [ADR-001](./infrastructure/adr/ADR-001-rate-limiting.md)                                            |
| Alerting / Sentry          | `backend/src/nest/instrument.ts` · Sentry config                                                                    | [ADR-002](./infrastructure/adr/ADR-002-alerting-monitoring.md) · [HOW-TO-ALERTING.md](./how-to/HOW-TO-ALERTING.md) |
| Tenant-domain verification | `backend/src/nest/domains/`                                                                                         | [ADR-049](./infrastructure/adr/ADR-049-tenant-domain-verification.md)                                              |
| Tenant deletion (GDPR)     | `backend/src/nest/tenant-deletion/`                                                                                 | Soft-delete with root approval gate                                                                                |
| Claude Code hooks          | `.claude/settings.json` + `.claude/hooks/`                                                                          | [ADR-047](./infrastructure/adr/ADR-047-claude-code-hook-strategy.md)                                               |

### 1.8 Frequently-needed Knowledge (not in source code)

| Knowledge                            | Authoritative File                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| How to write a migration (Up + Down) | [`docs/DATABASE-MIGRATION-GUIDE.md`](./DATABASE-MIGRATION-GUIDE.md)                                             |
| How to add a new Addon               | [`docs/how-to/HOW-TO-INTEGRATE-FEATURE.md`](./how-to/HOW-TO-INTEGRATE-FEATURE.md)                               |
| Backend code style                   | [`docs/CODE-OF-CONDUCT.md`](./CODE-OF-CONDUCT.md) · [`docs/TYPESCRIPT-STANDARDS.md`](./TYPESCRIPT-STANDARDS.md) |
| Frontend (Svelte) style              | [`docs/CODE-OF-CONDUCT-SVELTE.md`](./CODE-OF-CONDUCT-SVELTE.md)                                                 |
| All HOW-TO guides                    | [`docs/how-to/README.md`](./how-to/README.md)                                                                   |
| All ADR index                        | [`docs/infrastructure/adr/README.md`](./infrastructure/adr/README.md)                                           |
| Masterplans (per-feature)            | `docs/FEAT_*_MASTERPLAN.md`                                                                                     |
| Production vs development testing    | [`docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md`](./PRODUCTION-AND-DEVELOPMENT-TESTING.md)                         |
| Common shell commands                | [`docs/COMMON-COMMANDS.md`](./COMMON-COMMANDS.md)                                                               |

---

## 2. Tech Stack

### Backend

| Technology             | Version | Role                                                                                                        |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Node.js                | 24.x    | Runtime                                                                                                     |
| TypeScript             | 5.x     | Language (strict-everywhere · [ADR-041](./infrastructure/adr/ADR-041-typescript-compiler-configuration.md)) |
| NestJS                 | 11.x    | Framework on top of Fastify (NOT Express)                                                                   |
| Fastify                | latest  | HTTP adapter                                                                                                |
| PostgreSQL             | 18.3    | Primary DB · [ADR-043](./infrastructure/adr/ADR-043-postgresql-18-upgrade.md)                               |
| `pg`                   | 8.16.3  | Postgres driver (native UUIDv7 in PG 18)                                                                    |
| Redis                  | 7.x     | Sessions, rate limit, cache                                                                                 |
| Zod                    | 3.x     | Validation (sole library · [ADR-030](./infrastructure/adr/ADR-030-zod-validation-architecture.md))          |
| nestjs-cls             | latest  | Per-request CLS                                                                                             |
| node-pg-migrate        | latest  | Migrations                                                                                                  |
| Vitest                 | 2.x     | Tests                                                                                                       |
| Pino                   | latest  | Logging                                                                                                     |
| Sentry + OpenTelemetry | latest  | Tracing                                                                                                     |
| pnpm                   | 10.27.0 | Package manager                                                                                             |

### Frontend

| Technology   | Version | Role                         |
| ------------ | ------- | ---------------------------- |
| SvelteKit    | 5.x     | Framework (adapter-node SSR) |
| TypeScript   | 5.x     | Language                     |
| Vite         | 7.x     | Dev/build                    |
| Tailwind CSS | 4.x     | Styling                      |
| FullCalendar | 6.x     | Calendar UI                  |
| Playwright   | latest  | E2E                          |

### Infrastructure

| Technology              | Role                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| Docker + Docker Compose | Containerization + orchestration                                            |
| Nginx                   | Production reverse proxy (`:80` → SvelteKit `:3001` + Backend `:3000`)      |
| Doppler                 | Secret management (no `.env` committed)                                     |
| GitHub Actions          | CI/CD · [ADR-013](./infrastructure/adr/ADR-013-ci-cd-pipeline-hardening.md) |

---

## 3. Runtime Topology

```
                            ┌──────────────────┐
   Browser / PWA  ─── HTTPS ─► Nginx :80       │  (production)
                            │ reverse proxy    │
                            └────┬─────────┬───┘
                                 │         │
                  ┌──────────────┘         └────────────┐
                  │                                      │
       ┌──────────▼──────────┐              ┌───────────▼────────────┐
       │ SvelteKit SSR :3001 │              │ NestJS + Fastify :3000 │
       │ adapter-node        │ ──── /api ──►│ /api/v2/*              │
       │ (app) / (public)    │              │                        │
       └─────────────────────┘              │ ┌────────────────────┐ │
                                            │ │ Middleware         │ │
                                            │ │  ├─ tenant-host    │ │
                                            │ │  ├─ JwtAuthGuard   │ │
                                            │ │  ├─ ClsService     │ │
                                            │ │  ├─ tenant-addon   │ │
                                            │ │  ├─ permission     │ │
                                            │ │  └─ response int.  │ │
                                            │ └────────────────────┘ │
                                            └────┬───────┬───────────┘
                                                 │       │
                        ┌────────────────────────┘       └──────────────┐
                        │                                                │
              ┌─────────▼─────────┐                          ┌──────────▼──────────┐
              │ PostgreSQL 18.3   │                          │ Redis 7             │
              │  ├─ app_user (RLS)│                          │  ├─ sessions        │
              │  ├─ sys_user      │                          │  ├─ rate limit      │
              │  └─ assixx_user   │                          │  └─ cache           │
              │ (see ADR-019)     │                          └─────────────────────┘
              └───────────────────┘
```

Dev mode: `pnpm run dev:svelte` gives Vite HMR at `:5173` + Backend at `:3000` (no Nginx).

---

## 4. Multi-Tenant Strategy

**Single database, RLS-enforced isolation.** See [ADR-006](./infrastructure/adr/ADR-006-multi-tenant-context-isolation.md) + [ADR-019](./infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md).

1. Every tenant-owned table carries `tenant_id INTEGER NOT NULL`.
2. Request arrives → `tenant-host-resolver.middleware` resolves subdomain → `JwtAuthGuard` validates JWT → populates CLS with `tenantId`.
3. `DatabaseService` acquires a connection as `app_user` and runs `SET LOCAL app.tenant_id = <id>`.
4. RLS policies on every tenant table `USING (tenant_id = current_setting('app.tenant_id')::int)`.
5. `assixx_user` (superuser) and `sys_user` (tooling) **BYPASS RLS** — used for migrations/seeds/cross-tenant jobs only. Never from request handlers.

**Hierarchy labels warning** ([ADR-034](./infrastructure/adr/ADR-034-hierarchy-labels-propagation.md)): a tenant can rename `area` → "Abteilung" in the UI. The DB column stays `area_id`. **Trust DB column names and URL paths (`/manage-areas`), never UI text.**

---

## 5. Permission Stack (3-Layer · [ADR-045](./infrastructure/adr/ADR-045-permission-visibility-design.md))

Every action traverses up to three independent gates. **If any gate denies, the action is forbidden.** Creator bypass is an optional per-feature override on top.

```
   Request
      │
      ▼
┌──────────────────────────────────────┐
│ Layer 0: Addon subscription          │  Has the tenant booked this addon?
│   tenant-addon.guard.ts              │  Checks tenant_addons row.
└──────────┬───────────────────────────┘  Fail → /addon-unavailable
           │
           ▼
┌──────────────────────────────────────┐
│ Layer 1: Management gate             │  "Can this user manage this module?"
│   permission.guard.ts via            │  role + has_full_access +
│   @RequirePermission(ADDON, MODULE)  │  Lead-scope + Deputy-toggle.
│                                      │  Replaces every isAdmin shortcut.
└──────────┬───────────────────────────┘  Fail → /permission-denied | 403
           │
           ▼
┌──────────────────────────────────────┐
│ Layer 2: Action permission           │  Fine-grained per-user rights.
│   user-permissions.service.ts via    │  canRead / canWrite / canDelete
│   @RequirePermission(ADDON, MODULE,  │  stored in user_addon_permissions.
│                     'canWrite')      │
└──────────┬───────────────────────────┘  Fail → 403
           │
           ▼
     [Creator bypass — optional]
     authorId === currentUser.id
     → edit/delete own content (service-internal, NOT a controller guard)
```

Both Layer 1 and Layer 2 are enforced by the same `permission.guard.ts`; what differs is the `@RequirePermission` signature: without an action it is a management check, with an action (`canWrite` etc.) it is a fine-grained action check.

**Terminology ([ADR-033](./infrastructure/adr/ADR-033-addon-based-saas-model.md)):** "Addon" replaces the deprecated term "Feature". DB: `addons`, `tenant_addons`, `user_addon_permissions`. UI: "Modul".

---

## 6. Project Structure

```
Assixx/
├── backend/
│   ├── src/nest/
│   │   ├── main.ts                        # entry
│   │   ├── app.module.ts                  # root module + ClsModule
│   │   ├── instrument.ts                  # Sentry + OTel
│   │   ├── common/
│   │   │   ├── guards/                    # jwt-auth, permission, roles, tenant-addon
│   │   │   ├── interceptors/              # response, audit-trail
│   │   │   ├── middleware/                # tenant-host-resolver
│   │   │   ├── permission-registry/       # decentralized registry
│   │   │   ├── audit/                     # audit-log writer
│   │   │   ├── decorators/ filters/ pipes/
│   │   │   └── logger/ services/ utils/
│   │   ├── auth/ addons/ tenants/ users/ roles/
│   │   ├── areas/ departments/ teams/ organigram/
│   │   ├── admin-permissions/ user-permissions/ hierarchy-permission/
│   │   ├── shift-handover/ shifts/ tpm/ calendar/ kvp/ blackboard/
│   │   ├── chat/ documents/ surveys/ notifications/ vacation/
│   │   ├── approvals/ work-orders/ inventory/ reports/
│   │   ├── e2e-keys/ e2e-escrow/
│   │   └── database/                      # pool + repositories
│   ├── test/                              # API integration tests
│   └── docs/                              # backend-specific docs
├── frontend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── (app)/                     # authenticated
│   │   │   │   ├── (root)/                # role=root only
│   │   │   │   ├── (admin)/               # role=admin only
│   │   │   │   ├── (shared)/              # any authenticated role
│   │   │   │   ├── addon-unavailable/     # Layer-1 deny page
│   │   │   │   └── permission-denied/     # Layer-3 deny page
│   │   │   ├── (public)/                  # public
│   │   │   └── api/ health/ reset-password/ ...
│   │   ├── design-system/                 # shared UI components
│   │   ├── lib/                           # helpers, feature guards
│   │   └── styles/tailwind/base.css       # Tailwind 4 tokens
│   └── eslint.config.mjs
├── shared/
│   └── src/
│       ├── constants/                     # IS_ACTIVE, enums
│       ├── helpers/
│       ├── shift-handover/                # cross-package types
│       ├── types/
│       └── index.ts                       # public API
├── database/
│   ├── migrations/                        # node-pg-migrate (*.ts)
│   ├── seeds/
│   ├── backups/
│   └── README.md
├── docker/
│   ├── docker-compose.yml                 # dev + production profile
│   ├── Dockerfile.dev / Dockerfile / Dockerfile.frontend
│   └── nginx/                             # prod reverse-proxy config
├── docs/
│   ├── ARCHITECTURE.md                    # this file
│   ├── README.md … COMMON-COMMANDS.md
│   ├── how-to/                            # HOW-TO-*.md guides
│   ├── infrastructure/adr/                # ADR-001…052
│   └── FEAT_*_MASTERPLAN.md               # per-feature plans
├── e2e/                                   # Playwright
├── CLAUDE.md                              # project instructions (auto-loaded)
├── CLAUDE-KAIZEN-MANIFEST.md              # required reading
└── eslint.config.mjs
```

---

## 7. API Surface

- **Base path:** `/api/v2/` (no V1 fallback)
- **Response envelope:** `{ success, data, error, meta }` — [ADR-007](./infrastructure/adr/ADR-007-api-response-standardization.md)
- **Auth:** `Authorization: Bearer <jwt>` — see [ADR-005](./infrastructure/adr/ADR-005-authentication-strategy.md)
- **Validation:** Zod DTOs, automatic 400 on violation — [ADR-030](./infrastructure/adr/ADR-030-zod-validation-architecture.md)

Module list: every folder under `backend/src/nest/` (except `common/`, `database/`, `config/`) that contains a `*.module.ts` exposes an `/api/v2/<module>` surface. Use section 1.4 for Addon modules, or `grep '^@Controller' backend/src/nest/**/*.controller.ts` for a live list.

---

## 8. Key Field Conventions

| Field                       | Type                    | Meaning                                                                                |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `id`                        | `UUID (v7)` or `SERIAL` | PK — new tables UUIDv7 (PG18 built-in), legacy SERIAL                                  |
| `tenant_id`                 | `INTEGER`               | Tenant FK, RLS-enforced                                                                |
| `is_active`                 | `SMALLINT`              | 0=inactive, 1=active, 3=archived, 4=soft-deleted — constants in `shared/src/constants` |
| `created_at` / `updated_at` | `TIMESTAMPTZ`           | Audit timestamps                                                                       |
| `deleted_at`                | `TIMESTAMPTZ NULL`      | Soft-delete marker (some tables)                                                       |

---

## 9. Where to Dig Deeper

| You need…                      | Read                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Why a design decision was made | ADR (see table above, or [index](./infrastructure/adr/README.md))                                 |
| How to perform a task          | [HOW-TO index](./how-to/README.md)                                                                |
| Current work on feature X      | `docs/FEAT_X_MASTERPLAN.md`                                                                       |
| Coding rules (backend)         | [CODE-OF-CONDUCT.md](./CODE-OF-CONDUCT.md) · [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) |
| Coding rules (frontend)        | [CODE-OF-CONDUCT-SVELTE.md](./CODE-OF-CONDUCT-SVELTE.md)                                          |
| Commands cheat sheet           | [COMMON-COMMANDS.md](./COMMON-COMMANDS.md)                                                        |
| Session bootstrap              | [CLAUDE.md](../CLAUDE.md) mandatory checklist                                                     |

---

## 10. Maintenance Rules for This Document

1. **When you move a file referenced here, update the row in the same PR.** A broken map is worse than no map.
2. **When you add a new addon module**, add a row to §1.4.
3. **When you add a new ADR (≥ 053)**, link it from the relevant row — don't just drop it in the ADR folder.
4. **Line numbers** are only for stable class/function definitions. If a line ref goes stale frequently, drop the line and cite the file only.
5. **Version header** — bump minor when adding rows, major when restructuring sections. Use today's date.
6. **Never duplicate** — if information lives in an ADR or HOW-TO, link, do not copy. This doc is a map, not an encyclopedia.

---

**Related files auto-loaded by Claude Code:** [CLAUDE.md](../CLAUDE.md) · [CLAUDE-KAIZEN-MANIFEST.md](../CLAUDE-KAIZEN-MANIFEST.md)
