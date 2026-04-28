# ADR-033: Addon-based SaaS Model (replaces Plan Tiers)

| Metadata                | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                   |
| **Date**                | 2026-03-10 (Updated: 2026-04-03)                                                                           |
| **Decision Makers**     | SCS Technik                                                                                                |
| **Supersedes**          | ADR-032 (Feature catalog and plan-tier mapping)                                                            |
| **Affected Components** | PostgreSQL (10+ tables), Backend (Guards, Services, Controllers), Frontend (Guards, Navigation), Seed data |
| **Related ADRs**        | ADR-020 (Per-User Permissions), ADR-024 (Frontend Feature Guards), ADR-032 (Superseded)                    |

---

## Context

### The Problem: Plan Tiers Don't Fit the Target Audience

The previous 3-tier model (Basic €49 / Professional €149 / Enterprise €299) forces industrial companies to buy expensive packages just to use a single feature. A company that only needs TPM has to license Enterprise (€299/month) — even though it does not use 17 of the 20 features.

**Core problems:**

1. **Inflexible:** companies pay for features they don't need
2. **High entry barrier:** €149 for Professional, even if only 1–2 premium features are needed
3. **No granularity:** all-or-nothing per tier level
4. **Complex codebase:** 3 plans × 20 features × 60 mapping rules — unnecessary complexity
5. **Inconsistencies:** `features.category` vs `plan_features.is_included` (ADR-032 documented 9 errors)

### Requirements

- Each company pays only for what it uses
- Simple, transparent pricing model
- 30-day trial per addon without payment obligation
- Data is preserved on deactivation (reactivation possible at any time)
- Unlimited users in Core (no employee/admin limits)
- Architecture prepared for payment integration (Stripe/PayPal)

---

## Decision

### New Model: Core + à la carte Addons

```
┌──────────────────────────────────────────────────────────┐
│  CORE (base fee €X/month — price TBD)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ∞ Users (Root, Admin, Employee)                    │  │
│  │ 100 GB Storage (default)                           │  │
│  │ 14 Core addons (always active)                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  + arbitrary addons à la carte (€10/month each)          │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│    │ TPM  │ │ Chat │ │ KVP  │ │ ...  │                   │
│    └──────┘ └──────┘ └──────┘ └──────┘                  │
└──────────────────────────────────────────────────────────┘
```

**No bundles, no tiers, no packages.** Every company assembles its setup individually.

### Naming Convention

| Context             | Term     | Example                                        |
| ------------------- | -------- | ---------------------------------------------- |
| Code / DB / Backend | `addon`  | `addons`, `tenant_addons`, `AddonCheckService` |
| Frontend (internal) | `addon`  | `addonGuard()`, `activeAddons`                 |
| Landing page / UI   | "Modul"  | "TPM Modul", "Chat Modul"                      |
| NestJS Module       | `Module` | `TpmModule`, `ChatModule`                      |

> **Why `addon` instead of `module`?** NestJS uses `Module` as a core concept (`@Module()`). `addon` avoids naming collisions and is immediately recognizable as a business concept in the code.

---

## Addon Catalog (24 Addons)

### Core Addons (14) — Always active, included in base fee

| #   | Code               | Name                     | Description                                                 | Permission modules                                                                                                           |
| --- | ------------------ | ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `dashboard`        | Dashboard                | Central overview with KPIs and quick access                 | — (no guard)                                                                                                                 |
| 2   | `settings`         | Settings                 | Tenant settings and configuration                           | `settings-tenant` (W/D)                                                                                                      |
| 3   | `notifications`    | Notifications            | Push notifications and SSE streaming                        | `notifications-manage` (R/W)                                                                                                 |
| 4   | `employees`        | Employee management      | Create, edit, deactivate users                              | `employees-manage` (R/W/D), `employees-availability` (R/W/D)                                                                 |
| 5   | `departments`      | Departments              | Departments and areas (organizational structure)            | `departments-manage` (W/D), `areas-manage` (W/D)                                                                             |
| 6   | `teams`            | Teams                    | Manage teams, assign members and assets                     | `teams-manage` (W/D)                                                                                                         |
| 7   | `manage_hierarchy` | Organizational structure | Manage areas, departments, teams and employees              | `manage-areas` (R/W), `manage-departments` (R/W), `manage-teams` (R/W), `manage-employees` (R/W), `manage-permissions` (R/W) |
| 8   | `halls`            | Halls                    | Manage production halls                                     | `halls-manage` (W/D)                                                                                                         |
| 9   | `assets`           | Assets & machines        | Asset/machine management with availability tracking         | `assets-manage` (W/D), `assets-availability` (W/D)                                                                           |
| 10  | `dummy_users`      | Placeholder users        | Anonymous display accounts for factory screens (kiosk mode) | `dummy-users-manage` (R/W/D)                                                                                                 |
| 11  | `approvals`        | Approvals                | Central approval system for authorization workflows         | `approvals-manage` (R/W/D), `approvals-request` (R/W)                                                                        |
| 12  | `user_profiles`    | User profiles            | Profile view and employee overview                          | `user-profiles-view` (R)                                                                                                     |
| 13  | `calendar`         | Calendar                 | Shared company calendar                                     | `calendar-events` (R/W/D)                                                                                                    |
| 14  | `blackboard`       | Blackboard               | Digital blackboard for announcements                        | `blackboard-posts` (R/W/D), `blackboard-comments` (R/W/D), `blackboard-archive` (R/W)                                        |

