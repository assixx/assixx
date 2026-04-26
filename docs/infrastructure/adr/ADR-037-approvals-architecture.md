# ADR-037: Approvals (Freigabe-System) Architecture

| Metadata                | Value                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                |
| **Date**                | 2026-03-17                                                                                                                              |
| **Decision Makers**     | SCS-Technik Team                                                                                                                        |
| **Affected Components** | PostgreSQL (3 Migrations, 2 Tabellen, 3 ENUMs), Backend (NestJS ApprovalsModule, 10 Endpoints), Frontend (2 Pages, Sidebar, Tests)      |
| **Supersedes**          | ---                                                                                                                                     |
| **Related ADRs**        | ADR-009 (Role Assignment), ADR-019 (RLS), ADR-020 (Permissions), ADR-028 (Work Orders), ADR-033 (Addon-Modell), ADR-035 (Org Hierarchy) |

---

## Context

### Das Problem: Kein zentraler Genehmigungsworkflow

Mehrere Addons erzeugen Inhalte, die vor Umsetzung oder Veröffentlichung eine Freigabe benötigen — aber es gibt keinen einheitlichen Mechanismus dafür. Jedes Addon müsste seinen eigenen Approval-Flow bauen, was zu Duplikation, Inkonsistenz und Wartungsalptraum führt.

| Problem                             | Impact                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Kein zentraler Genehmigungsworkflow | Jedes Addon müsste eigene Approval-Logik implementieren                       |
| Keine Transparenz                   | Admins/Leads wissen nicht, welche Freigaben offen sind                        |
| Keine Konfigurierbarkeit            | Wer genehmigen darf, ist hardcoded statt konfigurierbar                       |
| Kein Audit-Trail für Entscheidungen | Genehmigungen/Ablehnungen werden nicht zentral protokolliert                  |
| Keine addon-übergreifende Übersicht | Kein einheitliches Dashboard für alle offenen Freigaben aus KVP, Urlaub, etc. |

### Betroffene Addons (Beispiele)

| Addon        | Anwendungsfall                                               |
| ------------ | ------------------------------------------------------------ |
| `kvp`        | Team Lead findet KVP-Vorschlag gut → Freigabe beim Master    |
| `vacation`   | Urlaubsantrag → Genehmigung durch Vorgesetzten               |
| `blackboard` | Beitrag vor Veröffentlichung → Freigabe durch Admin          |
| `calendar`   | Termin mit Ressourcenbuchung → Genehmigung durch Zuständigen |
| `surveys`    | Umfrage vor Veröffentlichung → Freigabe                      |
| Zukünftige   | Jedes Addon kann das System nutzen — flexibel erweiterbar    |

### Anforderungen

- Zentrales, addon-übergreifendes Freigabe-System
- Core-Addon (immer aktiv, keine Subscription nötig)
- Konfigurierbar: Wer darf was genehmigen (pro Addon, pro Tenant)
- Mehrere Approval Masters pro Addon möglich
- Pro-Entity Flexibilität: Jede Freigabe-Anfrage kann einen individuellen Master bekommen
- Dynamische Auflösung: Genehmiger kann anhand der Org-Hierarchie bestimmt werden (Team Lead, Area Lead, Department Lead)
- Einfacher Lifecycle: pending → approved/rejected (kein Revisions-Ping-Pong)
- Polymorphe Source-Referenz: Welches Addon + welche Entity hat die Freigabe ausgelöst
- Granulares Filtern nach Addon, Entity-Typ, Status, Priorität

---

## Decision

### 1. Eigenständiges Core-Addon

**Problem:** Approval-Logik könnte in jedes Addon integriert werden, aber das erzeugt massive Duplikation.

**Lösung:** Eigenständiges `approvals` Core-Addon mit zentraler Konfiguration und polymorphen Source-Referenzen. Jedes Addon kann Freigaben auslösen, ohne eigene Approval-Logik zu implementieren.

