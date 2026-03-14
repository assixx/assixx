# FEAT: Delegated Permission Management — Masterplan

> **Created:** 2026-03-14
> **Version:** 1.0.0
> **Status:** IMPLEMENTED — Phase 4 complete (2026-03-14)
> **Branch:** `core/permission-and-more`
> **ADR:** ADR-036 (Erweiterung), ADR-020 (Erweiterung)
> **Author:** SCS-Technik Team
> **Estimated Sessions:** 3–4
> **Actual Sessions:** 1
> **Depends On:** FEAT_ORGANIZATIONAL_SCOPE_ACCESS_MASTERPLAN (IMPLEMENTED)

---

## Warum dieses Feature?

Aktuell können **nur Root und Admin mit has_full_access** Addon-Permissions vergeben (ADR-020). Das bedeutet:

- Ein Team-Lead kann seine Mitarbeiter verwalten (manage-employees), aber NICHT deren Feature-Zugang steuern
- Ein Area-Lead muss Root bitten, einem neuen Mitarbeiter Blackboard-Zugang zu geben
- Jede Permission-Änderung muss nach ganz oben eskaliert werden — bei 200+ Mitarbeitern ein Flaschenhals

**Dieses Feature löst das Problem:** Leads können Permissions ihrer Untergebenen verwalten — mit strikter Hierarchie-Kontrolle.

---

## Konzept: Hierarchische Delegation

### Die Kette — IMMER nach oben, NIEMALS nach unten oder seitwärts

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DELEGATIONSKETTE                                   │
│                                                                      │
│  Root                                                                │
│    ↓ vergibt Permissions an...                                       │
│  Admin (has_full_access=true)                                        │
│    ↓ vergibt Permissions an...                                       │
│  Area-Lead (Admin mit area_lead_id)                                  │
│    ↓ vergibt Permissions an...                                       │
│  Dept-Lead (Admin mit department_lead_id)                            │
│    ↓ vergibt Permissions an...                                       │
│  Team-Lead (Employee mit team_lead_id/deputy_lead_id)                │
│    ↓ vergibt Permissions an...                                       │
│  Team-Members (Employees in user_teams)                              │
│    ✗ können NICHT delegieren (kein Lead)                             │
│                                                                      │
│  INVARIANTEN:                                                        │
│  1. NIEMALS sich selbst Permissions geben (targetUser ≠ currentUser)│
│  2. NUR Permissions vergeben die man SELBST hat                      │
│  3. NUR an Users im eigenen Scope (ScopeService)                    │
│  4. Die manage-permissions Permission selbst ist NICHT self-grantbar│
│  5. Root ist einzige Ausnahme: kann sich selbst bearbeiten           │
└──────────────────────────────────────────────────────────────────────┘
```

### Wer vergibt wem?

| Lead-Typ             | Vergibt an                           | Eigene Permissions von               | Scope                         |
| -------------------- | ------------------------------------ | ------------------------------------ | ----------------------------- |
| Root                 | Alle Users + sich selbst             | — (immer alles)                      | Tenant-weit                   |
| Admin (full)         | Alle Users (NICHT sich selbst)       | Root                                 | Tenant-weit                   |
| Area-Lead            | Users in seiner Area (Depts + Teams) | Admin (full) / Root                  | `scope.areaIds` Kaskade       |
| Dept-Lead            | Users in seiner Dept (+ Teams)       | Area-Lead / Admin / Root             | `scope.departmentIds` Kaskade |
| Team-Lead            | Members seines Teams                 | Dept-Lead / Area-Lead / Admin / Root | `scope.teamIds`               |
| Employee (kein Lead) | Niemand                              | sein Lead / Admin / Root             | —                             |

### Sicherheitsregeln (KRITISCH)

```
╔═══════════════════════════════════════════════════════════════════════╗
║  REGEL 1: Kein Self-Grant                                            ║
║  ─────────────────────                                               ║
║  targetUserId === currentUserId → ForbiddenException                ║
║  Einzige Ausnahme: Root (DB CHECK: has_full_access=true immer)      ║
║                                                                      ║
║  REGEL 2: Nur eigene Permissions delegieren                          ║
║  ──────────────────────────────────────                              ║
║  Für JEDE Permission die gesetzt wird:                               ║
║    Lead hat addon_code + module_code + permission_type = true?      ║
║    → GRANT erlaubt                                                   ║
║    Lead hat diese Permission NICHT?                                  ║
║    → SILENTLY SKIP (nicht grant, kein Error)                        ║
║                                                                      ║
║  REGEL 3: Nur im eigenen Scope                                      ║
║  ─────────────────────────────                                       ║
║  Target-User muss in getVisibleUserIds(scope, tenantId) enthalten   ║
║  sein. Sonst → ForbiddenException                                   ║
║                                                                      ║
║  REGEL 4: manage-permissions ist nicht self-grantbar                ║
║  ───────────────────────────────────────────────                     ║
║  Ein Lead mit manage-permissions.canWrite kann seinen Untergebenen  ║
║  NICHT manage-permissions.canWrite geben. Nur der VORGESETZTE       ║
║  des Leads kann diese Permission vergeben.                           ║
║  → Backend: Filtere manage-permissions aus dem Upsert wenn           ║
║    currentUser.role !== 'root' && !currentUser.hasFullAccess        ║
║                                                                      ║
║  REGEL 5: Audit Trail                                               ║
║  ────────────────────                                                ║
║  Jede delegierte Permission-Änderung wird geloggt:                  ║
║  - Wer hat geändert (assigned_by)                                   ║
║  - Für wen (user_id)                                                ║
║  - Was (addon_code, module_code, old → new)                         ║
║  - Wann (timestamp)                                                 ║
║  → ADR-009 Audit Logging                                            ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Decisions

