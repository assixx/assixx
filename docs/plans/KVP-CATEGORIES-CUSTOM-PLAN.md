# Plan: KVP-Kategorien Custom pro Tenant

> **Status:** Proposed (v2 - Revised)
> **Datum:** 2026-02-01 (Updated: 2026-02-02)
> **Scope:** Database, Backend (NestJS), Frontend (SvelteKit), Customer Sync
> **Prinzip:** KISS, Overlay-Pattern, Max 20 Kategorien pro Tenant

---

## Problemstellung

Vor Plan-Ausführung: `DATABASE-MIGRATION-GUIDE.md` nochmal lesen!

`kvp_categories` ist eine globale Tabelle (6 Rows, kein `tenant_id`, kein RLS). Alle Tenants
teilen dieselben Kategorien. Tenants brauchen:

1. **Umbenennung** - Kategorienamen für ihren Betrieb anpassen (z.B. "Sicherheit" -> "Arbeitssicherheit")
2. **Eigene Kategorien** - Tenant-spezifische Kategorien hinzufügen (z.B. "Digitalisierung", "Logistik")
3. **Max 20 im Dropdown** - Insgesamt maximal 20 Kategorien pro Tenant (6 Defaults + max 14 Custom)

---

## Architektur-Entscheidung: Erweitertes Overlay-Pattern

### Zwei Modi in einer Tabelle

```
kvp_categories (Global, Read-Only, 6 Defaults)
    id | name         | description | color   | icon
    1  | Sicherheit   | ...         | #e74c3c | shield
    2  | Effizienz    | ...         | #2ecc71 | lightning
    ...

kvp_categories_custom (Per-Tenant: Override ODER Neue Kategorie)

  Modus 1 - Override (category_id IS NOT NULL):
    id | tenant_id | category_id | custom_name       | color | icon | description
    1  | 3         | 1           | Arbeitssicherheit | NULL  | NULL | NULL

  Modus 2 - Neue Kategorie (category_id IS NULL):
    id | tenant_id | category_id | custom_name       | color   | icon | description
    2  | 3         | NULL        | Digitalisierung   | #8e44ad | ...  | Digitale Verbesserungen
```

### Merge-Logik (UNION ALL)

```sql
-- Teil 1: Globale Defaults (mit optionalem Name-Override)
SELECT
  kc.id,
  'global' AS source,
  COALESCE(kcc.custom_name, kc.name) AS name,
  kc.description,
  kc.color,
  kc.icon
FROM kvp_categories kc
LEFT JOIN kvp_categories_custom kcc
  ON kcc.category_id = kc.id
  AND kcc.tenant_id = $1

UNION ALL

-- Teil 2: Tenant-eigene Kategorien (category_id IS NULL)
SELECT
  kcc.id,
  'custom' AS source,
  kcc.custom_name AS name,
  kcc.description,
  kcc.color,
  kcc.icon
FROM kvp_categories_custom kcc
WHERE kcc.tenant_id = $1
  AND kcc.category_id IS NULL

ORDER BY name ASC
```

**Warum `source`-Feld?** Das Dropdown muss wissen, ob ein Eintrag global oder custom ist,
damit `kvp_suggestions` die richtige Referenz speichert (siehe Schritt 2).

### Design-Constraints

| Constraint          | Wert                | Begründung                                                                                                                           |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `custom_name`       | VARCHAR(50)         | Deutsche Fachbegriffe sind lang ("Prozessoptimierung" = 19, "Werkzeugverbesserung" = 20). 50 gibt echten Spielraum ohne UI-Probleme. |
| Max Rows pro Tenant | 20                  | 6 Overrides + 14 neue Kategorien = max 20 im Dropdown. Application-Level Check.                                                      |
| `is_active`         | **NICHT vorhanden** | DELETE = Reset/Entfernung. Kein Soft-Delete für Lookups nötig.                                                                       |
| Leeres Input-Feld   | = DELETE (Reset)    | Admin löscht Custom-Name und speichert → Override-Row wird gelöscht → Default-Name erscheint wieder.                                 |

### Vorteile

- `kvp_categories` wird NICHT verändert → Zero Breaking Changes für Defaults
- Bestehende KVP-Seiten zeigen automatisch Custom-Namen (nur Query-Änderung in getCategories)
- Kein Custom-Eintrag = Default-Name (COALESCE Fallback)
- Sauber löschbar: DELETE Custom-Eintrag = Reset auf Default
- Eigene Kategorien erweiterbar bis max 20 pro Tenant
- Wiederverwendbar für `machine_categories` (selbes Muster)