```
┌─────────────────────────────────────────────────────────────┐
│  APPROVALS (Core-Addon — immer aktiv)                        │
│                                                             │
│  ┌──────────────┐     ┌──────────────────────────────┐      │
│  │ approval_    │     │ approvals                     │      │
│  │ configs      │     │                               │      │
│  │              │     │ ← KVP Suggestion              │      │
│  │ Wer darf     │────>│ ← Vacation Request            │      │
│  │ was          │     │ ← Blackboard Post             │      │
│  │ genehmigen?  │     │ ← Calendar Event              │      │
│  │              │     │ ← ... (jedes Addon)           │      │
│  └──────────────┘     └──────────────────────────────┘      │
│                                                             │
│  /manage-approvals (Master-View: nur eingehende Freigaben)  │
└─────────────────────────────────────────────────────────────┘
```

### 2. Naming-Konvention

| Kontext             | Bezeichnung  | Beispiel                                            |
| ------------------- | ------------ | --------------------------------------------------- |
| Code / DB / Backend | `approval`   | `approvals`, `approval_configs`, `ApprovalsService` |
| Frontend (intern)   | `approval`   | `approvalGuard()`, `pendingApprovals`               |
| Landing Page / UI   | "Freigabe"   | "Freigabe anfordern", "Freigabe erteilt"            |
| NestJS Module       | `Module`     | `ApprovalsModule`                                   |
| URL                 | `/approvals` | `/manage-approvals` (Master), `/approvals` (eigene) |

### 3. Status-Lifecycle (3 Stufen, kein Revisions-Loop)

```
pending ──→ approved
        └─→ rejected
```

| Transition         | Wer             | Aktion                             |
| ------------------ | --------------- | ---------------------------------- |
| pending → approved | Approval Master | Genehmigt mit optionalem Kommentar |
| pending → rejected | Approval Master | Lehnt ab mit Begründung            |

**Warum kein Revisions-Loop?** KISS. Bei Ablehnung wird ein neuer Approval erstellt. Das vermeidet komplexe State-Machines und hält den Audit-Trail sauber (jeder Approval = eine Entscheidung).

### 4. Zwei-Tabellen-Architektur

**`approval_configs`** — Konfiguration: Wer DARF was genehmigen

Die Config-Tabelle definiert pro Addon und Tenant, welche Personen als Approval Master fungieren. Mehrere Rows pro Addon = mehrere Masters. Defaults sind immer leer — Konfiguration erfolgt über die UI.

**`approvals`** — Die eigentlichen Freigabe-Anfragen

Jede Freigabe-Anfrage referenziert polymorphe Source-Daten (addon_code + source_entity_type + source_uuid) und trackt den vollständigen Entscheidungsprozess.

### 5. Approval Master — Konfigurierbare Auflösung

```
approval_configs.approver_type:
├── 'user'            → Direkter User (approver_user_id)
├── 'team_lead'       → Dynamisch: team.lead_id des Requesters
├── 'area_lead'       → Dynamisch: area.lead_id des Requesters
└── 'department_lead' → Dynamisch: department.lead_id des Requesters
```

**Dynamische Typen** (`team_lead`, `area_lead`, `department_lead`) werden zur Laufzeit anhand der Org-Hierarchie des anfragenden Users aufgelöst (ADR-035). Das `approver_user_id` Feld bleibt NULL — der Backend-Service bestimmt den konkreten User.

**Custom Roles** werden über `approver_type = 'user'` + `role_label` abgebildet. Beispiel: "TPM Schrittmacher" = User X. Das `role_label` dient nur der Anzeige in der UI.

### 6. Pro-Entity Flexibilität

Jede Freigabe-Anfrage hat ein optionales `assigned_to` Feld:

- **NULL** → Alle konfigurierten Masters (aus `approval_configs`) sehen die Anfrage im `/manage-approvals` Dashboard
- **Gesetzt** → Nur der spezifische User sieht die Anfrage (Override der Config)

Das ermöglicht:

- Default-Verhalten über Config (z.B. "Alle KVP-Freigaben gehen an User A und B")
- Override pro Entity (z.B. "Diese eine Freigabe geht an User C")

### 7. Polymorphe Source-Referenz

```sql
addon_code         VARCHAR(50)   -- 'kvp', 'vacation', 'blackboard', etc.
source_entity_type VARCHAR(100)  -- 'kvp_suggestion', 'vacation_request', etc.
source_uuid        CHAR(36)      -- Referenz auf Quell-Entity
```

