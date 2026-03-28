# Badge Assignment System - ASSIXX Design Standard

## Overview

This document defines the **unified badge system** for all table assignment columns across ASSIXX manage pages. ALL tables displaying Areas, Departments, Teams, Machines, or Members MUST follow this standard.

## Badge Types

### 1. Full Access Badge (`badge--primary`)

**Use when:** User/entity has access to ALL items in the category.

```html
<span class="badge badge--primary" title="Voller Zugriff auf alle {Label}">
  <i class="fas fa-globe mr-1"></i>Alle
</span>
```

**Detection:**

```typescript
if (entity.hasFullAccess === true || entity.hasFullAccess === 1)
```

### 2. Count Badge (`badge--info`)

**Use when:** Entity has direct assignments (1 or more items).

```html
<!-- Single item -->
<span class="badge badge--info" title="Produktion">1 Bereich</span>

<!-- Multiple items -->
<span class="badge badge--info" title="Produktion, Lager, Verwaltung">3 Bereiche</span>
```

**Detection:**

```typescript
if (entity.items?.length > 0) {
  const names = entity.items.map((i) => i.name).join(', ');
  const count = entity.items.length;
  const label = count === 1 ? 'Bereich' : 'Bereiche';
  return `<span class="badge badge--info" title="${names}">${count} ${label}</span>`;
}
```

### 3. Inherited Badge (`badge--info` + sitemap icon)

**Use when:** Access is inherited through the hierarchy. Works in **both directions**:

- **Abwärts (↓):** Area-Permission → Departments vererbt, Dept-Permission → Teams vererbt
- **Aufwärts (↑):** Dept-Permission → Area als READ-ONLY Kontext (ADR-035 Sektion 5)

```html
<span class="badge badge--warning" title="Vererbt von: Team Alpha"> <i class="fas fa-sitemap mr-1"></i>Vererbt </span>
```

**Detection:**

```typescript
// For Employees: Inherited from teams → departments → areas
const hasTeams = (entity.teams?.length ?? 0) > 0 || entity.teamId != null;

// For Admins: Inherited from areas → departments (downward)
const hasAreas = getAreaCount(admin) > 0;

// For Admins: Inherited from departments → areas (upward context)
const inheritedAreaNames = getInheritedAreaNames(admin); // departments with areaId
```

### 4. None Badge (`badge--secondary`)

**Use when:** No items assigned and no inheritance.

```html
<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Keine</span>
```

**Detection:**

```typescript
// Final fallback - no direct or inherited access
return '<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Keine</span>';
```

## Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                    getAssignmentBadge(entity)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   hasFullAccess?      │
                  └───────────────────────┘
                    │ YES              │ NO
                    ▼                  ▼
            ┌───────────────┐  ┌───────────────────────┐
            │ badge--primary│  │   items.length > 0?   │
            │ "Alle"        │  └───────────────────────┘
            └───────────────┘    │ YES              │ NO
                                 ▼                  ▼
                         ┌───────────────┐  ┌───────────────────────┐
                         │ badge--info   │  │   hasInheritance?     │
                         │ "N Items"     │  └───────────────────────┘
                         └───────────────┘    │ YES              │ NO
                                              ▼                  ▼
                                      ┌───────────────┐  ┌───────────────┐
                                      │ badge--info   │  │ badge--secondary
                                      │ "Vererbt"     │  │ "Keine"       │
                                      └───────────────┘  └───────────────┘
```

## Inheritance Rules by Entity Type

### Employees (role: employee)

| Column      | Direct Source            | Inherited From     |
| ----------- | ------------------------ | ------------------ |
| Areas       | `employee.areas[]`       | Team → Dept → Area |
| Departments | `employee.departments[]` | Team → Dept        |
| Teams       | `employee.teams[]`       | - (no inheritance) |

**Inheritance Detection:**

```typescript
const hasTeams = (employee.teams?.length ?? 0) > 0 || employee.teamId != null;
```

### Admins (role: admin)

**Quellen:** Explizite Permissions (`admin_area_permissions`, `admin_department_permissions`) **+ Lead-Positionen** (`area_lead_id`, `department_lead_id`). Lead-Positionen sind implizite Permissions (ADR-035 Sektion 4).

| Column      | Direct Source         | Lead Source               | Inherited From                      |
| ----------- | --------------------- | ------------------------- | ----------------------------------- |
| Areas       | `admin.areas[]`       | `admin.leadAreas[]`       | Dept → Area (aufwärts, READ-ONLY ↑) |
| Departments | `admin.departments[]` | `admin.leadDepartments[]` | Area → Dept (abwärts ↓)             |
| Teams       | -                     | -                         | Area/Dept → Teams (abwärts ↓)       |

**Inheritance Detection:**

```typescript
// Combined counts: explicit permissions + lead positions (deduplicated by backend)
const areaCount = (admin.areas?.length ?? 0) + (admin.leadAreas?.length ?? 0);
const deptCount = (admin.departments?.length ?? 0) + (admin.leadDepartments?.length ?? 0);