> **Changes since v1 (2026-03-10):** `assets`, `dummy_users` moved Purchasable → Core (2026-04-03). `halls`, `user_profiles` added as new core addons (2026-03-31 / 2026-04-03).

### Purchasable Addons (10) — €10/month each (provisional), 30-day trial

| #   | Code             | Name                | Description                                                        | Permission modules                                                                                                                           |
| --- | ---------------- | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | `documents`      | Documents           | Document management with upload, archive and access control        | `documents-files` (R/W/D), `documents-archive` (R/W)                                                                                         |
| 16  | `vacation`       | Vacation management | Digital vacation requests, approval workflow, capacity check       | `vacation-requests` (R/W/D), `vacation-rules` (R/W/D), `vacation-entitlements` (R/W/D), `vacation-holidays` (R/W/D), `vacation-overview` (R) |
| 17  | `shift_planning` | Shift planning      | Shift schedules, swap board, rotation, shift times                 | `shift-plan` (R/W/D), `shift-swap` (R/W), `shift-rotation` (R/W/D), `shift-times` (R/W)                                                      |
| 18  | `chat`           | Chat                | Team chat with conversations and messages                          | `chat-conversations` (R/W/D), `chat-messages` (R/W/D)                                                                                        |
| 19  | `work_orders`    | Work orders         | Cross-module order system                                          | `work-orders-manage` (R/W/D), `work-orders-execute` (R/W)                                                                                    |
| 20  | `surveys`        | Surveys             | Create, run and evaluate surveys                                   | `surveys-manage` (R/W/D), `surveys-participate` (R/W), `surveys-results` (R)                                                                 |
| 21  | `kvp`            | KVP                 | Continuous improvement process — suggestion system                 | `kvp-suggestions` (R/W/D), `kvp-comments` (R/W/D)                                                                                            |
| 22  | `tpm`            | TPM / maintenance   | Total Productive Maintenance — Kamishibai board, maintenance plans | `tpm-plans` (R/W/D), `tpm-cards` (R/W/D), `tpm-executions` (R/W), `tpm-config` (R/W), `tpm-locations` (R/W/D)                                |
| 23  | `reports`        | Reports & analytics | Company reports, analytics and data exports                        | `reports-view` (R), `reports-export` (R/W)                                                                                                   |
| 24  | `audit_trail`    | Audit log           | Audit logging, compliance reports                                  | `audit-view` (R), `audit-export` (R/W), `audit-retention` (R/D)                                                                              |
| 25  | `inventory`      | Inventory           | Equipment inventory management with lists, custom fields, QR       | `inventory-lists` (R/W/D), `inventory-items` (R/W/D)                                                                                         |

---

## Deactivation Behaviour (Critical Change)

| Aspect               | Old (plan tiers)                        | New (addon model)                                  |
| -------------------- | --------------------------------------- | -------------------------------------------------- |
| **Data**             | Stays in DB                             | Stays in DB — **identical**                        |
| **User permissions** | **DELETED** on feature deactivation     | **PRESERVED** — permissions survive deactivation   |
| **UI access**        | Blocked (403)                           | Blocked (403) — **identical**                      |
| **Reactivation**     | Permissions must be re-granted manually | Fully functional immediately, all permissions kept |
| **Navigation**       | Addon disappears from sidebar           | Addon disappears from sidebar — **identical**      |

> **Rationale:** Deleting user permissions on deactivation is destructive and creates extra work on reactivation. An admin who has granted TPM rights to 50 employees does not want to reconfigure everything.

---

## Database Changes

### Table Overview

