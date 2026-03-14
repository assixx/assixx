# ADR-036: Organizational Scope Access Control

| Metadata                | Value                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                  |
| **Date**                | 2026-03-14                                                                                                                                |
| **Decision Makers**     | SCS Technik                                                                                                                               |
| **Affected Components** | Backend (HierarchyPermissionService, ScopeService, 4 Controllers, 4 Services, KVP, Blackboard), Frontend (Routes, Navigation, Layout), DB |
| **Related ADRs**        | ADR-020 (Per-User Permissions), ADR-033 (Addon-Modell), ADR-034 (Hierarchy Labels), ADR-035 (Organizational Hierarchy & Assignment)       |

---

## Context

### Das Problem: Zwei Lücken im Zugriffssystem

```
┌─────────────────────────────────────────────────────────────────┐
│  LÜCKE 1: Employee-Leads haben keinen Zugang zu Manage-Seiten  │
│                                                                 │
│  Team-Lead "Corc" (Employee) kann sein Team nicht verwalten    │
│  → Kein Zugang zu /manage-teams, /manage-employees             │
│  → Muss Admin bitten, Änderungen vorzunehmen                   │
│                                                                 │
│  LÜCKE 2: Scoped Admins sehen ALLES statt nur ihren Bereich   │
│                                                                 │
│  Admin ohne has_full_access sieht trotzdem alle Mitarbeiter    │
│  → Kein Scope-Filter in listUsers(), listTeams() etc.          │
│  → Datenschutz-Problem bei großen Unternehmen mit Bereichen    │
└─────────────────────────────────────────────────────────────────┘
```

**Vor dieser Entscheidung:**

- Manage-Seiten waren ausschließlich für Root und Admin zugänglich
- Admins sahen ALLE Entities im Tenant — kein organisatorischer Scope-Filter
- Employee-Leads (team_lead_id, deputy_lead_id) hatten keinerlei Verwaltungsrechte
- Die bestehenden `getAccessibleAreaIds()` / `getAccessibleDepartmentIds()` / `getAccessibleTeamIds()` Methoden ignorierten Lead-Positionen komplett
- KVP hatte eine eigene, separate Org-Info-Query (`EXTENDED_ORG_INFO_QUERY`) mit anderem Datenmodell

### Anforderungen

1. Employee Team-Leads sollen ihre Teams + Team-Mitglieder verwalten können (Read + Edit, KEIN Create/Delete)
2. Scoped Admins sollen nur Entities in ihrem Scope sehen (Area-Permissions + Lead-Positionen + Kaskade)
3. Root / has_full_access bleibt unverändert (sieht alles)
4. Deputy-Lead hat identische Rechte wie Team-Lead (V1, Per-Tenant-Setting für V2)
5. Ein einziger Filter-Pfad für ALLE Rollen — kein Sonder-Code pro Rolle
6. Kein DB-Overhead für ~90% der Requests (Chat, Calendar etc. brauchen keinen Scope)
7. Fail-Closed: Kein Permission-Row = kein Zugang. Keine Ausnahmen.

---

## Decision

### Architektur: Ein CTE, ein Service, ein Filter-Pfad

```
┌──────────────────────────────────────────────────────────────────────┐
│                HierarchyPermissionService.getScope()                 │
│                                                                      │
│  Root / has_full_access:                                             │
│    → type: 'full' (kein Filter, early return)                       │
│                                                                      │
│  Admin (scoped):                                                     │
│    → type: 'limited'                                                 │
│    → areaIds:  [admin_area_permissions + area_lead_id]              │
│    → deptIds:  [admin_dept_permissions + dept_lead_id + inherited]  │
│    → teamIds:  [team_lead_id + deputy_lead_id + inherited]          │
│                                                                      │
│  Employee Team-Lead:                                                 │
│    → type: 'limited'                                                 │
│    → teamIds:  [team_lead_id + deputy_lead_id]                      │
│                                                                      │
│  Employee (kein Lead) / Dummy:                                       │
│    → type: 'none' (kein Zugang zu Manage-Seiten)                    │
│                                                                      │
│  Scope wird LAZY aufgelöst (ScopeService + CLS-Cache).              │
│  ~90% der Requests lösen NIE Scope auf → kein DB-Overhead.          │
└──────────────────────────────────────────────────────────────────────┘
```

### Kernkomponenten

#### 1. Unified CTE Query (`UNIFIED_SCOPE_CTE`)

Eine einzige SQL-Query löst ALLE Zugriffspfade auf:

