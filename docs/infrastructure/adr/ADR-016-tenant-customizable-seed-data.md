# ADR-016: Tenant-Customizable Seed Data (Overlay-Pattern)

| Metadata                | Value                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                   |
| **Date**                | 2026-02-02                                                                                                 |
| **Decision Makers**     | SCS Technik                                                                                                |
| **Affected Components** | `database/migrations/`, `backend/src/nest/kvp/`, `frontend/src/routes/(app)/(admin)/`, `navigation-config` |

---

## Context

### Ausgangslage

Assixx nutzt globale Lookup-Tabellen für vordefinierte Kategorien (Seeds):

- `kvp_categories` - 6 Default-Kategorien (Sicherheit, Effizienz, Qualität, ...)
- `machine_categories` - 11 Default-Kategorien (zukünftig)
- Weitere globale Lookups (Features, Status-Enums, etc.)

Diese Tabellen haben **kein `tenant_id`** und **kein RLS** - alle Tenants teilen dieselben Daten.

### Problem: Starre Vorgaben

Industriekunden haben unterschiedliche Fachbegriffe und Organisationsstrukturen:

| Tenant         | Seed-Name "Sicherheit" | Eigene Kategorien              |
| -------------- | ---------------------- | ------------------------------ |
| Maschinenbau A | "Arbeitssicherheit"    | "Digitalisierung", "Logistik"  |
| Chemie B       | "HSE"                  | "Gefahrstoffe", "Umweltschutz" |
| Logistik C     | (Default beibehalten)  | "Fuhrpark", "Lageroptimierung" |

**Anforderungen:**

1. **Umbenennung** - Seed-Namen pro Tenant anpassen (z.B. "Sicherheit" → "Arbeitssicherheit")
2. **Eigene Einträge** - Tenant-spezifische Kategorien hinzufügen
3. **Limit** - Max Gesamtanzahl im Dropdown (Usability)
4. **Globale Seeds unverändert** - Kein Tenant darf die Original-Seeds für andere Tenants verändern
5. **Wiederverwendbar** - Pattern muss für jede globale Lookup-Tabelle anwendbar sein

### Sicherheitsanforderung

Nicht jeder Admin soll Kategorien verwalten dürfen. Nur:

- **Root** - Immer Zugriff
- **Admin mit `has_full_access = true`** - Vollzugriff-Admins

Reguläre Admins (ohne `has_full_access`) und Employees sind ausgeschlossen.

---

## Decision Drivers

1. **Zero Breaking Changes** - Globale Seed-Tabellen dürfen NICHT verändert werden
2. **Multi-Tenant-Isolation** - Tenant A sieht nie die Anpassungen von Tenant B
3. **KISS** - Minimale Komplexität, kein eigenes Microservice-Pattern
4. **Wiederverwendbar** - Selbes Pattern für `kvp_categories`, `machine_categories`, etc.
5. **COALESCE-Merge** - Bestehende Queries müssen mit minimaler Änderung funktionieren
6. **Permission-Granularität** - `has_full_access` als Schutz gegen unberechtigte Änderungen

---

## Options Considered

### Option A: Seed-Tabelle direkt editierbar machen (tenant_id hinzufügen)

**Pros:**

- Einfachste Implementierung
- Kein zusätzlicher JOIN

**Cons:**

- **Breaking Change** - Alle bestehenden Queries müssen angepasst werden
- **Datenverlust-Risiko** - Tenant kann versehentlich globale Seeds löschen
- **RLS-Umbau** - Globale Tabelle müsste tenant-aware werden
- **Seed-Updates unmöglich** - Wenn wir einen neuen Default hinzufügen, kollidiert er mit Tenant-Daten
- **Migration-Albtraum** - Bestehende Foreign Keys zeigen auf `kvp_categories.id`

**Verdict:** REJECTED - Fundamentaler Architekturbruch, zu riskant

### Option B: Tenant-Kopie bei Onboarding (Copy-on-Create)

**Pros:**

- Jeder Tenant hat eigene vollständige Tabelle
- Volle Kontrolle pro Tenant

**Cons:**