---

## Schritte

### Schritt 1: Database Migration - kvp_categories_custom

**Datei:** `database/migrations/XXXXXXXX_kvp-categories-custom.ts`

**Erstellen via:**

```bash
doppler run -- pnpm run db:migrate:create kvp-categories-custom
```

**Migration (up):**

```sql
-- Neue Tabelle: Tenant-spezifische Kategorie-Overrides + eigene Kategorien
CREATE TABLE IF NOT EXISTS kvp_categories_custom (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES kvp_categories(id) ON DELETE CASCADE,  -- NULL = neue Kategorie
    custom_name VARCHAR(50) NOT NULL,
    description TEXT,               -- nur für neue Kategorien (category_id IS NULL)
    color VARCHAR(20),              -- nur für neue Kategorien (category_id IS NULL)
    icon VARCHAR(50),               -- nur für neue Kategorien (category_id IS NULL)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Override: max 1 pro (tenant, global_category) Kombination
    CONSTRAINT uq_override UNIQUE (tenant_id, category_id),

    -- Neue Kategorie: Pflichtfelder wenn kein Override
    CONSTRAINT chk_custom_has_visuals CHECK (
        category_id IS NOT NULL  -- Override: color/icon kommen aus kvp_categories
        OR (color IS NOT NULL AND icon IS NOT NULL)  -- Neue Kat: braucht eigene Visuals
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kvp_categories_custom_tenant
  ON kvp_categories_custom(tenant_id);

CREATE INDEX IF NOT EXISTS idx_kvp_categories_custom_category
  ON kvp_categories_custom(category_id);

-- RLS (PFLICHT für tenant-isolated tables)
ALTER TABLE kvp_categories_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE kvp_categories_custom FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON kvp_categories_custom
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- GRANTs für app_user (PFLICHT)
GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_categories_custom TO app_user;
GRANT USAGE, SELECT ON SEQUENCE kvp_categories_custom_id_seq TO app_user;
```

**Migration (down):**

```sql
ALTER TABLE kvp_suggestions DROP COLUMN IF EXISTS custom_category_id;
DROP TABLE IF EXISTS kvp_categories_custom CASCADE;
```

---

### Schritt 2: Database Migration - kvp_suggestions erweitern

**WICHTIG:** Eigene Migration-Datei, NACH Schritt 1!

**Datei:** `database/migrations/XXXXXXXX_kvp-suggestions-custom-category.ts`

```bash
doppler run -- pnpm run db:migrate:create kvp-suggestions-custom-category
```

**Warum?** `kvp_suggestions.category_id` referenziert aktuell `kvp_categories.id` (ohne FK-Constraint,
nur Index). Für tenant-eigene Kategorien brauchen wir eine zweite Referenz-Spalte.

**Migration (up):**

```sql
-- Neue Spalte: Referenz auf tenant-eigene Kategorien
ALTER TABLE kvp_suggestions
  ADD COLUMN custom_category_id INTEGER;

-- Index für Lookups
CREATE INDEX IF NOT EXISTS idx_kvp_suggestions_custom_category
  ON kvp_suggestions(custom_category_id)
  WHERE custom_category_id IS NOT NULL;

-- KEIN FK-Constraint (konsistent mit bestehendem category_id, das auch keinen FK hat)
-- Referentielle Integrität wird application-seitig sichergestellt
```

**Migration (down):**

```sql
DROP INDEX IF EXISTS idx_kvp_suggestions_custom_category;
ALTER TABLE kvp_suggestions DROP COLUMN IF EXISTS custom_category_id;
```

**Semantik:**

| category_id | custom_category_id | Bedeutung                                                           |
| ----------- | ------------------ | ------------------------------------------------------------------- |
| `5`         | `NULL`             | Globale Kategorie (kvp_categories.id = 5)                           |
| `NULL`      | `12`               | Tenant-eigene Kategorie (kvp_categories_custom.id = 12)             |
| `NULL`      | `NULL`             | Legacy-Row ohne Kategorie (erlaubt, category_id war schon nullable) |

**Checkliste Migrationen (beide):**