**Warum kein Foreign Key?** `source_uuid` zeigt auf verschiedene Tabellen je nach `addon_code` + `source_entity_type`. Ein FK wäre nur auf eine Tabelle möglich. Pattern identisch zu Work Orders (ADR-028).

**Warum `addon_code` UND `source_entity_type`?** Doppelte Granularität ermöglicht:

- Filtern nach Addon (alle KVP-Freigaben)
- Filtern nach Entity-Typ (nur KVP-Vorschläge, nicht KVP-Kommentare)
- Zukünftige Addons können mehrere Entity-Typen haben

### 8. Abgrenzung zu Work Orders (ADR-028)

| Aspekt    | Work Orders                               | Approvals                             |
| --------- | ----------------------------------------- | ------------------------------------- |
| Zweck     | Aufgaben-Ausführung ("mach das")          | Autorisierungs-Gate ("genehmige das") |
| Lifecycle | open → in_progress → completed → verified | pending → approved/rejected           |
| Dauer     | Tage/Wochen                               | Minuten bis Stunden                   |
| Akteure   | Arbeiter die ausführen                    | Masters die entscheiden               |
| Ergebnis  | Aufgabe erledigt                          | Ja/Nein-Entscheidung                  |

**Kein Merge:** Zwei fundamental verschiedene Konzepte in eine God-Table zu zwingen verletzt KISS und erzeugt unused columns pro Typ. Eine natürliche Verbindung existiert: Ein genehmigter Approval KANN einen Work Order triggern — aber das ist eine Beziehung, kein Grund zum Mergen.

---

## Database Schema

### Migration 099: `approvals-core-tables`

| Tabelle            | Spalten | RLS | Zweck                                                |
| ------------------ | ------- | --- | ---------------------------------------------------- |
| `approval_configs` | 13      | Ja  | Konfiguration: wer darf was genehmigen (inkl. Scope) |
| `approvals`        | 18      | Ja  | Eigentliche Freigabe-Anfragen                        |

### Neue ENUMs

- `approval_status`: `pending`, `approved`, `rejected`
- `approval_approver_type`: `user`, `team_lead`, `area_lead`, `department_lead`, `position`

### Schema: `approval_configs`

```sql
CREATE TABLE approval_configs (
    id SERIAL PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_code VARCHAR(50) NOT NULL,
    approver_type approval_approver_type NOT NULL DEFAULT 'user',
    approver_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    approver_position_id UUID REFERENCES position_catalog(id) ON DELETE RESTRICT,
    scope_area_ids INTEGER[] DEFAULT NULL,
    scope_department_ids INTEGER[] DEFAULT NULL,
    scope_team_ids INTEGER[] DEFAULT NULL,
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: Kein doppelter Approver pro Addon/Typ/User
CREATE UNIQUE INDEX idx_approval_configs_unique
    ON approval_configs(tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
    WHERE is_active = 1;

-- RLS (MANDATORY — NULLIF pattern)
ALTER TABLE approval_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approval_configs
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
GRANT SELECT, INSERT, UPDATE, DELETE ON approval_configs TO app_user;
```

### Schema: `approvals`

```sql
CREATE TABLE approvals (
    id SERIAL PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_code VARCHAR(50) NOT NULL,
    source_entity_type VARCHAR(100) NOT NULL,
    source_uuid CHAR(36) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    status approval_status NOT NULL DEFAULT 'pending',
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    decided_by INTEGER REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    decision_note TEXT,
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes für typische Queries
CREATE INDEX idx_approvals_status ON approvals(tenant_id, status) WHERE is_active = 1;
CREATE INDEX idx_approvals_addon ON approvals(tenant_id, addon_code) WHERE is_active = 1;
CREATE INDEX idx_approvals_addon_entity ON approvals(tenant_id, addon_code, source_entity_type) WHERE is_active = 1;
CREATE INDEX idx_approvals_source ON approvals(source_uuid) WHERE is_active = 1;
CREATE INDEX idx_approvals_assigned_to ON approvals(assigned_to) WHERE assigned_to IS NOT NULL AND is_active = 1;

-- RLS (MANDATORY — NULLIF pattern)
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approvals
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
GRANT SELECT, INSERT, UPDATE, DELETE ON approvals TO app_user;
```