```sql
WITH
perm_areas AS (/* Admin area permissions — nur aktive */),
lead_areas AS (/* area_lead_id Positionen */),
all_areas AS (/* UNION beider */),
perm_depts AS (/* Admin dept permissions — nur aktive */),
lead_depts AS (/* department_lead_id Positionen */),
inherited_depts AS (/* Departments unter all_areas — Kaskade */),
all_depts AS (/* UNION aller drei */),
lead_teams AS (/* team_lead_id + deputy_lead_id */),
inherited_teams AS (/* Teams unter all_depts — Kaskade */),
all_teams AS (/* UNION beider */)
SELECT area_ids, department_ids, team_ids,
       lead_area_ids, lead_department_ids, lead_team_ids
```

**Warum ein CTE statt separate Queries?** Drei `getAccessible*Ids()` Aufrufe (altes Pattern) bedeuteten 3 DB-Roundtrips mit redundanter getUserInfo-Query. Der CTE macht alles in einer Query.

**Warum `lead_*_ids` zusätzlich zu `all_*` IDs?** KVP braucht die Information "Bin ich Lead von DIESEM Team?" für Bestätigungslogik. Die Boolean-Felder `isTeamLead` reichen nicht — sie sagen nur "irgendein Team", nicht welches.

#### 2. ScopeService (Lazy + CLS-Cache)

```typescript
@Injectable()
export class ScopeService {
  async getScope(): Promise<OrganizationalScope> {
    // 1. CLS-Cache prüfen (second+ call in same request)
    const cached = this.cls.get('orgScope');
    if (cached !== undefined) return cached;
    // 2. DB-Query (first call in request)
    const scope = await this.hierarchyPermission.getScope(userId, tenantId);
    // 3. In CLS cachen
    this.cls.set('orgScope', scope);
    return scope;
  }
}
```

**Warum Lazy statt APP_GUARD?** Ein APP_GUARD würde für JEDEN authentifizierten Request eine DB-Query auslösen. ~90% der Requests (Chat, Calendar, Blackboard-Lesen) brauchen keinen Scope. ScopeService löst erst auf wenn ein Service ihn tatsächlich braucht.

**Warum CLS (Continuation-Local Storage)?** Der Scope ist Request-gebunden. CLS ist das NestJS-Pattern für Request-Scoped-Daten ohne explizites Parameter-Threading.

#### 3. Permission-Modell: `manage_hierarchy` Addon

```
┌─────────────────────────────────────────────────────────────┐
│  manage_hierarchy (is_core=true, immer aktiv)                │
│                                                               │
│  Modules:                                                     │
│    manage-areas       → canRead, canWrite (kein canDelete)   │
│    manage-departments → canRead, canWrite                    │
│    manage-teams       → canRead, canWrite                    │
│    manage-employees   → canRead, canWrite                    │
│                                                               │
│  Vergabe:                                                     │
│    Root → vergibt manuell an Admins (D5)                     │
│    System → Auto-Seed bei Lead-Zuweisung (D6)                │
│                                                               │
│  Guard:                                                       │
│    PermissionGuard (ADR-020) — KEINE Änderung                │
│    Fail-closed: kein Row = kein Zugang                        │
└─────────────────────────────────────────────────────────────┘
```

**Warum kein `canDelete`?** Employee-Leads dürfen Read + Edit, aber NICHT Create/Delete. Create/Delete bleibt auf `@Roles('admin', 'root')` beschränkt.

**Warum Auto-Seed?** Wenn ein Employee zum Team-Lead ernannt wird, erstellt das System automatisch die Permission-Rows (`ON CONFLICT DO NOTHING`). Bei Entfernung als Lead → Cleanup (nur wenn kein anderes Team mehr geführt wird). Der PermissionGuard braucht keinen Sonder-Code — er findet einfach die auto-geseedeten Rows.

**ADR-020 Override:** Root kann einem Lead die Permissions auf der Permission-Seite entziehen (can_read=false setzen). Der Auto-Seed überschreibt das NICHT (`ON CONFLICT DO NOTHING`). Erst bei Lead-Entfernung + Neu-Zuweisung werden die Permissions zurückgesetzt.

#### 4. Service-Level Scope Filtering

Einheitliches Pattern in ALLEN 4 Services:

```typescript
const scope = await this.scopeService.getScope();
if (scope.type === 'full') return allEntities; // Root/Admin full
if (scope.type === 'none') return []; // Employee ohne Lead
return filterByScope(scope.teamIds); // Admin scoped + Employee-Lead
```

**Betroffene Services:** AreasService, DepartmentsService, TeamsService, UsersService

**User-Scope:** Da Users nicht direkt in Scope-IDs enthalten sind (sie sind über Junction-Tables zugeordnet), gibt es `getVisibleUserIds(scope, tenantId)` — eine separate Query die User via `user_departments` + `user_teams` auflöst.

#### 5. Frontend Route Migration