- [ ] Backup erstellen (`pg_dump --format=custom --compress=9`)
- [ ] Dry-Run (`./scripts/run-migrations.sh up --dry-run`)
- [ ] Migrationen ausführen
- [ ] RLS Policy verifizieren (`pg_policies`)
- [ ] GRANTs verifizieren
- [ ] Neue Spalte in kvp_suggestions verifizieren
- [ ] Backend neustarten
- [ ] Customer Fresh-Install synchronisieren

---

### Schritt 3: Backend - getCategories() für Dropdown anpassen

**Datei:** `backend/src/nest/kvp/kvp.service.ts` (Zeile ~125-136)

**Vorher:**

```typescript
async getCategories(_tenantId: number): Promise<Category[]> {
  return this.db.query('SELECT * FROM kvp_categories ORDER BY name ASC');
}
```

**Nachher:**

```typescript
async getCategories(tenantId: number): Promise<CategoryOption[]> {
  return this.db.query(`
    SELECT
      kc.id,
      'global' AS source,
      COALESCE(kcc.custom_name, kc.name) AS name,
      kc.description,
      kc.color,
      kc.icon
    FROM kvp_categories kc
    LEFT JOIN kvp_categories_custom kcc
      ON kcc.category_id = kc.id
      AND kcc.tenant_id = $1

    UNION ALL

    SELECT
      kcc.id,
      'custom' AS source,
      kcc.custom_name AS name,
      kcc.description,
      kcc.color,
      kcc.icon
    FROM kvp_categories_custom kcc
    WHERE kcc.tenant_id = $1
      AND kcc.category_id IS NULL

    ORDER BY name ASC
  `, [tenantId]);
}
```

**Impact auf bestehendes Dropdown:**

Das Response-Format bekommt ein neues Feld `source`. Die bestehenden Felder
`id, name, color, icon` bleiben identisch. Das Frontend braucht eine Anpassung
im Dropdown-Value (Schritt 7), damit `source` mitgeschickt wird.

```
Dropdown vorher:  Sicherheit | Effizienz | Qualität | ...  (6 Einträge)
Dropdown nachher: Arbeitssicherheit | Digitalisierung | Effizienz | ...  (bis 20 Einträge)
```

**Betroffene Suggestion-Queries:**

Alle Queries die `kvp_suggestions` mit Kategorie-Name anzeigen müssen aktualisiert
werden (getSuggestions, getSuggestionById, etc.). Sie brauchen einen zusätzlichen
LEFT JOIN auf `kvp_categories_custom` für `custom_category_id`:

```sql
-- In jeder Suggestion-Query:
LEFT JOIN kvp_categories kc ON ks.category_id = kc.id
LEFT JOIN kvp_categories_custom kcc_override
  ON kc.id = kcc_override.category_id AND kcc_override.tenant_id = ks.tenant_id
LEFT JOIN kvp_categories_custom kcc_new
  ON ks.custom_category_id = kcc_new.id

-- Category-Name Auflösung:
COALESCE(
  kcc_new.custom_name,         -- Tenant-eigene Kategorie
  kcc_override.custom_name,    -- Umbenannter Default
  kc.name                      -- Original Default
) AS category_name
```

---

### Schritt 4: Backend - Neuer Service + API Endpoints

**Warum separater Service?**

`kvp.service.ts` ist bei 892 Zeilen (ESLint max-lines = 800). Etabliertes
Extraction-Pattern: `kvp-attachments.service.ts`, `kvp-comments.service.ts`,
`kvp-confirmations.service.ts`. Wir folgen diesem Muster.

**Dateien:**

- `backend/src/nest/kvp/kvp-categories.service.ts` - **NEU**: 5 Methoden (~120 Zeilen)
- `backend/src/nest/kvp/kvp.controller.ts` - **EDIT**: 5 neue Endpoints
- `backend/src/nest/kvp/dto/custom-category.dto.ts` - **NEU**: Zod DTOs
- `backend/src/nest/kvp/kvp.module.ts` - **EDIT**: neuen Service registrieren

**Endpoints:**

| Method   | Route                                  | Beschreibung                              | Rolle                        |
| -------- | -------------------------------------- | ----------------------------------------- | ---------------------------- |
| `GET`    | `/kvp/categories/customizable`         | Defaults + Custom merged (Admin-View)     | root, admin(has_full_access) |
| `PUT`    | `/kvp/categories/override/:categoryId` | Upsert Name-Override für Global-Kategorie | root, admin(has_full_access) |
| `DELETE` | `/kvp/categories/override/:categoryId` | Reset Override auf Default-Name           | root, admin(has_full_access) |
| `POST`   | `/kvp/categories/custom`               | Neue Tenant-Kategorie erstellen           | root, admin(has_full_access) |
| `DELETE` | `/kvp/categories/custom/:id`           | Tenant-Kategorie löschen                  | root, admin(has_full_access) |

