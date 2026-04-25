# ADR-045: Permission & Visibility Design — "Wer darf was?"

| Metadata                | Value                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                    |
| **Date**                | 2026-04-15                                                                                                                                                                                                                                                  |
| **Decision Makers**     | SCS-Technik Team                                                                                                                                                                                                                                            |
| **Affected Components** | ALL feature modules (Blackboard, KVP, Surveys, TPM, Work Orders, Vacation, Approvals, Inventory, Documents …), Backend Guards, Frontend Gates, Navigation                                                                                                   |
| **Supersedes**          | —                                                                                                                                                                                                                                                           |
| **Related ADRs**        | ADR-010 (Rollen/Hierarchie), ADR-012 (Route Security Groups), ADR-020 (Per-User Permissions), ADR-024 (Frontend Feature Guards), ADR-033 (Addons), ADR-034 (Hierarchy Labels), ADR-035 (Scope Architektur), ADR-036 (Scope Access), ADR-039 (Deputy-Toggle) |

---

## Context

Assixx hat über die letzten 12 Monate mehrere orthogonale Berechtigungs-Mechanismen eingeführt (Rollen, hasFullAccess, Lead-Positionen, Deputy-Scope-Toggle, Addon-Subscriptions, Per-User-Permissions). Jeder einzelne ist in einem ADR dokumentiert. Was **fehlt**, ist die **zusammenführende Regel**: _Wie kombinieren sich diese Mechanismen, wenn ich einen einzelnen Button im UI gate oder eine einzelne Mutation-Route im Backend schütze?_

Die Folge: **divergente Muster** in der Codebasis.

| Feature        | Frontend-Button-Gate                                            | Backend-Mutation-Guard                                    |
| -------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| **Surveys**    | `canManageSurveys(role, hasFullAccess, isAnyLead)` ✅ kanonisch | `@RequirePermission(SURVEY_ADDON, ..., 'canWrite')` ✅    |
| **Blackboard** | `const isAdmin = role === 'admin' \|\| 'root'` ❌ veraltet      | `@Roles('admin', 'root')` + `@RequirePermission(…)` ❌    |
| **KVP**        | kein Gate (Employee darf Vorschlag einreichen — by design)      | `@RequirePermission(KVP_ADDON, ..., 'canWrite')` ✅       |
| **TPM**        | `/tpm/plans/my-permissions` Self-Check ✅                       | `@RequirePermission(TPM_ADDON, MOD_PLANS, 'canWrite')` ✅ |

Das `isAdmin`-Shortcut bei Blackboard ignoriert:

- `hasFullAccess` (Admin ohne Full-Access sieht Button, obwohl er nichts tun sollte)
- Lead-Positionen (Employee-Team-Lead sieht keinen Button, obwohl er verwalten dürfte)
- Deputy-Scope-Toggle ADR-039 (Stellvertreter mit aktivem Tenant-Toggle werden ignoriert)
- ADR-020 Per-User-Permissions (Admin mit explizit entzogenem `canWrite` sieht Button trotzdem)

Das `@Roles('admin', 'root')` im Backend verschlimmert das Problem: Selbst wenn das Frontend korrekt gated wäre, würde der Backend-Guard einen Employee-Team-Lead **trotz vorhandener `canWrite`-Permission** mit 403 blockieren.

### Anforderungen

1. **EINE** kanonische Entscheidungsregel "Wer darf managen?" für alle Feature-Module.
2. **Konsistenz** zwischen Frontend-Sichtbarkeit und Backend-Enforcement — kein Button sichtbar, der zu 403 führt.
3. **Kompatibel** mit Deputy-Toggle (ADR-039) — das Routing durch Leads/Deputies ist Backend-Aufgabe, Frontend vertraut dem `orgScope.isAnyLead`-Flag.
4. **Kompatibel** mit Per-User-Permissions (ADR-020) — fein-granulare Overrides bleiben wirksam.
5. **Creator-Bypass** — wer einen Beitrag erstellt hat, darf ihn bearbeiten/löschen (sofern das Feature Besitz kennt, z. B. Blackboard-Eintrag, KVP-Vorschlag).
6. **Einfach für neue Features**: Copy-Paste eines Patterns, keine Meta-Programmierung.