| Action   | Old                        | New                      | Rationale                                      |
| -------- | -------------------------- | ------------------------ | ---------------------------------------------- |
| RENAME   | `features`                 | `addons`                 | Naming consistency                             |
| RECREATE | `tenant_features`          | `tenant_addons`          | New columns for licensing + trial              |
| DROP     | `plans`                    | —                        | No more plan tiers                             |
| DROP     | `plan_features`            | —                        | Deterministic mapping is gone                  |
| DROP     | `tenant_plans`             | —                        | No more plan subscriptions                     |
| DROP     | `tenant_addons` (old)      | —                        | Capacity upgrades deprecated (unlimited users) |
| RENAME   | `feature_usage_logs`       | `addon_usage_logs`       | Naming consistency                             |
| RENAME   | `feature_visits`           | `addon_visits`           | Naming consistency                             |
| RENAME   | `user_feature_permissions` | `user_addon_permissions` | Naming consistency                             |
| ALTER    | `tenants`                  | `tenants`                | Drop `current_plan*` columns                   |
| CREATE   | —                          | `tenant_storage`         | Storage tracking (placeholder for the future)  |

### Schema: `addons` (formerly `features`)

```sql
-- Changes to existing table:
ALTER TABLE features RENAME TO addons;
-- New columns:
ALTER TABLE addons ADD COLUMN is_core BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE addons ADD COLUMN trial_days INTEGER DEFAULT 30;
-- Rename existing column:
ALTER TABLE addons RENAME COLUMN base_price TO price_monthly;
-- Drop column:
ALTER TABLE addons DROP COLUMN category;
-- DROP TYPE features_category;
```

### Schema: `tenant_addons` (new, replaces `tenant_features`)

```sql
CREATE TABLE tenant_addons (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_id INTEGER NOT NULL REFERENCES addons(id),
    status tenant_addon_status NOT NULL DEFAULT 'trial',
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    payment_reference TEXT,
    custom_price NUMERIC(8,2),
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, addon_id)
);

-- ENUM
CREATE TYPE tenant_addon_status AS ENUM ('trial', 'active', 'expired', 'cancelled');

-- RLS
ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_addons FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_addons_isolation ON tenant_addons
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER);
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_addons TO app_user;

-- Indexes
CREATE INDEX idx_tenant_addons_tenant ON tenant_addons(tenant_id) WHERE is_active = 1;
CREATE INDEX idx_tenant_addons_status ON tenant_addons(tenant_id, status) WHERE is_active = 1;
```

### Schema: `tenant_storage` (placeholder)