### Addon-Eintrag

```sql
INSERT INTO addons (code, name, description, is_core, trial_days, icon, sort_order)
VALUES ('approvals', 'Freigaben', 'Zentrales Freigabe-System', true, NULL, 'fa-check-double', 10);
-- id=22, is_core=true → immer aktiv, kein Guard nötig
```

---

## Frontend Architecture

### Route Group: `(shared)`

Die Route lebt in `(shared)` (nicht `(admin)`), da Employees mit Lead-Position Zugang benötigen. RBAC erfolgt auf Page-Level in `+page.server.ts`.

### Zugangs-Matrix (ADR-009 / ADR-020)

| Rolle / Position                       | Zugang | Quelle                                     |
| -------------------------------------- | ------ | ------------------------------------------ |
| Root                                   | ✅     | Immer                                      |
| Admin mit `has_full_access=true`       | ✅     | `user.hasFullAccess` Check                 |
| Admin ohne full_access                 | ❌     | Kein Zugang ohne Lead-Position             |
| Employee mit `team_lead_id`            | ✅     | `orgScope.isTeamLead` (ADR-009 §3.3)       |
| Employee mit `area_lead_id`            | ✅     | `orgScope.isAreaLead` (ADR-009 §3.3)       |
| Employee mit `department_lead_id`      | ✅     | `orgScope.isDepartmentLead` (ADR-009 §3.3) |
| Approval Master (aus approval_configs) | ✅     | TODO: Backend-API Abfrage                  |
| Employee ohne Lead-Position            | ❌     | Redirect zu `/permission-denied`           |

### Sidebar-Sichtbarkeit

- **Root / Admin**: Statischer Menüpunkt "Freigaben" (`navigation-config.ts`)
- **Employee-Lead**: Dynamisch injected via `filterMenuByScope()` — nur wenn `orgScope.isTeamLead`, `isAreaLead`, oder `isDepartmentLead`
- **Employee ohne Lead**: Kein Menüpunkt sichtbar

### Master View (`/manage-approvals`)

- Nur eingehende Freigaben (assigned_to = aktueller User ODER Config-Match)
- Filtern nach: Addon, Status, Priorität, Zeitraum
- Detail-Ansicht: Source-Entity Details + Approve/Reject Buttons
- Entscheidungs-Notiz (Pflicht bei Ablehnung, optional bei Genehmigung)

### Eigene Anfragen View (`/approvals`)

- Alle eigenen Freigabe-Anfragen (requested_by = aktueller User)
- Status-Übersicht: pending/approved/rejected
- Detail-Ansicht mit Entscheidungs-History

### Integration in Source-Addons

- KVP Detail-Seite: "Freigabe anfordern" Button
- Vacation Detail-Seite: Approval-Status Anzeige
- Jedes Addon kann den ApprovalsService nutzen

---

## Permission-Module (ADR-020)

### Decentralized Registry Pattern

Wie alle Addon-Module registriert `approvals` seine Permissions über das Registry Pattern (ADR-020):

```typescript
// backend/src/nest/approvals/approvals.permissions.ts
export const APPROVALS_PERMISSIONS: PermissionCategoryDef = {
  code: 'approvals',
  label: 'Freigaben',
  icon: 'fa-check-double',
  modules: [
    {
      code: 'approvals-manage',
      label: 'Freigaben verwalten',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'approvals-request',
      label: 'Freigaben anfordern',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
```

| Module              | canRead                    | canWrite                | canDelete      |
| ------------------- | -------------------------- | ----------------------- | -------------- |
| `approvals-manage`  | Eingehende Freigaben sehen | Genehmigen/Ablehnen     | Config löschen |
| `approvals-request` | Eigene Anfragen sehen      | Neue Freigabe anfordern | —              |

### Core-Addon: Kein AddonGuard

Da `approvals` ein Core-Addon ist (`is_core=true`), wird **kein** `requireAddon()` / `@RequireAddon()` benötigt. Die Tenant-Addon-Prüfung entfällt — das Addon ist immer aktiv.