---

## Decision

### 3-Schichten-Modell ("Permission Stack")

Jede Aktion im System durchläuft **bis zu drei** Gates in dieser Reihenfolge:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 0: Addon-Subscription (ADR-033)                            │
│   → Hat der Tenant dieses Modul gebucht?                         │
│   → Frontend: `requireAddon()` in +page.server.ts                │
│   → Backend: @RequireAddon-Guard (falls vorhanden)               │
│   → Scheitert hier → Addon nicht abonniert, komplette Page weg   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Management-Gate ("Darf der User überhaupt verwalten?")  │
│   → Kombiniert Role + hasFullAccess + Lead-Scope + Deputy-Toggle │
│   → Frontend: `canManage<Modul>(role, hasFullAccess, isAnyLead)` │
│   → Backend: @RequirePermission (NICHT @Roles!)                  │
│   → Scheitert hier → Button/Seite unsichtbar, 403 bei Direktzugriff │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Fine-grained Action-Permission (ADR-020)                │
│   → Hat der User für dieses Modul+Action canRead/canWrite/canDelete? │
│   → Frontend (optional): `/{modul}/my-permissions`-Endpoint      │
│   → Backend: @RequirePermission(ADDON, MODULE, 'canWrite')       │
│   → Scheitert hier → Einzelne Action verweigert                  │
├─────────────────────────────────────────────────────────────────┤
│ Creator-Bypass (wenn anwendbar)                                  │
│   → authorId === currentUser.id → Edit/Delete auf eigenem Content│
│   → Service-intern, NICHT Controller-Guard                       │
└─────────────────────────────────────────────────────────────────┘
```

**Wichtig:** Layer 1 ist NEU-kanonisch und ersetzt jede Form von `isAdmin`-Shortcut. Layer 2 ist bereits in ADR-020 definiert. Creator-Bypass ist pro Feature zu entscheiden.

### Layer 1: Die Management-Gate-Regel

```
canManage := role === 'root'
          || (role === 'admin' && hasFullAccess === true)
          || isAnyLead === true