| #   | Frage                                      | Entscheidung                                   | Begründung                                    |
| --- | ------------------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| D1  | Kann Lead sich selbst Permissions geben?   | **NEIN** (nur Root darf das)                   | Privilege Escalation verhindern               |
| D2  | Kann Lead ALLE Addon-Permissions vergeben? | **NUR die er selbst hat**                      | Man kann nicht geben was man nicht hat        |
| D3  | Können Team-Members weiter-delegieren?     | **NEIN, nur Leads**                            | Unkontrollierbare Kaskade verhindern          |
| D4  | Was bei Lead-Entfernung?                   | **Vergebene Permissions bleiben**              | ADR-020 Override: Root kann manuell entziehen |
| D5  | Neue Permission-Kategorie?                 | **JA: manage-permissions in manage_hierarchy** | Root muss explizit freigeben, rote UI         |

---

## Phase 1: Backend — Permission Delegation Service

> **Abhängigkeit:** Keine (aufbauend auf ADR-036 Scope-System)

### Step 1.1: Neue Permission-Modul-Definition [✅ DONE — 2026-03-14]

**Geänderte Datei:** `backend/src/nest/hierarchy-permission/manage-hierarchy.permissions.ts`

```typescript
// Neues Modul in manage_hierarchy:
{
  code: 'manage-permissions',
  label: 'Berechtigungen verwalten',
  icon: 'fa-shield-alt',
  allowedPermissions: ['canRead', 'canWrite'],
  // KEIN allowedRoles — alle Rollen (Root entscheidet wer es bekommt)
},
```

**canRead:** Darf Permission-Seite von Untergebenen SEHEN
**canWrite:** Darf Permissions von Untergebenen ÄNDERN

### Step 1.2: Controller — Lead-Access auf Permission-Endpoints [✅ DONE — 2026-03-14]

**Geänderte Datei:** `backend/src/nest/user-permissions/user-permissions.controller.ts`

Aktuell: `@Roles('admin', 'root')` + `assertFullAccess()` (nur Root + Admin full)

Neu: `@Roles('admin', 'root', 'employee')` + `assertPermissionAccess()` (delegierte Prüfung)

```typescript
/**
 * Permission-Access Prüfung (ersetzt assertFullAccess):
 * 1. Root → immer OK
 * 2. Admin mit has_full_access → OK (NICHT für eigene UUID, Ausnahme Root)
 * 3. User mit manage-permissions.canRead/canWrite → OK, aber:
 *    a) Target-User muss im eigenen Scope liegen
 *    b) Target-User ≠ Current-User (kein Self-Grant)
 */
private async assertPermissionAccess(
  user: NestAuthUser,
  targetUuid: string,
  tenantId: number,
  action: 'canRead' | 'canWrite',
): Promise<void>
```