Per-User Permissions (ADR-020) gelten trotzdem: Ein Admin kann einem Employee den Zugang zu `approvals-manage` entziehen, auch wenn das Addon selbst aktiv ist.

### Frontend Permission-Denied Pattern

Wenn Backend-API steht, verwendet `/manage-approvals` das `apiFetchWithPermission()` Pattern (ADR-020 §6):

```typescript
// +page.server.ts (zukünftig)
const result = await apiFetchWithPermission<ApprovalListItem[]>('/approvals', token, fetch);
if (result.permissionDenied) {
  return { permissionDenied: true as const, ... };
}
```

```svelte
<!-- +page.svelte (zukünftig) -->
{#if permissionDenied}
  <PermissionDenied addonName="die Freigaben" />
{:else}
  <!-- Page content -->
{/if}
```

---

## Geplante Erweiterungen (nicht in V1)

| Feature                | Beschreibung                                                | Priorität |
| ---------------------- | ----------------------------------------------------------- | --------- |
| SSE-Notifications      | Real-time Benachrichtigung bei neuer/entschiedener Freigabe | Hoch      |
| Eskalation             | Auto-Eskalation wenn Master nicht reagiert (nach X Tagen)   | Mittel    |
| Batch-Approve          | Mehrere Freigaben auf einmal genehmigen                     | Mittel    |
| Work Order Trigger     | Genehmigte Freigabe erzeugt automatisch Work Order          | Niedrig   |
| Custom Approval-Chains | Mehrstufige Genehmigung (Lead → Manager → Direktor)         | Niedrig   |
| Approval-Templates     | Vordefinierte Freigabe-Workflows pro Addon                  | Niedrig   |

---

## Alternatives Considered

### Option A: Approval-Logik in jedes Addon integrieren

Jedes Addon (KVP, Vacation, etc.) implementiert seinen eigenen Approval-Flow.

**Verworfen:** Massive Duplikation. 6+ Addons × Approval-Logik = 6× der gleiche Code. Keine zentrale Übersicht. Jede Änderung am Approval-Flow muss in jedem Addon nachgezogen werden. KISS-Verletzung.

### Option B: In Work Orders integrieren

Approvals als spezielle Work-Order-Variante mit `source_type: 'approval'`.

**Verworfen:** Fundamental verschiedene Konzepte. Work Orders = Aufgaben-Ausführung (Tage/Wochen), Approvals = Ja/Nein-Entscheidung (Minuten). Merge erzeugt God-Table mit unused columns. Verschiedene Lifecycles (4 Stufen vs 3 Stufen). KISS-Verletzung.

### Option C: Globaler Approval Master pro Tenant

Ein einziger Master für alle Freigaben im gesamten Tenant.

**Verworfen:** Zu unflexibel. In der Praxis genehmigt der Qualitätsmanager KVP, der Personalchef Urlaub, und der Abteilungsleiter Kalender-Einträge. Ein globaler Master ist ein Bottleneck.

### Option D: Approval mit Revisions-Loop

Status-Lifecycle: pending → approved/rejected/revision_requested → resubmitted → approved/rejected.

**Verworfen:** Überengineering für V1. Revisions-Loops erzeugen komplexe State-Machines und unklaren Audit-Trail. Bei Ablehnung einfach neuen Approval erstellen — das ist transparenter und einfacher. Kann bei Bedarf in V2 ergänzt werden.

---

## Consequences

### Positive

1. **Zentraler Genehmigungsworkflow** — Ein System für alle Addons, keine Duplikation
2. **Konfigurierbar** — Wer was genehmigen darf ist per UI einstellbar, nicht hardcoded
3. **Org-Hierarchie-Integration** — Dynamische Auflösung über Team/Area/Department Leads (ADR-035)
4. **Granulares Filtern** — Nach Addon, Entity-Typ, Status, Priorität, Zeitraum
5. **Core-Addon** — Immer verfügbar, keine Addon-Aktivierung nötig
6. **Einfacher Lifecycle** — Drei Zustände, keine State-Machine-Komplexität
7. **Polymorphe Source-Referenz** — Jedes Addon kann Freigaben auslösen ohne Schema-Änderung
8. **Audit-Trail** — Jede Entscheidung mit decided_by, decided_at, decision_note dokumentiert