```

**Erläuterung der Komponenten:**

| Komponente        | Bedeutung                                                                | Quelle                                   |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `role === 'root'` | System-Rolle Root — immer Bypass by design.                              | `users.role` (ADR-010)                   |
| `hasFullAccess`   | Admin-Flag "sieht alles im Tenant wie Root".                             | `users.has_full_access` (ADR-010)        |
| `isAnyLead`       | User ist Area-/Department-/Team-Lead **ODER** Deputy-mit-aktivem-Toggle. | `GET /users/me/org-scope` (ADR-035, 039) |

**Deputy-Logik (ADR-039) ist bewusst _nicht_ explizit in der Formel:** Backend merged Deputy-IDs automatisch in `leadXxxIds`, wenn der Tenant-Toggle `deputy_has_lead_scope` aktiv ist. Das Frontend sieht nur noch `isAnyLead = true/false` — null Komplexität auf Seite des Consumers.

### Decision-Table "Wer darf managen?" (Layer 1)

| User                             | role       | hasFullAccess | Lead? | Deputy? | deputyToggle | canManage? |
| -------------------------------- | ---------- | ------------- | ----- | ------- | ------------ | ---------- |
| Root                             | `root`     | —             | —     | —       | —            | ✅ ja      |
| Admin (vollzugriff)              | `admin`    | `true`        | —     | —       | —            | ✅ ja      |
| Admin (eingeschränkt, ohne Lead) | `admin`    | `false`       | nein  | nein    | —            | ❌ nein    |
| Admin als Area-Lead              | `admin`    | `false`       | ja    | —       | —            | ✅ ja      |
| Admin als Deputy (Toggle AUS)    | `admin`    | `false`       | nein  | ja      | `false`      | ❌ nein    |
| Admin als Deputy (Toggle AN)     | `admin`    | `false`       | nein  | ja      | `true`       | ✅ ja¹     |
| Employee (kein Lead)             | `employee` | —             | nein  | nein    | —            | ❌ nein    |
| Employee als Team-Lead           | `employee` | —             | ja    | —       | —            | ✅ ja      |
| Employee als Deputy (Toggle AUS) | `employee` | —             | nein  | ja      | `false`      | ❌ nein    |
| Employee als Deputy (Toggle AN)  | `employee` | —             | nein  | ja      | `true`       | ✅ ja¹     |

¹ Backend setzt `isAnyLead = true` durch Deputy-Merge — Frontend sieht nur `isAnyLead=true`.

### Layer 2: Fine-grained Override (ADR-020)

Der Admin mit Vollzugriff darf _grundsätzlich_ alles. Der Tenant-Root-Admin kann aber **explizit** einzelne Permissions entziehen oder für delegierte Leads fein-granulare `canRead/canWrite/canDelete` pro Modul setzen (siehe ADR-020 Extension 2026-03-14).

**Regel:** Layer 2 ist **immer enforced im Backend** via `@RequirePermission`. Im Frontend ist es _optional_ — nur nötig, wenn eine Action-Verweigerung sonst zu einem überraschenden 403 führen würde (siehe "Wann Layer 2 im Frontend?" unten).

### Creator-Bypass (optional, pro Feature)

Wenn eine Entity einen `authorId`/`createdById` hat und die Fachlogik das erlaubt (z. B. Blackboard-Eintrag, KVP-Vorschlag, Kalender-Event `personal`), **umgeht der Autor sowohl Layer 1 als auch Layer 2** für Edit/Delete seiner _eigenen_ Records.

- Implementation: **Service-intern**, nicht als Controller-Guard.
- Kein Bypass für `canRead` (der ist ohnehin meist `canRead=true`).
- Kein Bypass für Archive/Unarchive oder andere "Management"-Actions — nur _trivial_-Owner-Edits (Titel, Text, Anhänge).

---

## Implementation Pattern

### Frontend — Canonical Helper

```typescript
// frontend/src/routes/(app)/_lib/navigation-config.ts