- **Dateninkonsistenz** - Wenn wir einen neuen Default hinzufügen, fehlt er bei bestehenden Tenants
- **Speicher-Overhead** - 6 Rows × N Tenants statt 6 Rows global
- **Sync-Problem** - Wie propagiert man neue Defaults an bestehende Tenants?
- **Migration-Komplexität** - Onboarding-Prozess muss Seeds kopieren

**Verdict:** REJECTED - Synchronisationsproblem bei neuen Defaults

### Option C: JSON-Feld pro Tenant (Settings-Tabelle)

**Pros:**

- Flexibel, kein neues Schema
- Ein Query pro Tenant

**Cons:**

- **Kein SQL-JOIN** - Kategorie-Name nicht direkt in Suggestion-Queries verfügbar
- **Keine referentielle Integrität** - JSON hat keine Foreign Keys
- **Keine Indizes** - Suche nach Kategorie-Name nicht performant
- **Schema-Drift** - JSON-Struktur kann zwischen Tenants divergieren

**Verdict:** REJECTED - Verlust von SQL-Vorteilen (JOINs, FKs, Indizes)

### Option D: Overlay-Pattern mit separater Custom-Tabelle (EMPFOHLEN)

**Pros:**

- **Zero Breaking Changes** - Globale Seed-Tabelle wird NICHT verändert
- **COALESCE-Merge** - `COALESCE(custom_name, default_name)` in einem Query
- **Zwei Modi in einer Tabelle** - Override (umbenennen) ODER neue Einträge
- **Tenant-isoliert** - RLS auf Custom-Tabelle, globale Seeds bleiben öffentlich
- **Neue Defaults propagieren automatisch** - Neuer Seed in `kvp_categories` erscheint sofort bei allen Tenants
- **Sauber löschbar** - DELETE Custom-Eintrag = Reset auf Default
- **Wiederverwendbar** - Selbes Schema-Muster für jede Lookup-Tabelle

**Cons:**

- Zusätzlicher LEFT JOIN in jeder Category-Query
- Neue Tabelle pro Lookup (aber minimal: ~5 Spalten)
- Application-Level Limit-Check nötig (kein DB-Constraint für "max 20 total")

**Verdict:** ACCEPTED - Bester Kompromiss aus Einfachheit, Sicherheit und Wiederverwendbarkeit

---

## Decision

**Overlay-Pattern: Separate `_custom` Tabelle pro globaler Lookup-Tabelle.**

### Architektur-Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OVERLAY-PATTERN BLUEPRINT                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   GLOBAL (Read-Only, kein tenant_id, kein RLS)                      │
│   ┌──────────────────────────────────┐                              │
│   │  kvp_categories                  │                              │
│   │  id | name         | color | icon│                              │
│   │  1  | Sicherheit   | #e74  | ... │  ← Seeds, nie verändert     │
│   │  2  | Effizienz    | #2ec  | ... │                              │
│   │  ...                             │                              │
│   └──────────────┬───────────────────┘                              │
│                  │                                                   │
│   OVERLAY (Per-Tenant, RLS enabled)                                 │
│   ┌──────────────┴───────────────────┐                              │
│   │  kvp_categories_custom           │                              │
│   │                                  │                              │
│   │  Modus 1 - Override:             │                              │
│   │  tenant=3, category_id=1         │                              │
│   │  custom_name="Arbeitssicherheit" │  ← Umbenennung              │
│   │                                  │                              │
│   │  Modus 2 - Neue Kategorie:      │                              │
│   │  tenant=3, category_id=NULL      │                              │
│   │  custom_name="Digitalisierung"   │  ← Eigener Eintrag          │
│   │  color="#8e44ad", icon="laptop"  │                              │
│   └──────────────────────────────────┘                              │
│                                                                     │
│   MERGE (UNION ALL + COALESCE)                                      │
│   ┌──────────────────────────────────┐                              │
│   │  Dropdown für Tenant 3:          │                              │
│   │  Arbeitssicherheit (Override)    │                              │
│   │  Digitalisierung   (Custom)      │                              │
│   │  Effizienz         (Default)     │                              │
│   │  Ergonomie         (Default)     │                              │
│   │  ...                             │                              │
│   └──────────────────────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Custom-Tabelle Schema (Blueprint)