**GET /kvp/categories/customizable Response:**

```json
{
  "success": true,
  "data": {
    "defaults": [
      {
        "id": 1,
        "defaultName": "Sicherheit",
        "customName": "Arbeitssicherheit",
        "description": "Verbesserungen zur Arbeitssicherheit",
        "color": "#e74c3c",
        "icon": "shield",
        "isCustomized": true
      },
      {
        "id": 2,
        "defaultName": "Effizienz",
        "customName": null,
        "description": "Prozessoptimierungen...",
        "color": "#2ecc71",
        "icon": "lightning",
        "isCustomized": false
      }
    ],
    "custom": [
      {
        "id": 7,
        "name": "Digitalisierung",
        "description": "Digitale Verbesserungen",
        "color": "#8e44ad",
        "icon": "laptop"
      }
    ],
    "totalCount": 8,
    "maxAllowed": 20,
    "remainingSlots": 12
  }
}
```

**PUT /kvp/categories/override/:categoryId (Zod):**

```typescript
const OverrideCategoryNameSchema = z.object({
  customName: z.string().min(1).max(50).trim(),
});
```

**SQL (Upsert Override):**

```sql
INSERT INTO kvp_categories_custom (tenant_id, category_id, custom_name)
VALUES ($1, $2, $3)
ON CONFLICT ON CONSTRAINT uq_override
DO UPDATE SET custom_name = $3, updated_at = NOW()
RETURNING id
```

**POST /kvp/categories/custom (Zod):**

```typescript
const CreateCustomCategorySchema = z.object({
  name: z.string().min(1).max(50).trim(),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  icon: z.string().min(1).max(50),
});
```

**SQL (Insert Custom):**

```sql
-- Limit-Check VORHER:
SELECT COUNT(*) AS cnt FROM kvp_categories_custom WHERE tenant_id = $1;
-- Wenn cnt >= 20: ForbiddenException('Maximum 20 categories reached')

INSERT INTO kvp_categories_custom (tenant_id, category_id, custom_name, description, color, icon)
VALUES ($1, NULL, $2, $3, $4, $5)
RETURNING id
```

**DELETE /kvp/categories/override/:categoryId SQL:**

```sql
DELETE FROM kvp_categories_custom
WHERE category_id = $1 AND tenant_id = $2
```

**DELETE /kvp/categories/custom/:id SQL:**

```sql
-- Prüfung: Wird die Kategorie von Suggestions referenziert?
SELECT COUNT(*) FROM kvp_suggestions WHERE custom_category_id = $1;
-- Wenn > 0: ConflictException('Category is referenced by existing suggestions')

DELETE FROM kvp_categories_custom
WHERE id = $1 AND tenant_id = $2 AND category_id IS NULL
```

**Batch-Save (Override-Tabelle):**

Der "Alle speichern" Button im Frontend ruft sequenziell PUT für jede
geänderte Zeile auf. Bei 6 Default-Kategorien ist das max 6 Requests.
Kein Batch-Endpoint nötig - KISS.

- Leeres Feld + vorher customized → DELETE (Reset auf Default)
- Gefülltes Feld + nicht customized → PUT (Neuer Override)
- Gefülltes Feld + customized + Text geändert → PUT (Update Override)
- Gefülltes Feld + customized + Text unverändert → Skip (kein Request)

---

### Schritt 5: Backend - createSuggestion DTO erweitern

**Datei:** `backend/src/nest/kvp/dto/create-suggestion.dto.ts`

**Änderung:** `categoryId` wird optional, `customCategoryId` wird hinzugefügt.

```typescript
export const CreateSuggestionSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    description: z.string().trim().min(10).max(5000),
    categoryId: IdSchema.optional().nullable(),
    customCategoryId: IdSchema.optional().nullable(),
    // ... restliche Felder bleiben
  })
  .refine((data) => (data.categoryId ?? null) !== null || (data.customCategoryId ?? null) !== null, {
    message: 'Either categoryId or customCategoryId must be provided',
    path: ['categoryId'],
  });
```

**Datei:** `backend/src/nest/kvp/kvp.service.ts` - createSuggestion (Zeile ~303)