### Negative

1. **Neue Migration + 2 Tabellen** — Erhöht DB-Komplexität (aber minimal: 2 Tabellen + 2 ENUMs)
2. **Addon-Integration erforderlich** — Jedes Addon muss den ApprovalsService aufrufen (einmaliger Aufwand)
3. **Kein Revisions-Loop in V1** — Bei Ablehnung muss neuer Approval erstellt werden
4. **Config defaults leer** — Tenant-Admin muss nach Setup die Approval Masters konfigurieren

### Risiken (mitigiert)

| Risiko                           | Mitigation                                                      |
| -------------------------------- | --------------------------------------------------------------- |
| Kein Master konfiguriert         | UI zeigt Warnung wenn Config leer; Backend blockt Anfrage       |
| Dynamischer Lead nicht aufgelöst | Fallback: Approval bleibt in pending, Admin wird benachrichtigt |
| Polymorphe source_uuid orphaned  | Kein CASCADE nötig — Approval ist eigenständig dokumentiert     |
| Zu viele offene Freigaben        | Filter + Sortierung in /manage-approvals; Batch-Approve geplant |

---

## Amendment: Organizational Scope (2026-03-23)

### Problem

`approval_configs` was flat per tenant + addon — no concept of organizational scope. When `approver_type = 'user'` or `'position'`, the configured approver handled ALL approval requests for the entire tenant. Real-world requirement: different approval masters per area, department, or team.

### Changes

**3 new INTEGER[] columns on `approval_configs`:**

- `scope_area_ids` — NULL = whole tenant, `{1,3}` = only Areas 1 and 3
- `scope_department_ids` — additional departments not covered by area cascade
- `scope_team_ids` — additional teams not covered by department cascade

**Scope semantics:** All three NULL = whole tenant (backward compatible). If ANY column is non-NULL, it acts as an OR filter. Hierarchy-based types (`team_lead`, `area_lead`, `department_lead`) have implicit scope via org membership — scope columns are ignored for them.

**`resolveApprovers()` enhanced:** CTE `requester_org` resolves the requesting user's organizational context (area_id, department_id, team_id). The `user` and `position` branches filter by scope matching. Hierarchy branches remain unchanged.

**KVP visibility extended:** `buildVisibilityClause()` in `kvp.helpers.ts` includes an approval-master visibility path — users configured as KVP approval masters see KVPs in their approval scope, regardless of their normal org scope.

**Frontend:** `/settings/approvals` page includes "Ganze Firma" toggle + Area/Department/Team multiselect (Blackboard pattern) for `user` and `position` approver types. Cascade logic auto-removes redundant selections.

### Schema corrections (pre-existing inaccuracies)

- Removed `role_label VARCHAR(100)` from documented schema (never existed in DB)
- Added `position` to `approval_approver_type` enum documentation (existed in DB since ADR-038)
- Added `approver_position_id UUID` to documented schema (existed in DB since ADR-038)
- Updated column count from 10 to 13

### Related

- [FEAT_APPROVAL_SCOPE_MASTERPLAN.md](../../FEAT_APPROVAL_SCOPE_MASTERPLAN.md) — Execution plan
- [ADR-038: Position Catalog](./ADR-038-position-catalog-architecture.md) — Position-based approval masters

---

## Amendment: Addon Integration Status (2026-03-29)

### Implemented Integrations

Two addons are fully integrated with the centralized Approvals system. Their bridge services serve as reference implementations for future addon integrations.

| Addon | Bridge Service           | Masterplan                                                                                       | addon_code | source_entity_type | Status Sync                          | Version Coupling                        |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------ | ---------- | ------------------ | ------------------------------------ | --------------------------------------- |
| KVP   | `KvpApprovalService`     | [FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md](../../FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md) | `kvp`      | `kvp_suggestion`   | Yes (approved/rejected → KVP status) | No                                      |
| TPM   | `TpmPlanApprovalService` | [FEAT_TPM_PLAN_APPROVAL_MASTERPLAN.md](../../FEAT_TPM_PLAN_APPROVAL_MASTERPLAN.md)               | `tpm`      | `tpm_plan`         | No (informational only)              | Yes (`approval_version.revision_minor`) |