// For Areas: Upward inheritance from departments with areaId
const inheritedAreaNames = getInheritedAreaNames(admin);

// For Departments: Downward inheritance from areas
const hasAreas = areaCount > 0;

// For Teams: Downward from areas + departments
const hasAreas = areaCount > 0;
const hasDepts = deptCount > 0;
```

**Lead-Position Badge-Regeln:**

- Lead-Departments/Areas werden mit Suffix `(Lead)` im Tooltip angezeigt
- Backend liefert `leadAreas[]` und `leadDepartments[]` separat (keine Duplikate mit expliziten Permissions)
- `leadDepartments` enthalten `areaId`/`areaName` für Aufwärtsvererbung

## Standard Function Template

```typescript
/**
 * Get areas badge HTML for table column
 * ASSIXX STANDARD: All badge functions MUST follow this pattern
 */
export function getAreasBadge(entity: Entity): string {
  const hasFullAccess = entity.hasFullAccess === true || entity.hasFullAccess === 1;
  const hasAreas = (entity.areas?.length ?? 0) > 0;
  const hasTeams = (entity.teams?.length ?? 0) > 0 || entity.teamId != null;

  // 1. Full Access
  if (hasFullAccess) {
    return '<span class="badge badge--primary" title="Voller Zugriff auf alle Bereiche"><i class="fas fa-globe mr-1"></i>Alle</span>';
  }

  // 2. Direct Assignments (count badge)
  if (hasAreas) {
    const count = entity.areas.length;
    const label = count === 1 ? 'Bereich' : 'Bereiche';
    const names = entity.areas.map((a) => a.name).join(', ');
    return `<span class="badge badge--info" title="${names}">${count} ${label}</span>`;
  }

  // 3. Inherited (via teams)
  if (hasTeams) {
    const teamNames = entity.teams?.map((t) => t.name).join(', ') ?? entity.teamName ?? '';
    return `<span class="badge badge--warning" title="Vererbt von: ${teamNames}"><i class="fas fa-sitemap mr-1"></i>Vererbt</span>`;
  }

  // 4. None
  return '<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Keine</span>';
}
```

## Tooltip Requirements

**MANDATORY:** ALL badges MUST have a `title` attribute for native browser tooltips.

| Badge Type  | Tooltip Content                   |
| ----------- | --------------------------------- |
| Full Access | "Voller Zugriff auf alle {Label}" |
| Count (1)   | Single item name                  |
| Count (N)   | Comma-separated list of names     |
| Inherited   | "Vererbt von: {Parent Names}"     |
| None        | "Keine {Label} zugewiesen"        |

## CSS Classes Reference

```css
/* Base badge */
.badge {
}

/* Assignment badge variants */
.badge--primary {
  /* Full access - blue gradient */
}
.badge--info {
  /* Count & Inherited - cyan/teal */
}
.badge--secondary {
  /* None - gray */
}

/* Icons (Font Awesome) */
.fa-globe {
  /* Full access icon */
}
.fa-sitemap {
  /* Inheritance icon */
}
```

## Files Using This System

All these files MUST follow this standard:

- `frontend/src/routes/(app)/(root)/manage-admins/_lib/utils.ts`
  - `getAreasBadge()`, `getDepartmentsBadge()`, `getTeamsBadge()`
- `frontend/src/routes/(app)/(shared)/manage-employees/_lib/utils.ts`
  - `getAreasBadge()`, `getDepartmentsBadge()`, `getTeamsBadge()`
- `frontend/src/routes/(app)/(shared)/manage-teams/_lib/utils.ts`
  - `getDepartmentBadge()`, `getMembersBadge()`, `getAssetsBadge()`
- `frontend/src/routes/(app)/(admin)/manage-assets/_lib/utils.ts`
  - `getTeamsBadgeData()`, `getAreaBadgeData()`, `getDepartmentBadgeData()`

## Changelog

| Date       | Change                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| 2025-11-29 | Initial version - unified badge system established                         |
| 2026-03-14 | Lead-Positionen + Aufwärtsvererbung (Dept→Area) für Admins hinzugefügt     |
| 2026-03-14 | File-Pfade auf SvelteKit-Routing aktualisiert, Storybook-Referenz entfernt |