INSERT-Query erhält `custom_category_id` als zusätzlichen Parameter:

```sql
INSERT INTO kvp_suggestions
(uuid, tenant_id, title, description, category_id, custom_category_id, ...)
VALUES ($1, $2, $3, $4, $5, $6, ...)
```

---

### Schritt 6: Sidebar - Neuer Menüpunkt

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

Im `rootMenuItems` Array: immer sichtbar (unter "LEAN-Management" Submenu).
Im `adminMenuItems` Array: nur sichtbar wenn `has_full_access = true`.

```typescript
// rootMenuItems - immer sichtbar
{
  id: 'lean-management',
  icon: ICONS.lean,
  label: 'LEAN-Management',
  hasSubmenu: true,
  submenu: [
    { id: 'kvp', label: 'KVP System', url: '/kvp', badgeType: 'kvp' },
    { id: 'kvp-categories', label: 'Kategorien', url: '/kvp-categories' },
    { id: 'surveys', label: 'Umfragen', url: '/survey-admin' },
  ],
},
```

**Sichtbarkeit:** root + admin(has_full_access = true)

---

### Schritt 7: Frontend - KvpCreateModal + Filter Dropdown anpassen

**Datei:** `frontend/src/routes/(app)/(shared)/kvp/_lib/KvpCreateModal.svelte`

Das Dropdown muss `source` mitschicken, damit der Backend-Payload korrekt ist.

**Änderung am State:**

```typescript
// Vorher:
let formCategoryValue = $state('');  // nur ID

// Nachher:
let formCategoryValue = $state('');  // "global:3" oder "custom:7"
```

**Änderung an handleFormCategorySelect:**

```typescript
function handleFormCategorySelect(
  id: number,
  source: string, // 'global' | 'custom'
  label: string,
  icon?: string,
) {
  formCategoryValue = `${source}:${id}`;
  formCategoryDisplay = icon !== undefined ? `${icon} ${label}` : label;
  closeAllDropdowns();
}
```

**Änderung an buildFormPayload:**

```typescript
function buildFormPayload(...): KvpFormData {
  // Parse "global:3" oder "custom:7"
  const [source, idStr] = formCategoryValue.split(':');
  const id = parseInt(idStr, 10);

  return {
    // ...
    categoryId: source === 'global' ? id : null,
    customCategoryId: source === 'custom' ? id : null,
  };
}
```

**Änderung am Dropdown Template:**

```svelte
{#each kvpState.categories as category (category.source + ':' + category.id)}
  <div
    class="dropdown__option"
    onclick={() => handleFormCategorySelect(
      category.id,
      category.source,
      category.name,
      category.icon,
    )}
  >
    {category.icon ?? 'glühbirne'} {category.name}
  </div>
{/each}
```

**Frontend Types anpassen:**

```typescript
// types.ts
export interface KvpCategory {
  id: number;
  source: 'global' | 'custom'; // NEU
  name: string;
  icon?: string;
  color: string;
}
```

**Filter-Dropdown auf +page.svelte** braucht dieselbe Logik für `source`.

---

### Schritt 8: Frontend - Neue Admin Page

**Route:** `frontend/src/routes/(app)/(admin)/kvp-categories/`

**Route Group:** `(admin)` - ADR-012 konform

**Dateistruktur:**

```
(admin)/kvp-categories/
+-- +page.svelte            # UI
+-- +page.server.ts         # SSR Load + has_full_access Guard
+-- _lib/
    +-- api.ts              # API Calls
    +-- types.ts            # Interfaces
    +-- constants.ts        # Labels, Messages
```

**UI Design (Glassmorphism, Design System):**