### Bridge Service Pattern (Reference for Future Addons)

Every addon integration follows the same pattern:

1. **Bridge Service** (`{addon}-approval.service.ts`) — Injectable NestJS service that:
   - Creates approval requests via `ApprovalsService.create()`
   - Subscribes to `approval.decided` events on the EventBus
   - Handles addon-specific side effects on approve/reject
   - Implements startup reconciliation for missed events (onModuleInit)

2. **Module Registration** — Import `ApprovalsModule` in the addon's module, register bridge service

3. **Controller Integration** — Fire-and-forget approval calls after CRUD operations

4. **Frontend** — Add addon to `APPROVABLE_ADDONS` (settings), `ADDON_FILTER_OPTIONS` + `ADDON_BADGE` + `resolveSourceUrl()` (manage-approvals)

### Key Findings from Implementation

**Self-Approval Prevention (C1):** `ApprovalsService.reject()` blocks `requested_by === decidedBy`. This means a user who creates/edits an entity CANNOT auto-reject their own pending approval. Supersede patterns (auto-rejecting old approvals on edit) are NOT possible for same-user workflows. TPM solves this with the "no-supersede" pattern: edits with an existing pending approval reuse it instead of creating a new one.

**Event Payload (D7):** The `approval.decided` EventBus payload contains `approval.uuid` and `approval.addonCode` but does NOT contain `sourceUuid` or `sourceEntityType`. Bridge services must query the `approvals` table to resolve `source_uuid` before acting on the decision.

**Config Gate (D6):** If no approval master is configured for an addon (`approval_configs` has no rows), the bridge service should skip approval creation entirely. Otherwise orphaned approvals accumulate that nobody can decide.

### KVP-specific Patterns

- **Status Sync:** KVP suggestions track their own status (`in_review`, `approved`, `rejected`). The bridge service syncs this when an approval decision is made.
- **Notification Bridge:** Creates persistent notifications + SSE events for both request and decision.
- **No Supersede:** KVP prevents new approvals while one is pending (different approach from TPM, same result).

---

## Amendment: KVP Hard-Gate (2026-04-26)

### Problem

The 2026-03-29 amendment recorded `Config Gate (D6)`: "If no config → bridge skips approval creation entirely. Otherwise orphaned approvals accumulate." That was a _bridge-level_ skip — the underlying KVP submission still went through. In production this meant a tenant could collect KVP suggestions that had no defined route to a decision-maker, leaving the workflow promise (every KVP gets reviewed) silently broken. The "Kein Master konfiguriert" hint at `/settings/approvals` warned admins, but employees could still submit suggestions that would never be approved.

### Decision

**KVP submission is hard-blocked when no approval master is reachable for the requester's organizational scope.** Bypass for system users only — `role === 'root'` or `role === 'admin' && has_full_access === true`. Lead-only admins, employees, and employee-leads must wait until the tenant admin has wired an approval config that covers their area/department/team.

The check delegates to `ApprovalsConfigService.resolveApprovers('kvp', userId)` — single source of truth for scope resolution (added in the 2026-03-23 Org-Scope amendment). Length > 0 = pass, otherwise `BadRequestException` with code `KVP_NO_APPROVAL_MASTER`.

### Implementation

| Layer        | Change                                                                                                      | File                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Helper       | `KvpApprovalService.canRequesterFindApprovalMaster(userId)` — wraps `resolveApprovers()`                    | `backend/src/nest/kvp/kvp-approval.service.ts`        |
| Backend gate | `KvpService.createSuggestion()` — bypass for system users, else throw `KVP_NO_APPROVAL_MASTER` (BadRequest) | `backend/src/nest/kvp/kvp.service.ts`                 |
| API shape    | `GET /kvp/approval-config-status` returns `{ hasConfig, hasConfigForUser }` (was `{ hasConfig }` only)      | `backend/src/nest/kvp/kvp.controller.ts`              |
| Frontend     | "+ Neuer KVP" floating button is `disabled` with tooltip when `hasConfigForUser=false`                      | `frontend/src/routes/(app)/(shared)/kvp/+page.svelte` |