/**
 * Kanonische "Darf der User dieses Modul verwalten?"-Entscheidung.
 *
 * Pattern gilt für: Blackboard, Surveys, KVP-Kategorien, TPM-Config,
 *                   Vacation-Overview, Work-Orders-Admin, Approvals, …
 *
 * - Root: immer ja (by design).
 * - Admin: nur mit hasFullAccess ODER Lead-Funktion ODER Deputy-mit-Toggle.
 * - Employee: nur mit Lead-Funktion ODER Deputy-mit-Toggle.
 *
 * `isAnyLead` merged Deputy-IDs automatisch wenn Tenant-Toggle
 * `deputy_has_lead_scope` aktiv ist (ADR-039).
 *
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
export function canManage(role: string | undefined, hasFullAccess: boolean, isAnyLead: boolean): boolean {
  return role === 'root' || (role === 'admin' && hasFullAccess) || isAnyLead;
}

// Wrapper pro Modul (für Lesbarkeit + Grep-Friendly):
export const canManageBlackboard = canManage;
export const canManageSurveys = canManage;
export const canManageKvpCategories = canManage;
// ...
```

**Wrapper-Namen sind reine Lesbarkeit** — sie delegieren alle zu `canManage`. Wenn ein Modul in Zukunft eine abweichende Regel braucht, kann der Wrapper selektiv divergieren, ohne die generische Funktion zu brechen.

### Frontend — Page-Pattern

```typescript
// +page.server.ts (Defense-in-Depth — verhindert direkten URL-Zugriff)
import { canManageBlackboard } from '../../_lib/navigation-config';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const { user, activeAddons, orgScope } = await parent();
  requireAddon(activeAddons, 'blackboard'); // Layer 0

  // Layer 1: ist hier nur relevant wenn die GESAMTE Seite nur für Manager ist.
  // Für gemischte Seiten (Read+ggf. Write) wird Layer 1 am Button geprüft.
  // Page-Gate-Beispiel (manage-surveys):
  if (!canManageBlackboard(user?.role, user?.hasFullAccess === true, orgScope.isAnyLead)) {
    redirect(302, '/blackboard'); // oder 403
  }
  // ...
};
```

```svelte
<!-- +page.svelte (Button-Gate) -->
<script lang="ts">
  import { canManageBlackboard } from '../../_lib/navigation-config';

  const { data } = $props();
  const canManage = $derived(
    canManageBlackboard(
      data.user?.role,
      data.user?.hasFullAccess === true,
      data.orgScope.isAnyLead,
    ),
  );
</script>

{#if canManage}
  <button class="btn btn-primary" onclick={openCreateModal}>
    <i class="fas fa-plus mr-2"></i>Neuer Eintrag
  </button>
{/if}
```

### Frontend — Wann Layer 2 zusätzlich prüfen?

Layer 2 im Frontend ist nur dann sinnvoll, wenn:

1. Das Backend **könnte** einem User mit `canManage=true` die einzelne Action trotzdem verweigern (z. B. Admin-mit-Lead, dem Root `canWrite=false` gesetzt hat).
2. Die UX-Kosten eines überraschenden 403 sind hoch (z. B. User füllt Modal aus, klickt Save, bekommt dann 403).

Dann: **Etablier den TPM-Pattern `/{modul}/my-permissions`-Endpoint.** Rückgabe:

```typescript
// GET /blackboard/my-permissions
{ canReadPosts: true, canWritePosts: true, canDeletePosts: false,
  canReadArchive: true, canWriteArchive: false }
```

Frontend:

```svelte
<!-- Button-Gate mit Layer 1 + Layer 2 -->
{#if canManage && myPermissions.canWritePosts}
  <button>Neuer Eintrag</button>
{/if}
```

**Default-Empfehlung:** Fange mit nur Layer 1 an. Füge Layer 2 hinzu, sobald ein einziger Report eintrifft, dass Buttons 403-en.

### Backend — Canonical Controller-Guards

```typescript
// ✅ RICHTIG (Surveys-Pattern)
@Post('entries')
@RequirePermission(BLACKBOARD_ADDON, BB_POSTS, 'canWrite')
@HttpCode(HttpStatus.CREATED)
async createEntry(@Body() dto: CreateEntryDto, @CurrentUser() user: NestAuthUser) { ... }

// ❌ FALSCH (veralteter Blackboard-Stand)
@Post('entries')
@UseGuards(RolesGuard)
@Roles('admin', 'root')                                     // ← blockt Employee-Leads
@RequirePermission(BLACKBOARD_ADDON, BB_POSTS, 'canWrite')  // ← wird nie erreicht
async createEntry(...) { ... }
```

**Regel:** `@Roles('admin', 'root')` ist für Mutationen (POST/PUT/DELETE/PATCH) **VERBOTEN**, wenn ein `@RequirePermission` existiert. Die Rollen-Whitelist ist bereits in `@RequirePermission`-Guard eingebettet (prüft Lead-Scope + Deputy-Merge + hasFullAccess + ADR-020 canWrite).

`@Roles(...)` bleibt erlaubt für:

- **Read-Endpoints, die auf Management-Level sind** (z. B. `/users` komplette Liste) — hier ist ein Role-Gate günstiger als Permission-Check.
- **System-Endpoints** (`/root/…`), wo Root-Exklusivität fachlich gewollt ist.
- **Als Defense-in-Depth _zusätzlich_** — wenn ein Endpoint nur für `employee` (z. B. Vacation-Request submitten) sein soll, `@Roles('employee', 'admin', 'root')` + `@RequirePermission` kombinieren. Aber nie enger als die Permission-Regel.

### Backend — Creator-Bypass im Service

```typescript
async updateEntry(
  id: number,
  dto: UpdateEntryDto,
  tenantId: number,
  currentUser: NestAuthUser,
): Promise<Entry> {
  const entry = await this.repo.findById(id, tenantId);
  if (entry === null) throw new NotFoundException();

  // Creator-Bypass: Autor darf eigenen Beitrag editieren,
  // auch ohne Layer-1 (canManage) oder Layer-2 (canWrite).
  const isCreator = entry.authorId === currentUser.id;
  if (!isCreator) {
    // Non-Creator: normale Permission-Prüfung
    await this.permissions.assertCanWrite(currentUser, BB_ADDON, BB_POSTS);
  }

  return await this.repo.update(id, tenantId, dto);
}
```

**Wichtig:** Der Creator-Bypass ist **Service-Logik**, nicht Controller-Guard, weil er entity-abhängig ist (`authorId` kommt aus DB-Row).

---

## Alternatives Considered

### 1. Alles in `@RequirePermission` verstecken, kein Layer-1-Helper

**Verworfen.** Layer 1 ist als Frontend-Gate unverzichtbar (Button-Visibility vor API-Call). Ein reiner Backend-Only-Ansatz führt zu klickbaren Buttons, die dann 403-en — schlechte UX.

### 2. Role-Explosion: `admin-with-blackboard-write`, `employee-team-lead-with-kvp-write`, …

**Verworfen** (bereits in ADR-020 abgelehnt). Unwartbar bei 19 Addons × 42 Modulen × 3 Actions.

### 3. Pure ABAC (attribute-based) Policy-Engine (z. B. Casbin, OpenFGA)

**Verworfen.** Over-engineered für aktuellen Scope (4-6 Faktoren, keine komplexen Policies). ADR-020 hatte diese Entscheidung schon getroffen. Die Kombination aus Role + hasFullAccess + Lead-Scope + Permission deckt 100% der bekannten Anwendungsfälle ab.

### 4. Nur Layer 2 (ADR-020 allein, kein Layer 1)

**Verworfen.** Ohne Layer 1 müsste jeder User einzeln Permissions gesetzt bekommen — auch jeder Team-Lead manuell. Layer 1 ist das "vernünftige Default", das sagt: "Wer eine Führungsfunktion hat, darf verwalten — außer explizit anders geregelt."

---

## Consequences

### Positive

1. **Ein Pattern für alle Module** — Copy-Paste, nicht Re-Invent.
2. **Employee-Leads können echte Führungsarbeit tun**, nicht nur als Admins getaggt werden.
3. **Deputy-Toggle ADR-039 wirkt konsistent** für jedes Modul, ohne Modul-spezifische Logik.
4. **ADR-020 Fine-Grained-Permissions bleiben wirksam** — Layer 2 im Backend bleibt der verbindliche Enforcement-Punkt.
5. **Frontend/Backend können nicht auseinanderlaufen** — beide nutzen die gleichen Eingangsgrößen (`role`, `hasFullAccess`, `isAnyLead`).
6. **Migration-Aufwand ist überschaubar** — jeder "veraltete" `isAdmin`-Shortcut ist im Grep auffindbar.

### Negative

1. **Migration-Aufwand:** Alle Module mit `const isAdmin = role === 'admin' \|\| 'root'` (aktuell Blackboard, potentiell weitere) müssen umgestellt werden.
2. **Backend muss Guard-Kombinationen reviewen** — `@Roles('admin', 'root')` auf Mutations gehört in den meisten Fällen entfernt.
3. **Etwas Overhead** bei Deputy-Toggle-Änderungen: der `orgScope`-Cache im Frontend muss invalidiert werden, wenn der Toggle umgeschaltet wird (existiert bereits via `invalidateAll()`).

### Risks & Mitigations

| Risk                                                                                                           | Mitigation                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Entwickler vergisst Layer 1 im Frontend, nur Layer 2 → Button-403                                              | ESLint-Rule oder Review-Checkliste: jedes `@RequirePermission`-gated Mutation-UI muss `canManage` im Gate haben |
| Backend-Refactor entfernt `@Roles`, aber @RequirePermission ist nicht registriert → alle User bekommen Zugriff | CI-Test: für jede Mutation muss entweder `@RequirePermission` oder explizites `@Public()` gesetzt sein          |
| Deputy-Toggle wird serverseitig nicht in `orgScope` gemerged → Deputies sehen Buttons nicht                    | Unit-Test in ScopeService (existiert bereits für Surveys — als Referenz)                                        |
| Creator-Bypass wird im Service übersehen → Ersteller kann eigenen Beitrag nicht editieren                      | Integration-Test pro Feature: Creator kann immer editieren/löschen (unabhängig von Permissions)                 |

---

## Migration Checklist

Für JEDES Feature-Modul das Mutationen (POST/PUT/DELETE/PATCH) hat:

### Frontend

- [ ] Grep nach `isAdmin` / `role === 'admin'` / `role === 'root'` in `+page.svelte` und `+page.server.ts`.
- [ ] Ersetze durch `canManage<Modul>(role, hasFullAccess, orgScope.isAnyLead)`.
- [ ] Wrapper in `navigation-config.ts` eintragen (für Lesbarkeit + Grep).
- [ ] Defense-in-Depth in `+page.server.ts`: Redirect für Nicht-Manager, wenn die Page _nur_ Management ist.
- [ ] Optional Layer 2: Falls UX es verlangt, `/{modul}/my-permissions`-Endpoint einführen (TPM-Muster).

### Backend

- [ ] Grep nach `@Roles('admin', 'root')` in allen Feature-Controllern.
- [ ] Auf Mutations (`@Post`, `@Put`, `@Delete`, `@Patch`): `@Roles(...)` ENTFERNEN, `@RequirePermission(...)` bleibt der alleinige Guard.
- [ ] Auf Reads: Case-by-case — wenn reine Admin-Listen (`/admins`, `/root-users`), darf `@Roles('admin', 'root')` bleiben.
- [ ] Creator-Bypass im Service einbauen, wenn das Feature Besitz kennt (`authorId`/`createdById`).
- [ ] Integration-Test: Employee-Team-Lead kann Create/Update/Delete (über `@RequirePermission`-Pfad).
- [ ] Integration-Test: Admin ohne hasFullAccess und ohne Lead-Funktion kann NICHT.

### Priorisiertes Backlog

Sortiert nach "Blast-Radius" — wo ein veraltetes `isAdmin`-Gate am meisten Schmerz produziert:

1. **Blackboard** — Referenz-Migration (dieses ADR wurde durch den konkreten Bug getriggert).
2. **Weitere noch zu identifizieren** (grep-Scan im Rahmen der Blackboard-Migration).

---

## References

- [ADR-010: Rollen & Hierarchie](./ADR-010-user-role-assignment-permissions.md) — `has_full_access`, Area/Dept/Team-Leads, Inheritance-Rules.
- [ADR-012: Route Security Groups](./ADR-012-frontend-route-security-groups.md) — SvelteKit `(root)/(admin)/(shared)` Fail-Closed.
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — `user_addon_permissions`, Decentralized Registry, Delegated Management (2026-03-14 Extension).
- [ADR-024: Frontend Feature Guards](./ADR-024-frontend-feature-guards.md) — `hasFeature()`, Addon-Gates.
- [ADR-033: Addon-basiertes SaaS-Modell](./ADR-033-addon-based-saas-model.md) — `tenant_addons`, Subscription-Gate (Layer 0).
- [ADR-035: Organizational Hierarchy](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — `orgScope` API, Lead-Position-Resolution.
- [ADR-036: Organizational Scope Access](./ADR-036-organizational-scope-access-control.md) — Scope-Delegation, Deputy-Role.
- [ADR-039: Per-Tenant Deputy-Scope Toggle](./ADR-039-per-tenant-deputy-scope-toggle.md) — Merge-Logik Deputy → Lead, Tenant-Setting.
- [CODE-OF-CONDUCT.md](../../CODE-OF-CONDUCT.md) — KISS, keine Quick-Fixes.
- Kanonische Referenz-Implementation: `backend/src/nest/surveys/surveys.controller.ts` + `frontend/src/routes/(app)/(shared)/manage-surveys/+page.server.ts`.