```
+------------------------------------------------------------------+
|  Breadcrumb: Dashboard > LEAN-Management > Kategorien             |
+------------------------------------------------------------------+
|                                                                    |
|  KVP-Kategorien verwalten                                          |
|  Passen Sie die Bezeichnungen der KVP-Kategorien                   |
|  für Ihr Unternehmen an und erstellen Sie eigene.                  |
|                                                                    |
|  --- SEKTION 1: Standard-Kategorien umbenennen ---                 |
|                                                                    |
|  +---------------------------------------------------------------+ |
|  | data-table                                                    | |
|  |                                                               | |
|  |  #  | Standard         | Eigene Bezeichnung     | Aktion     | |
|  |  ---|------------------|------------------------|----------- | |
|  |  1  | Sicherheit       | [Arbeitssicherheit   ] | [Reset]    | |
|  |  2  | Effizienz        | [                    ] |            | |
|  |  3  | Qualität         | [                    ] |            | |
|  |  4  | Umwelt           | [                    ] |            | |
|  |  5  | Ergonomie        | [                    ] |            | |
|  |  6  | Kosteneinsparung | [                    ] |            | |
|  |                                                               | |
|  +---------------------------------------------------------------+ |
|  [Änderungen speichern]                                            |
|                                                                    |
|  --- SEKTION 2: Eigene Kategorien (8 von 14 verfügbar) ---        |
|                                                                    |
|  +---------------------------------------------------------------+ |
|  | data-table                                                    | |
|  |                                                               | |
|  |  Name             | Farbe   | Icon | Aktion                   | |
|  |  -----------------|---------|------|------------------------- | |
|  |  Digitalisierung  | #8e44ad | ...  | [Löschen]                | |
|  |  Logistik         | #e67e22 | ...  | [Löschen]                | |
|  |                                                               | |
|  +---------------------------------------------------------------+ |
|                                                                    |
|  [+ Neue Kategorie hinzufügen]                                     |
|                                                                    |
|  badge: 8 / 20 Kategorien verwendet                               |
|                                                                    |
+------------------------------------------------------------------+
```

**Verhalten Sektion 1 (Overrides):**

- "Standard" Spalte: Read-only, zeigt `defaultName` aus `kvp_categories`
- "Eigene Bezeichnung" Spalte: Inline `<input>` mit `form-field__control`
  - Placeholder zeigt den Default-Namen
  - Leer + Save = DELETE Override (Reset auf Default-Name)
  - Gefüllt + Save = PUT Override (Upsert)
- "Reset" Button: Nur sichtbar wenn `isCustomized === true`. Löscht Override sofort (DELETE API).
- "Änderungen speichern": Iteriert über alle 6 Zeilen, vergleicht mit Original-State.
  Nur geänderte Zeilen senden Requests (PUT oder DELETE). Max 6 sequenzielle Calls.
- Nach Save: `invalidateAll()` für SSR-Refresh

**Verhalten Sektion 2 (Eigene Kategorien):**

- "Neue Kategorie hinzufügen" Button: Öffnet Inline-Form oder Modal mit:
  - Name (max 50 Zeichen, required)
  - Farbe (Color-Picker, Hex, required)
  - Icon (Auswahl aus vordefinierten Icons, required)
  - Beschreibung (optional, max 500 Zeichen)
- "Löschen" Button: Zeigt Confirm-Dialog, prüft ob Suggestions existieren.
  Falls ja: Warnung "X Vorschläge verwenden diese Kategorie. Trotzdem löschen?"
- Badge zeigt `totalCount / 20` als Fortschrittsindikator
- Wenn 20 erreicht: "Neue Kategorie" Button deaktiviert + Hinweis

**Design System Komponenten:**

- `page-container` - Wrapper
- `data-table` - Tabellen
- `form-field__control` - Inline Inputs + Color-Picker
- `btn btn-primary` - Speichern / Hinzufügen
- `btn btn-cancel` - Reset
- `btn btn-danger` - Löschen
- `badge badge--success` - "Angepasst" Indikator
- `badge` - "X / 20" Counter

---

### Schritt 9: Bruno API Tests

**Dateien:**

```
api-tests/kvp-categories/
+-- 01-get-customizable.bru     # GET /kvp/categories/customizable (Admin)
+-- 02-override-name.bru        # PUT /kvp/categories/override/1
+-- 03-get-verify-override.bru  # GET /kvp/categories → prüft Custom-Name
+-- 04-create-custom.bru        # POST /kvp/categories/custom
+-- 05-create-suggestion.bru    # POST /kvp mit customCategoryId
+-- 06-delete-override.bru      # DELETE /kvp/categories/override/1
+-- 07-delete-custom.bru        # DELETE /kvp/categories/custom/:id
+-- 08-permission-employee.bru  # 403 für Employee
+-- 09-permission-limited.bru   # 403 für Admin ohne has_full_access
+-- 10-limit-check.bru          # 409 bei > 20 Kategorien
```

**Test-Reihenfolge:**