Für jede globale Lookup-Tabelle `<entity>_categories` wird eine `<entity>_categories_custom` Tabelle erstellt:

```sql
CREATE TABLE IF NOT EXISTS <entity>_categories_custom (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES <entity>_categories(id) ON DELETE CASCADE,
    custom_name VARCHAR(50) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Override: max 1 pro (tenant, global_category) Kombination
    CONSTRAINT uq_override UNIQUE (tenant_id, category_id),

    -- Neue Kategorie: Pflichtfelder wenn kein Override
    CONSTRAINT chk_custom_has_visuals CHECK (
        category_id IS NOT NULL
        OR (color IS NOT NULL AND icon IS NOT NULL)
    )
);

-- RLS (PFLICHT)
ALTER TABLE <entity>_categories_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE <entity>_categories_custom FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <entity>_categories_custom
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON <entity>_categories_custom TO app_user;
GRANT USAGE, SELECT ON SEQUENCE <entity>_categories_custom_id_seq TO app_user;
```

### Merge-Query (Blueprint)

```sql
-- Dropdown-Daten für einen Tenant
SELECT kc.id, 'global' AS source,
       COALESCE(kcc.custom_name, kc.name) AS name,
       kc.description, kc.color, kc.icon
FROM <entity>_categories kc
LEFT JOIN <entity>_categories_custom kcc
  ON kcc.category_id = kc.id AND kcc.tenant_id = $1

UNION ALL

SELECT kcc.id, 'custom' AS source,
       kcc.custom_name AS name,
       kcc.description, kcc.color, kcc.icon
FROM <entity>_categories_custom kcc
WHERE kcc.tenant_id = $1 AND kcc.category_id IS NULL

ORDER BY name ASC
```

### API-Endpoints (Blueprint pro Feature)

| Method   | Route                                       | Beschreibung                 | Rolle                        |
| -------- | ------------------------------------------- | ---------------------------- | ---------------------------- |
| `GET`    | `/<entity>/categories/customizable`         | Admin-View (defaults+custom) | root, admin(has_full_access) |
| `PUT`    | `/<entity>/categories/override/:categoryId` | Upsert Name-Override         | root, admin(has_full_access) |
| `DELETE` | `/<entity>/categories/override/:categoryId` | Reset auf Default-Name       | root, admin(has_full_access) |
| `POST`   | `/<entity>/categories/custom`               | Neue Tenant-Kategorie        | root, admin(has_full_access) |
| `DELETE` | `/<entity>/categories/custom/:id`           | Tenant-Kategorie löschen     | root, admin(has_full_access) |

### Permission-Layer (3 Schichten)

```
Schicht 1 - Backend Guard:
  @UseGuards(RolesGuard) + @Roles('admin', 'root')
  → Blockiert Employees

Schicht 2 - Backend Service:
  assertHasFullAccess(userId, userRole, tenantId)
  → Root: sofort OK
  → Admin: SELECT has_full_access FROM users WHERE id=$1 AND tenant_id=$2
  → Sonst: ForbiddenException

Schicht 3 - Frontend (Defense-in-Depth):
  a) +page.server.ts: parent().user.hasFullAccess Check → redirect
  b) Navigation: filterMenuByAccess() entfernt Link für Admins ohne Vollzugriff
```

### Frontend-Page Blueprint

```
(admin)/<entity>-categories/
├── +page.svelte          # UI (Override-Tabelle + Custom-Tabelle + Modals)
├── +page.server.ts       # SSR Load + has_full_access Guard
└── _lib/
    ├── api.ts            # API Client (5 Funktionen)
    ├── types.ts          # TypeScript Interfaces
    └── constants.ts      # Labels, Messages, Icon-Optionen
```

### Design-Constraints

| Constraint          | Wert                        | Begründung                                            |
| ------------------- | --------------------------- | ----------------------------------------------------- |
| `custom_name`       | VARCHAR(50)                 | Deutsche Fachbegriffe bis 50 Zeichen                  |
| Max pro Tenant      | Konfigurierbar (default 20) | Application-Level Check, nicht DB-Constraint          |
| Soft-Delete         | NEIN                        | DELETE = Reset/Entfernung, kein `is_active` nötig     |
| Leeres Input + Save | = DELETE                    | Override-Row wird gelöscht, Default-Name erscheint    |
| `source`-Feld       | In Query                    | Dropdown muss wissen ob global/custom für FK-Referenz |