```
(admin)/manage-areas       → (shared)/manage-areas        (Admin + Employee-Lead)
(admin)/manage-departments → (shared)/manage-departments   (Admin + Employee-Lead)
(root)/manage-teams        → (shared)/manage-teams         (Admin + Employee-Lead)
(admin)/manage-employees   → (shared)/manage-employees     (Admin + Employee-Lead)
(admin)/manage-admins      → (root)/manage-admins          (Root-only)
(admin)/manage-dummies     → (root)/manage-dummies         (Root-only, D7)
```

Jede +page.server.ts hat einen expliziten Scope-Check (Defense-in-Depth):

- manage-teams/employees: Root OK, Admin mit Scope OK, Employee mit isTeamLead OK
- manage-areas/departments: Root OK, Admin mit Scope OK, Employee DENIED (D1=NEIN)

#### 6. Navigation Scope-Filterung

`filterMenuByScope()` in der Svelte Layout-Pipeline:

- Root: alle Manage-Items sichtbar
- Admin full: alle Manage-Items sichtbar
- Admin scoped: Manage-Items basierend auf Scope
- Employee-Lead: manage-teams + manage-employees injiziert
- Employee ohne Lead: keine Manage-Items

---

## Alternatives Considered

### A: Zwei separate Services (LeadScopeService + UserScopeFilteringService)

**Abgelehnt.** Führt zu doppelter CTE-Logik, doppelten Filter-Pfaden und Route-Konflikten. Ein Service mit einer CTE ist einfacher, performanter und konsistenter.

### B: RLS-basierte Filterung (PostgreSQL Row Level Security)

**Abgelehnt.** RLS filtert auf DB-Ebene, was bedeutet dass JEDE Query (auch Chat, Calendar) gefiltert würde. Keine Möglichkeit für "~90% der Requests brauchen keinen Scope". Außerdem ist die CTE-Logik (Admin-Permissions + Lead-Positions + Kaskade) in RLS-Policies extrem komplex zu implementieren.

### C: Frontend-Only Filter (Backend liefert alles, Frontend filtert)

**Abgelehnt.** Sicherheitslücke — ein API-Call würde alle Daten liefern, das Frontend nur die Anzeige einschränken. Scope-Filterung MUSS auf Backend-Ebene passieren (Defense-in-Depth).

### D: APP_GUARD für Scope-Auflösung

**Abgelehnt.** Würde für JEDEN authentifizierten Request eine DB-Query auslösen — auch für die ~90% die keinen Scope brauchen. ScopeService (Lazy) löst nur auf wenn tatsächlich gebraucht.

### E: Separate Permission-Kategorie pro Controller (areas-manage, teams-manage, etc.)

**Teilweise übernommen.** Die bestehenden Permission-Kategorien (`departments`, `teams`, `employees`) bleiben für POST/DELETE (legacy). GET/PUT verwenden die neue `manage_hierarchy` Kategorie, die alle 4 Manage-Seiten abdeckt.

---

## Consequences

### Positive

1. **Employee-Leads können verwalten:** Team-Leads sehen und bearbeiten ihre Teams + Mitglieder ohne Admin-Eingriff
2. **Scoped Admins:** Datenschutz-konform — Admins sehen nur ihren organisatorischen Bereich
3. **Ein Filter-Pfad:** Kein Sonder-Code pro Rolle — gleicher Code-Pfad für Admin UND Employee-Lead
4. **Kein Overhead:** ~90% der Requests lösen keinen Scope auf (Lazy + CLS-Cache)
5. **Fail-Closed:** Kein Permission-Row = kein Zugang — keine versehentlichen Freigaben
6. **Deputy = Lead:** Stellvertreter haben sofort gleiche Rechte (V1)
7. **Auto-Seed:** Keine manuelle Permission-Vergabe für Leads nötig
8. **ADR-020 Override:** Root behält volle Kontrolle — kann Leads Rechte entziehen
9. **KVP-Integration:** Scope-basierte Sichtbarkeit + Teilen-Funktion für gezielte Freigabe

### Negative

1. **Admin-Migration:** Bestehende Admins brauchen manuelle `manage_hierarchy` Permission-Vergabe durch Root
2. **KVP-Verhaltensänderung:** Employees ohne Lead sehen nur noch eigene + implementierte + geteilte Vorschläge
3. **Dropdown-Limitation (V1):** Create-Forms zeigen alle Entities in Dropdowns, nicht nur scoped
4. **Deputy immer Lead (V1):** Kein Per-Tenant-Setting ob Deputy volle Lead-Rechte hat (geplant V2)
5. **Kein Live-Update:** Scope-Änderungen werden erst nach Navigation/Reload sichtbar

---

## Delegated Permission Management (Erweiterung)

Leads können Addon-Permissions ihrer Untergebenen verwalten — mit strikter Hierarchie-Kontrolle.

### Delegationskette

```
Root → Admin (full) → Area-Lead → Dept-Lead → Team-Lead → Team-Members
```