1. Login als apitest Admin (has_full_access = true)
2. GET customizable → 6 Defaults, 0 Custom
3. PUT Override → "Sicherheit" → "Arbeitssicherheit"
4. GET categories → verifiziert "Arbeitssicherheit" statt "Sicherheit"
5. POST Custom → "Digitalisierung" erstellen
6. POST Suggestion mit `customCategoryId` → verifiziert Speicherung
7. DELETE Override → zurück zu "Sicherheit"
8. DELETE Custom → "Digitalisierung" entfernt
9. Login als Employee → GET customizable → 403
10. Limit-Test → 20 Custom-Kategorien erstellen, 21. → 409

---

### Schritt 10: Customer Fresh-Install Sync

**Betroffene Dateien:**

- `customer/fresh-install/001_schema.sql` - Neue Tabelle + kvp_suggestions Spalte
- `customer/fresh-install/005_pgmigrations.sql` - Beide Migrationen registrieren

**Ausführen:**

```bash
./scripts/sync-customer-migrations.sh
```

Kein neuer Seed nötig - `kvp_categories_custom` ist bei Fresh-Install leer.

---

## Zusammenfassung: Betroffene Dateien

| #   | Datei                                                             | Änderung                                                                       |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | `database/migrations/XXXXXXXX_kvp-categories-custom.ts`           | **NEU** - Tabelle kvp_categories_custom                                        |
| 2   | `database/migrations/XXXXXXXX_kvp-suggestions-custom-category.ts` | **NEU** - custom_category_id Spalte                                            |
| 3   | `backend/src/nest/kvp/kvp.service.ts`                             | **EDIT** - getCategories() UNION-Query + createSuggestion() custom_category_id |
| 4   | `backend/src/nest/kvp/kvp-categories.service.ts`                  | **NEU** - 5 Methoden (~120 Zeilen)                                             |
| 5   | `backend/src/nest/kvp/kvp.controller.ts`                          | **EDIT** - 5 neue Endpoints                                                    |
| 6   | `backend/src/nest/kvp/kvp.module.ts`                              | **EDIT** - KvpCategoriesService registrieren                                   |
| 7   | `backend/src/nest/kvp/dto/custom-category.dto.ts`                 | **NEU** - Zod Schemas (Override + Custom)                                      |
| 8   | `backend/src/nest/kvp/dto/create-suggestion.dto.ts`               | **EDIT** - customCategoryId + refine                                           |
| 9   | `backend/src/nest/kvp/kvp.types.ts`                               | **EDIT** - CategoryOption Interface mit source                                 |
| 10  | `frontend/.../kvp/_lib/types.ts`                                  | **EDIT** - KvpCategory.source Feld                                             |
| 11  | `frontend/.../kvp/_lib/KvpCreateModal.svelte`                     | **EDIT** - Dropdown source-Logik                                               |
| 12  | `frontend/.../kvp/+page.svelte`                                   | **EDIT** - Filter-Dropdown source-Logik                                        |
| 13  | `frontend/.../kvp/_lib/api.ts`                                    | **EDIT** - createSuggestion Payload                                            |
| 14  | `frontend/.../_lib/navigation-config.ts`                          | **EDIT** - Menüpunkt                                                           |
| 15  | `frontend/.../(admin)/kvp-categories/+page.svelte`                | **NEU** - Admin Page                                                           |
| 16  | `frontend/.../(admin)/kvp-categories/+page.server.ts`             | **NEU** - SSR Load                                                             |
| 17  | `frontend/.../(admin)/kvp-categories/_lib/api.ts`                 | **NEU** - API Client                                                           |
| 18  | `frontend/.../(admin)/kvp-categories/_lib/types.ts`               | **NEU** - Interfaces                                                           |
| 19  | `frontend/.../(admin)/kvp-categories/_lib/constants.ts`           | **NEU** - Constants                                                            |
| 20  | `api-tests/kvp-categories/*.bru`                                  | **NEU** - 10 Bruno Tests                                                       |

**Was NICHT geändert wird:**

- `kvp_categories` Tabelle (bleibt unberührt, 6 Defaults)
- Seeds (Default-Daten bleiben global)
- Reports Service (LEFT JOINs funktionieren weiterhin, brauchen aber COALESCE-Update)

---

## Erweiterbarkeit (Zukunft)

Dieses erweiterte Overlay-Pattern ist wiederverwendbar für:

- `machine_categories` (11 Default-Kategorien, selbes Muster)
- Jede weitere globale Lookup-Tabelle die Tenant-Customization braucht
- Später: `custom_color`, `custom_icon` auch für Overrides (nicht nur neue Kategorien)
