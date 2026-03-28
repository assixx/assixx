# KVP Sharing Visibility Rules

> **Last Update:** 2026-03-16
> **Affects:** `kvp.helpers.ts` (`buildVisibilityClause`), `kvp-lifecycle.service.ts` (`shareSuggestion`)

---

## Visibility Levels (cascading)

Each level includes everything from the previous level.

### Level 0: Not Shared (`is_shared = false`)

- **Creator** (`submitted_by`) sees it
- **Team Lead** / **Deputy Lead** of the assigned team sees it
- Nobody else

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