Jede Ebene kann NUR an die Ebene darunter delegieren. NIEMALS nach oben, seitwärts, oder an sich selbst.

### Sicherheitsregeln

| #   | Regel                                                     | Enforcement                                 |
| --- | --------------------------------------------------------- | ------------------------------------------- |
| 1   | Kein Self-Grant (targetUser ≠ currentUser, Ausnahme Root) | Controller `assertNotSelf()`                |
| 2   | Nur eigene Permissions delegierbar                        | Service `leaderHasPermission()`             |
| 3   | Nur an Users im eigenen Scope                             | Controller `assertTargetInScope()`          |
| 4   | manage-permissions selbst nicht delegierbar               | Service `isDelegatableEntry()` + DB-Trigger |
| 5   | Audit-Trail für jede Änderung                             | `assigned_by` Spalte + Activity Logger      |

### Neue Permission: `manage-permissions`

Neues Modul in `manage_hierarchy` Addon:

- `canRead`: Permission-Seite von Untergebenen sehen
- `canWrite`: Permissions von Untergebenen ändern
- Rote Hervorhebung (`perm-row--danger`) in der UI als visuelle Warnung
- DB-Trigger `trg_prevent_manage_permissions_self_grant`: Nur Root/Admin-full dürfen diese Permission vergeben

### Controller-Architektur

`assertPermissionAccess()` ersetzt `assertFullAccess()`:

1. Root → immer OK (inkl. Self-Edit)
2. Admin mit has_full_access → OK (Self-Edit blockiert)
3. Lead mit manage-permissions → OK (Self-Edit + Scope-Check)
4. Alle anderen → 403

### Service-Architektur

`upsertPermissions()` mit optionalem `delegatorScope`:

- Wenn gesetzt → Pre-Filter `filterDelegatedPermissions()`: Regel 2 + 4
- `loadLeaderPermissions()`: Batch-Load als Set für O(1) Lookup
- `filterByLeaderPerms()`: GET zeigt nur Module die der Lead hat

---

## Implementation Summary

| Phase | Beschreibung                                                 | Files                |
| ----- | ------------------------------------------------------------ | -------------------- |
| 1     | Types, CTE, ScopeService, KVP-Refactoring, Endpoint          | 6 neue + 5 geänderte |
| 2     | Service-Level Scope Filtering + Mutations + Blackboard       | 8 geänderte          |
| 3     | Permission Registry, Migration, Controller @Roles, Auto-Seed | 4 neue + 7 geänderte |
| 4     | Unit Tests (77 Tests)                                        | 3 Testdateien        |
| 5     | Frontend Route Migration + Layout Data + Access Checks       | 1 neue + 7 geänderte |
| 6     | Navigation Config + ScopeInfoBanner + Lead-View              | 2 neue + 3 geänderte |
| 7     | API Integration Tests (19 Tests)                             | 2 Testdateien        |

**Total: 96 Tests (77 Unit + 19 API)**

---

## Key Design Decisions

| #   | Frage                           | Entscheidung               | Begründung                                          |
| --- | ------------------------------- | -------------------------- | --------------------------------------------------- |
| D1  | Employees als Area/Dept-Lead?   | NEIN                       | ADR-035 konform, validateLeader() bleibt admin/root |
| D2  | Wo lebt die Scope-Logik?        | HierarchyPermissionService | Ein Service, eine CTE, kein neuer Service           |
| D3  | Scope-Auflösung wann?           | Lazy via ScopeService      | ~90% der Requests brauchen keinen Scope             |
| D4  | Deputy = Lead?                  | JA (V1)                    | DEPUTY_EQUALS_LEAD Flag für V2 Toggle               |
| D5  | Admin manage_hierarchy Vergabe? | Manuell durch Root         | Maximale Kontrolle, kein Auto-Grant                 |
| D6  | Lead manage_hierarchy Vergabe?  | Auto-Seed bei Zuweisung    | ON CONFLICT DO NOTHING respektiert ADR-020 Override |
| D7  | manage-dummies Zugang?          | Root-only                  | Verschieben von (admin) nach (root)                 |

---

## References

- [FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md](../../FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN.md) — Execution Plan
- [ADR-020](./ADR-020-per-user-feature-permissions.md) — Per-User Feature Permissions (basis für manage_hierarchy)
- [ADR-033](./ADR-033-addon-based-saas-model.md) — Addon-Modell (manage_hierarchy als Core-Addon)
- [ADR-034](./ADR-034-hierarchy-labels-propagation.md) — Hierarchy Labels (UI-Benennung)
- [ADR-035](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — Org Hierarchy (DB-Struktur, validateLeader)
- [ADR-009](./ADR-009-user-role-assignment-permissions.md) — Audit Logging (Scope-Denied Events)