```sql
CREATE TABLE tenant_storage (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    storage_limit_gb INTEGER NOT NULL DEFAULT 100,
    storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Changes to `tenants`

```sql
ALTER TABLE tenants DROP COLUMN current_plan;
ALTER TABLE tenants DROP COLUMN current_plan_id;
-- DROP TYPE tenants_current_plan;
```

### Deprecated ENUMs (to be removed)

| ENUM                         | Reason                     |
| ---------------------------- | -------------------------- |
| `features_category`          | No more tier categories    |
| `tenants_current_plan`       | No more plan assignment    |
| `tenant_plans_status`        | tenant_plans table is gone |
| `tenant_plans_billing_cycle` | tenant_plans table is gone |
| `tenant_addons_addon_type`   | Old capacity table is gone |

---

## Backend Changes

### Renames (Consistency)

| Old                                     | New                                 |
| --------------------------------------- | ----------------------------------- |
| `FeatureCheckService`                   | `AddonCheckService`                 |
| `FeatureCheckModule`                    | `AddonCheckModule`                  |
| `@TenantFeature('code')`                | `@RequireAddon('code')`             |
| `TenantFeatureGuard`                    | `TenantAddonGuard`                  |
| `FeaturesService`                       | `AddonsService`                     |
| `FeaturesController` (`/features`)      | `AddonsController` (`/addons`)      |
| `FeaturesModule`                        | `AddonsModule`                      |
| `RequirePermission(featureCode, ...)`   | `RequirePermission(addonCode, ...)` |
| `user_feature_permissions.feature_code` | `user_addon_permissions.addon_code` |
| All permission registrars `featureCode` | `addonCode`                         |

### Deletions

| File / module                | Reason                 |
| ---------------------------- | ---------------------- |
| `PlansService`               | No more plans          |
| `PlansController` (`/plans`) | No more plan endpoints |
| `PlansModule`                | No more plan logic     |
| All plan DTOs                | Obsolete               |

### AddonCheckService — New Logic

```typescript
async checkTenantAccess(tenantId: number, addonCode: string): Promise<boolean> {
    // 1. Look up the addon
    // 2. If addon.is_core → return true immediately (always active)
    // 3. If not core → check tenant_addons:
    //    - status 'active' → true
    //    - status 'trial' + trial_ends_at > now() → true
    //    - else → false (expired/cancelled/no entry)
}
```

### Deactivation Logic — Changed

```typescript
async deactivateAddon(tenantId: number, addonCode: string): Promise<void> {
    // 1. tenant_addons.status → 'cancelled'
    // 2. tenant_addons.deactivated_at → now()
    // 3. tenant_addons.is_active → 0
    // 4. DO NOT delete user_addon_permissions!
    // 5. Data in all addon tables remains untouched
}
```

---

## Frontend Changes

### Renames

| Old                        | New                      |
| -------------------------- | ------------------------ |
| `feature-guard.ts`         | `addon-guard.ts`         |
| `requireFeature()`         | `requireAddon()`         |
| `filterMenuByFeatures()`   | `filterMenuByAddons()`   |
| `activeFeatures: string[]` | `activeAddons: string[]` |
| `NavItem.featureCode`      | `NavItem.addonCode`      |
| `/feature-unavailable`     | `/addon-unavailable`     |
| `parseActiveFeatures()`    | `parseActiveAddons()`    |

### Affected Files

- `frontend/src/lib/utils/addon-guard.ts` (rename + tests)
- `frontend/src/routes/(app)/+layout.server.ts` (activeAddons instead of activeFeatures)
- `frontend/src/routes/(app)/+layout.svelte` (filterMenuByAddons)
- `frontend/src/routes/(app)/_lib/navigation-config.ts` (addonCode)
- Every `+page.server.ts` with `requireFeature()` → `requireAddon()`
- `/addon-unavailable/+page.svelte` (rename of feature-unavailable)

---

## User Limits — Simplified

| Aspect        | Old (plan tiers)                         | New (addon model)                                                  |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Max employees | Basic: 10, Pro: 50, Enterprise: ∞        | **Unlimited** (Core)                                               |
| Max admins    | Basic: 1, Pro: 3, Enterprise: ∞          | **Unlimited** (Core)                                               |
| Storage       | Basic: 100 GB, Pro: 500 GB, Ent: 1000 GB | **100 GB default** (Core), upgrade separately via `tenant_storage` |

> **User limits are removed entirely.** Every tenant can create unlimited users. Storage upgrades are a separate concept (own table), independent from the addon system.

---

## Payment Integration (Architectural Preparation)

The addon architecture is prepared for payment integration:

- `tenant_addons.status` → controls access (trial → active after payment)
- `tenant_addons.payment_reference` → Stripe Subscription ID / PayPal Agreement ID
- `tenant_addons.custom_price` → override for negotiated prices

**In development:** Addons can be activated/deactivated freely without a payment check. The payment integration (Stripe/PayPal webhooks → status updates) is a separate phase after the refactor.

---

## Alternatives Considered

### Option A: Keep plan tiers + add individual purchase

Hybrid model: plans as "starter packages" + à la carte on top.

**Rejected:** double complexity. Two systems in parallel (plan logic + addon logic) with conflict potential. Violates KISS.

### Option B: Feature bundles instead of individual purchase

Thematic packages (e.g. "Production" = TPM + Assets + Work Orders).

**Rejected:** same inflexibility as tiers, only at finer granularity. Customer still pays for features they don't need.

### Option C: `module` instead of `addon` as code term

**Rejected:** direct collision with NestJS `@Module()`. `TpmModule` (NestJS) vs `modules` table (business) — confusing. `addon` is unambiguous.

---

## Consequences

### Positive

1. **Maximum flexibility** — every company pays only for what it uses
2. **Low entry barrier** — Core base fee instead of €149+ for a plan upgrade
3. **Transparent pricing** — €10/addon/month, no hidden tier logic
4. **Simpler codebase** — no plan matching, no tier hierarchy, no `plan_features` matrix
5. **Data safety** — deactivation deletes neither data nor permissions
6. **Unlimited users** — no artificial limit on employees or admins
7. **Trial-capable** — 30-day test per addon without commitment

### Negative

1. **Large refactor** — ~10 sessions, 10+ tables, backend + frontend affected
2. **Migration of existing tenants** — data must be migrated correctly
3. **No revenue floor per tier** — customer could buy Core only (lowest revenue)
4. **Payment integration open** — until Stripe/PayPal is implemented, no automated billing

### Mitigations

| Problem                       | Mitigation                                               |
| ----------------------------- | -------------------------------------------------------- |
| Large refactor                | Phased execution with DoD per phase, masterplan          |
| Migration of existing tenants | Data migration in its own migration file with rollback   |
| Low revenue per tenant        | Core base fee secures the minimum; addons are the upsell |
| Missing payment integration   | Status-based architecture allows later integration       |

---

## References

- [ADR-032: Feature catalog and plan-tier mapping](./ADR-032-feature-catalog-and-plan-tiers.md) — **Superseded by this ADR**
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — permission registry pattern (kept, only renamed)
- [ADR-024: Frontend Feature Guards](./ADR-024-frontend-feature-guards.md) — frontend gating (kept, only renamed)
- [Masterplan](../../FEAT_ADDON_SYSTEM_MASTERPLAN.md) — execution plan for this refactor