### Reverses

The `Config Gate (D6)` 2026-03-29 amendment ("skip approval creation, but allow submission") and the Masterplan §3.4 v0.5.0 "Backward compatible — old behavior preserved when no config exists" decision. Both are explicitly superseded for KVP. The pattern is now: **no config in scope → no submission**. Other addon integrations (e.g. TPM) continue to use the soft-gate pattern; this is a per-addon policy, not a global change.

### Risiko-Tabelle Update

| Risiko                             | Vorher                                                      | Mitigation neu                                                                                               |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Kein Master konfiguriert           | "UI zeigt Warnung wenn Config leer; Backend blockt Anfrage" | Hard-Gate auf Submission-Ebene; UI disabled-Button mit Tooltip; bypass nur für root + admin-with-full-access |
| Orphan KVPs in Tenants ohne Config | Bridge skippte Approval, Submission ging durch              | Submission selbst blockiert — keine Orphans mehr möglich                                                     |

### Migration

Hartes Inkrafttreten ab Deploy. Bestehende KVP-Test-Daten wurden mit `TRUNCATE TABLE kvp_suggestions CASCADE` + `DELETE FROM approvals WHERE addon_code='kvp'` + `DELETE FROM notifications WHERE type='kvp'` entfernt (nur Test-Daten — Solo-Produkt vor erstem Production-Deploy). Für zukünftige Tenants gilt: Approval-Master für KVP einrichten, **bevor** das Addon freigeschaltet wird, sonst können Mitarbeiter keine Vorschläge einreichen.

### Verification

```bash
# Helper unit tests:
pnpm exec vitest run --project unit backend/src/nest/kvp/kvp-approval.service.test.ts
# → 17 tests pass, including 2 new for canRequesterFindApprovalMaster

# Endpoint shape:
curl -s http://localhost:3000/api/v2/kvp/approval-config-status -H "Authorization: Bearer $TOKEN" | jq
# → { "data": { "hasConfig": true, "hasConfigForUser": true } }
```

### TPM-specific Patterns

- **Informational Only (D1):** Approval status is documentary (ISO 9001). Plans remain fully operational regardless of pending/rejected status.
- **Version Coupling (D2):** Two new columns (`approval_version`, `revision_minor`) create a major.minor scheme where major = approval count, minor = draft edits since last approval. `revision_number` (total edit count) is unchanged.
- **No Supersede (D3):** Edits with an existing pending approval only bump `revision_minor`. The master reviews the latest plan state when deciding.
- **Asset Name Resolution:** `RETURNING *` after UPDATE doesn't include JOIN columns. The bridge service resolves the asset name via DB lookup when it's missing.

---

## References

- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md) — Org-Hierarchie, Lead-Positionen, Zugangs-Matrix
- [ADR-019: Multi-Tenant RLS Data Isolation](./ADR-019-multi-tenant-rls-isolation.md) — RLS Pattern für beide Tabellen
- [ADR-020: Per-User Feature Permission Control](./ADR-020-per-user-feature-permissions.md) — Permission-Module für Approvals
- [ADR-028: Work Orders Architecture](./ADR-028-work-orders-architecture.md) — Polymorphe Source-Referenz Pattern, Abgrenzung
- [ADR-033: Addon-basiertes SaaS-Modell](./ADR-033-addon-based-saas-model.md) — Core-Addon Definition
- [ADR-035: Organizational Hierarchy & Assignment Architecture](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — Lead-Positionen für dynamische Approver-Auflösung
- [ADR-038: Position Catalog Architecture](./ADR-038-position-catalog-architecture.md) — Position-basierte Approval Masters
- [FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md](../../FEAT_KVP_APPROVAL_INTEGRATION_MASTERPLAN.md) — KVP Approval Bridge implementation details
- [FEAT_TPM_PLAN_APPROVAL_MASTERPLAN.md](../../FEAT_TPM_PLAN_APPROVAL_MASTERPLAN.md) — TPM Plan Approval Bridge implementation details
