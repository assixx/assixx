# KVP Sharing Visibility Rules

> **Last Update:** 2026-04-26
> **Affects:** `kvp.helpers.ts` (`buildVisibilityClause`), `kvp-lifecycle.service.ts` (`shareSuggestion`)

---

## Visibility Levels (cascading)

Each level includes everything from the previous level.

### Level 0: Not Shared (`is_shared = false`)

- **Creator** (`submitted_by`) sees it
- **Team Lead** of the assigned team sees it
- **Deputy Lead** of the assigned team sees it **only when the per-tenant
  `deputy_has_lead_scope` toggle is enabled** (ADR-039). Visibility is gated
  through `ScopeService` → `leadTeamIds`, so the toggle is enforced by the
  same code path as management scope. The earlier SQL bypass on
  `teams.team_deputy_lead_id` was removed 2026-04-26.
- Nobody else — in particular, department/area leads do **not** see unshared
  team-level KVPs through hierarchy cascade. They must be granted access via
  sharing or by being configured as KVP approval master.

### Level 1: Shared to Team (`org_level = 'team'`)

- Everything from Level 0
- **All team members** (`user_teams`) of the shared team see it
- Team Lead + Deputy Lead see it

### Level 2: Shared to Department (`org_level = 'department'`)

- Everything from Level 1
- **All teams** assigned to this department see it (all members of those teams)
- **Department Lead** (`department_lead_id`) sees it

### Level 3: Shared to Area (`org_level = 'area'`)

- Everything from Level 2
- **All departments** in the area see it (all teams in those departments)
- **Area Lead** (`area_lead_id`) sees it

### Level 4: Shared to Company (`org_level = 'company'`)

- **Everyone** in the tenant sees it (multi-tenant isolation via `tenant_id` + RLS)

---

## Always visible (regardless of sharing)

- Suggestions with `status = 'implemented'` are visible to everyone
- `has_full_access = true` bypasses all visibility checks

---

## Approval Master visibility (separate axis)

Users configured in `approval_configs` (addon `kvp`) — either as
`approver_user_id` or via `approver_position_id` — receive visibility on KVPs
that fall within their configured scope (`scope_area_ids`,
`scope_department_ids`, `scope_team_ids`; NULL on all three = whole tenant).

**Status gate (added 2026-04-26):** the master only sees KVPs whose status is
**not** in `('new', 'restored')`. Both are team-lead-zone states defined in
`validateApprovalStatusTransition()` — the team lead is allowed to reject them
directly without ever escalating to the master, so surfacing them earlier
would flood the master's inbox with KVPs they may never need to act on.
Visibility resumes the moment the status leaves that zone (`in_review`,
`approved`, `rejected`-via-master, `implemented`, `archived`), giving the
master full audit access without the noise.

This visibility path is independent of the cascading sharing model above and
of `has_full_access`. A KVP that is `is_shared = false` and `status = 'new'`
is therefore visible **only** to creator + team lead + (toggle-gated) deputy
lead — not to the master, not to department/area leads, not to other admins.

---

## Key Distinction: Management Scope vs. Content Visibility

| Concept                           | Purpose                                    | Example                                                                   |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| **Management Scope** (ADR-036)    | Who can manage entities (teams, employees) | Dept-Lead manages all teams in their department                           |
| **Content Visibility** (this doc) | Who can see shared content                 | Dept-Lead does NOT see team-level shared KVP unless they're a team member |

A department lead has management scope over all teams in their department. But that does **NOT** grant visibility to team-level shared KVP suggestions. If the team lead wants the department lead to see it, they must share at department level.

---

## Implementation

- **SQL:** `buildVisibilityClause()` in `kvp.helpers.ts`
- **Team-level checks:** Use `user_teams` JOIN (direct membership), NOT cascaded scope arrays
- **Department/Area checks:** Use scope arrays (cascade IS correct at these levels)
- **Share action:** `kvp-lifecycle.service.ts` → `shareSuggestion()`
- **Permission:** `kvp-sharing.canWrite` in `user_addon_permissions`