### Step 1.3: Service — Delegations-Filter [✅ DONE — 2026-03-14]

**Geänderte Datei:** `backend/src/nest/user-permissions/user-permissions.service.ts`

Neuer Parameter `delegatorUserId` in `upsertPermissions()`:

```typescript
async upsertPermissions(
  tenantId: number,
  userUuid: string,
  permissions: PermissionEntry[],
  assignedByUserId: number,
  delegatorScope?: OrganizationalScope, // NEU: wenn gesetzt → delegiertes Upsert
): Promise<void>
```

**Delegations-Filter-Logik:**

```typescript
// Wenn delegatorScope gesetzt (nicht Root/Admin full):
for (const entry of permissions) {
  // Regel 2: Lead hat diese Permission selbst?
  const leaderHasPermission = await this.checkLeaderHasPermission(
    assignedByUserId, tenantId, entry.addonCode, entry.moduleCode, entry.action,
  );
  if (!leaderHasPermission) continue; // SILENTLY SKIP

  // Regel 4: manage-permissions nicht delegierbar
  if (entry.addonCode === 'manage_hierarchy' && entry.moduleCode === 'manage-permissions') {
    continue; // SILENTLY SKIP
  }

  // Normal upsert
  await this.upsertSingleEntry(...);
}
```

### Step 1.4: getPermissions — Filterung nach Leader-Permissions [✅ DONE — 2026-03-14]

**Geänderte Datei:** `backend/src/nest/user-permissions/user-permissions.service.ts`

Wenn ein Lead die Permission-Seite eines Untergebenen öffnet, sieht er NUR die Kategorien/Module die er SELBST hat:

```typescript
async getPermissions(
  tenantId: number,
  userUuid: string,
  filterByLeaderId?: number, // NEU: wenn gesetzt → nur Permissions zeigen die der Lead hat
): Promise<PermissionCategoryResponse[]>
```

### Phase 1 — Definition of Done

- [ ] `manage-permissions` Modul in manage_hierarchy registriert
- [ ] Controller erlaubt Employee-Rolle mit Scope-Check
- [ ] Self-Grant blockiert (targetUser ≠ currentUser)
- [ ] Delegations-Filter: nur eigene Permissions delegierbar
- [ ] manage-permissions selbst nicht delegierbar (Regel 4)
- [ ] Scope-Check: Target-User muss im eigenen Scope liegen
- [ ] Audit-Trail: assigned_by korrekt gesetzt
- [ ] ESLint 0 Errors, Type-Check passed

---

## Phase 2: Frontend — Permission-Seite für Leads

> **Abhängigkeit:** Phase 1 complete

### Step 2.1: Permission-Seite zugänglich für Leads [✅ DONE — 2026-03-14]

**Geänderte Dateien:**

- `frontend/src/routes/(app)/(shared)/manage-employees/permission/[uuid]/+page.server.ts`
- `frontend/src/routes/(app)/(shared)/manage-teams/` (Link zur Permission-Seite)

Aktuell: Permission-Seite nur über (admin) Route erreichbar.
Neu: Permission-Seite in (shared) Route, mit Scope-Check.

### Step 2.2: Rote Kategorie in Permission-UI [✅ DONE — 2026-03-14]

**Geänderte Datei:** `frontend/src/lib/components/PermissionSettings.svelte`

Die `manage-permissions` Kategorie wird **rot** hervorgehoben:

```svelte
{#if category.code === 'manage_hierarchy' && module.code === 'manage-permissions'}
  <div class="perm-row perm-row--danger">
    <!-- Rote Hintergrundfarbe + Warnung-Icon -->
  </div>
{/if}
```

CSS: `perm-row--danger` nutzt `--color-danger` als Akzentfarbe.

### Step 2.3: "Berechtigungen"-Button in Employee-Tabelle [✅ DONE — 2026-03-14]

**Geänderte Datei:** `frontend/src/routes/(app)/(shared)/manage-employees/+page.svelte`

Für Leads: Zeige einen "Berechtigungen"-Button (Shield-Icon) in jeder Employee-Zeile, der zur Permission-Seite navigiert. NUR sichtbar wenn Lead `manage-permissions.canRead` hat.