---

## Consequences

### Positive

- **Zero Breaking Changes** - Globale Seed-Tabellen bleiben unverändert
- **Neue Defaults propagieren automatisch** - Neuer Seed erscheint sofort bei allen Tenants
- **Wiederverwendbar** - Copy-Paste Blueprint für jede Lookup-Tabelle
- **Sauber trennbar** - Override (Umbenennung) vs. Custom (neuer Eintrag) in einer Tabelle
- **Idempotent Reset** - DELETE Custom-Row = Default-Name kommt zurück
- **3-Schichten-Permission** - Backend Guard + Service-Level DB-Check + Frontend Guard
- **Minimal-invasiv** - Bestehende Queries brauchen nur einen zusätzlichen LEFT JOIN + COALESCE

### Negative

- **Zusätzlicher JOIN** - Jede Category-Query braucht LEFT JOIN auf `_custom` Tabelle
- **Application-Level Limit** - Max-Kategorien-Check nicht als DB-Constraint möglich (Cross-Table Count)
- **Neue Tabelle pro Feature** - Jede Lookup-Tabelle bekommt eine `_custom` Tabelle
- **has_full_access Abfrage** - Extra DB-Query pro Request für Admin-Permission (kein JWT-Claim)

### Neutral

- Seeds bleiben in `database/seeds/` (unverändert)
- Custom-Daten sind bei Fresh-Install leer (kein neuer Seed nötig)
- Bestehende Foreign Keys auf `kvp_categories.id` bleiben intakt

---

## First Implementation: KVP Categories

| Datei                                                      | Rolle                                          |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `database/migrations/*_kvp-categories-custom.ts`           | Custom-Tabelle Schema                          |
| `database/migrations/*_kvp-suggestions-custom-category.ts` | FK-Spalte in Suggestions                       |
| `backend/.../kvp-categories.service.ts`                    | 5 Service-Methoden + `assertHasFullAccess`     |
| `backend/.../kvp.controller.ts`                            | 5 Endpoints mit `@CurrentUser` + `@Roles`      |
| `backend/.../kvp.service.ts`                               | `getCategories()` UNION ALL Query              |
| `frontend/.../(admin)/kvp-categories/`                     | Admin-Page (Override-Tabelle + Custom-Tabelle) |
| `frontend/.../_lib/navigation-config.ts`                   | `filterMenuByAccess()` + Menüpunkt             |

## Zukünftige Anwendungen

| Lookup-Tabelle       | Seeds | Custom-Tabelle               | Status    |
| -------------------- | ----- | ---------------------------- | --------- |
| `kvp_categories`     | 6     | `kvp_categories_custom`      | Fertig    |
| `machine_categories` | 11    | `machine_categories_custom`  | Geplant   |
| Weitere              | n     | `<entity>_categories_custom` | Blueprint |

---

## References

- [KVP-CATEGORIES-CUSTOM-PLAN.md](../../plans/KVP-CATEGORIES-CUSTOM-PLAN.md) - Detaillierter Implementierungsplan (erste Anwendung)
- [ADR-006: Multi-Tenant Context Isolation](./ADR-006-multi-tenant-context-isolation.md) - RLS Policy Pattern
- [ADR-009: User Role Assignment & Permissions](./ADR-009-user-role-assignment-permissions.md) - `has_full_access` Permission Model
- [ADR-012: Frontend Route Security Groups](./ADR-012-frontend-route-security-groups.md) - `(admin)` Route Group + Fail-Closed RBAC
- [ADR-014: Database & Migration Architecture](./ADR-014-database-migration-architecture.md) - Migration-Tooling (`node-pg-migrate`)

## Related ADRs

- **ADR-006** - RLS Policy Pattern (NULLIF) für `_custom` Tabellen
- **ADR-009** - `has_full_access` Flag als Permission-Gate
- **ADR-012** - `(admin)` Route Group für Frontend-Schutz
- **ADR-014** - Migration-Tooling für neue `_custom` Tabellen

---

_Last Updated: 2026-02-02 (v1 - Initial Decision)_