### Phase 2 — Definition of Done

- [ ] Permission-Seite für Leads zugänglich (Scope-Check)
- [ ] manage-permissions Kategorie rot in der UI
- [ ] "Berechtigungen"-Button in Employee-Tabelle (nur für Leads mit manage-permissions)
- [ ] Lead sieht NUR Permissions die er selbst hat (gefilterte Ansicht)
- [ ] Self-Grant blockiert (kann eigene UUID nicht öffnen)
- [ ] svelte-check 0 Errors

---

## Phase 3: Tests + Security Audit

> **Abhängigkeit:** Phase 2 complete

### Step 3.1: Unit Tests — Delegations-Logik [✅ DONE — 2026-03-14]

**Mindestens 12 Szenarien:**

| #   | Szenario                                            | Erwartung                        |
| --- | --------------------------------------------------- | -------------------------------- |
| 1   | Root upsert für beliebigen User                     | OK                               |
| 2   | Admin (full) upsert für Employee                    | OK                               |
| 3   | Admin (full) upsert für sich selbst                 | DENIED                           |
| 4   | Team-Lead upsert für Team-Member                    | OK (nur eigene Perms)            |
| 5   | Team-Lead upsert für User außerhalb Team            | DENIED (Scope)                   |
| 6   | Team-Lead upsert für sich selbst                    | DENIED (Self-Grant)              |
| 7   | Team-Lead vergibt Permission die er nicht hat       | SILENTLY SKIPPED                 |
| 8   | Team-Lead vergibt manage-permissions                | SILENTLY SKIPPED (Regel 4)       |
| 9   | Dept-Lead upsert für User in seinem Dept            | OK                               |
| 10  | Area-Lead upsert für User in seiner Area            | OK                               |
| 11  | Employee ohne Lead → upsert                         | DENIED (kein manage-permissions) |
| 12  | getPermissions als Lead → nur eigene Perms sichtbar | Gefiltert                        |

### Step 3.2: API Integration Tests [✅ DONE — 2026-03-14]

**Mindestens 6 Szenarien:**

| #   | Szenario                                                            | Erwartung                   |
| --- | ------------------------------------------------------------------- | --------------------------- |
| 1   | GET /user-permissions/:uuid als Root                                | 200 + alle Kategorien       |
| 2   | GET /user-permissions/:uuid als Team-Lead (mit manage-permissions)  | 200 + gefilterte Kategorien |
| 3   | GET /user-permissions/:uuid als Team-Lead (ohne manage-permissions) | 403                         |
| 4   | PUT /user-permissions/:uuid als Team-Lead → Untergebener            | 200                         |
| 5   | PUT /user-permissions/:uuid als Team-Lead → sich selbst             | 403                         |
| 6   | PUT /user-permissions/:uuid als Team-Lead → fremder User            | 403                         |

### Step 3.3: DB-Trigger — manage-permissions nicht self-grantbar [✅ DONE — 2026-03-14]

**Neue Migration:** Trigger auf `user_addon_permissions`:

```sql
-- Verhindert dass manage-permissions.canWrite durch Non-Root/Non-Admin gesetzt wird
-- (Defense-in-Depth: Backend prüft auch, Trigger ist Safety-Net)
CREATE OR REPLACE FUNCTION prevent_manage_permissions_self_grant() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.addon_code = 'manage_hierarchy' AND NEW.module_code = 'manage-permissions'
     AND NEW.can_write = true THEN
    -- Prüfe ob assigned_by Root oder Admin mit full_access ist
    IF NOT EXISTS (
      SELECT 1 FROM users
      WHERE id = NEW.assigned_by
        AND (role = 'root' OR (role = 'admin' AND has_full_access = true))
    ) THEN
      RAISE EXCEPTION 'manage-permissions.canWrite can only be granted by root or admin with full_access';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Phase 3 — Definition of Done

- [ ] ≥ 18 Tests (12 Unit + 6 API)
- [ ] Alle Tests grün
- [ ] DB-Trigger für manage-permissions Self-Grant Prevention
- [ ] Security Audit: kein Privilege Escalation möglich
- [ ] Audit-Trail verifiziert (assigned_by korrekt)

---

## Phase 4: ADR + Documentation

> **Abhängigkeit:** Phase 3 complete

### Step 4.1: ADR-036 erweitern [✅ DONE — 2026-03-14]

Neue Sektion "Delegated Permission Management" mit:

- Delegationskette
- Sicherheitsregeln
- DB-Trigger

### Step 4.2: Smoke Test Checkliste [✅ DONE — 2026-03-14]

> **Automatisierte Tests: 6061 Unit + 77 Permission + 13 Delegation + 6 API = alle grün.**
> **Manuelle Browser-Smoke-Tests durch User ausstehend.**

| Test                                                                | Ergebnis |
| ------------------------------------------------------------------- | -------- |
| Root vergibt manage-permissions an Corc (Team-Lead)                 |          |
| Corc öffnet Permission-Seite von John Doe (Team-Member)             |          |
| Corc sieht NUR Kategorien die er selbst hat                         |          |
| Corc kann John Doe Blackboard-Zugang geben                          |          |
| Corc kann John Doe NICHT manage-permissions geben                   |          |
| Corc kann NICHT seine eigene Permission-Seite öffnen                |          |
| Corc kann NICHT Permissions von User außerhalb seines Teams ändern  |          |
| Alfred (Dept-Lead) kann Permissions für alle Dept-Members verwalten |          |
| Jürgen (Area-Lead) kann Permissions für alle Area-Members verwalten |          |
| manage-permissions Kategorie ist ROT in der UI                      |          |
| Audit-Trail zeigt korrekt wer was geändert hat                      |          |

---

## Quick Reference: Dateien

### Backend (geändert)

| Datei                                                  | Änderung                                    |
| ------------------------------------------------------ | ------------------------------------------- |
| `hierarchy-permission/manage-hierarchy.permissions.ts` | Neues Modul `manage-permissions`            |
| `user-permissions/user-permissions.controller.ts`      | Employee-Rolle erlaubt, Scope-Check         |
| `user-permissions/user-permissions.service.ts`         | Delegations-Filter, Leader-Permission-Check |

### Frontend (geändert)

| Datei                                                | Änderung                              |
| ---------------------------------------------------- | ------------------------------------- |
| `PermissionSettings.svelte`                          | Rote Kategorie für manage-permissions |
| `manage-employees/+page.svelte`                      | "Berechtigungen"-Button für Leads     |
| `manage-employees/permission/[uuid]/+page.server.ts` | Scope-Check für Leads                 |

### DB (neue Migration)

| Datei                                  | Änderung                    |
| -------------------------------------- | --------------------------- |
| `XXXXXX_manage-permissions-trigger.ts` | DB-Trigger gegen Self-Grant |

---

## Risk Register

| #   | Risiko                                                    | Impact   | Mitigation                                     |
| --- | --------------------------------------------------------- | -------- | ---------------------------------------------- |
| R1  | Privilege Escalation via Self-Grant                       | KRITISCH | Regel 1 (Self-Grant Block) + DB-Trigger        |
| R2  | Lead vergibt Permission die er nicht hat                  | HOCH     | Regel 2 (Delegations-Filter im Backend)        |
| R3  | manage-permissions Kaskade (Lead gibt Lead-Rechte weiter) | HOCH     | Regel 4 (manage-permissions nicht delegierbar) |
| R4  | Lead verliert Position, vergebene Perms bleiben           | NIEDRIG  | Gewollt (D4). Root kann manuell entziehen      |
| R5  | Performance: Permission-Check bei jedem Upsert            | NIEDRIG  | Single PK-Lookup pro Entry, cached via CLS     |

---

## Session Tracking

| Session | Phase | Beschreibung                                                                | Status | Datum |
| ------- | ----- | --------------------------------------------------------------------------- | ------ | ----- |
| 1       | 1     | Backend: manage-permissions Modul, Controller, Service Delegations-Filter   |        |       |
| 2       | 2     | Frontend: Permission-Seite für Leads, rote Kategorie, Berechtigungen-Button |        |       |
| 3       | 3     | Tests + DB-Trigger + Security Audit                                         |        |       |
| 4       | 4     | ADR + Docs + Smoke Tests                                                    |        |       |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier, nimmt das nächste unchecked Item, und markiert es als done.**
