# ADR-039: Per-Tenant Deputy Scope Toggle

| Metadata                | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Status**              | Proposed                                                                           |
| **Date**                | 2026-03-21                                                                         |
| **Decision Makers**     | SCS-Technik Team                                                                   |
| **Affected Components** | Backend (HierarchyPermissionService, 15+ SQL queries), Frontend (Positions Page)   |
| **Supersedes**          | ---                                                                                |
| **Related ADRs**        | ADR-036 (Scope Access, KL#10), ADR-035 (Org Hierarchy), ADR-038 (Position Catalog) |

---

## Context

Seit dem Deputy Leads Feature (2026-03-21) haben Deputies auf allen 3 Hierarchie-Ebenen **identische** Scope-Rechte wie ihre Leads (`DEPUTY_EQUALS_LEAD = true` — hardcoded Konstante). Jede Firma hat jedoch andere Anforderungen:

| Firma-Typ                  | Gewünschtes Verhalten                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| **Streng hierarchisch**    | Deputy ist nur ein Titel — kein erweiterter Scope, reine Vertretungsrolle |
| **Flache Hierarchie**      | Deputy hat volle Lead-Rechte — kann alles sehen und verwalten             |
| **Hybrid**                 | Deputy genehmigt Urlaubsanfragen, sieht aber keine Manage-Seiten          |

Aktuell gibt es keine Möglichkeit, dieses Verhalten pro Tenant zu konfigurieren.

### Referenz

ADR-036 (Organizational Scope Access Control), Known Limitation #10:
> "V2-Erweiterung: Per-Tenant-Setting. Wenn false → `*_deputy_lead_id` aus CTE-Queries entfernen."

---

## Decision

### 1. Per-Tenant Boolean Setting

**Entscheidung:** Ein Boolean-Flag pro Tenant, das steuert ob Deputies erweiterte Scope-Rechte haben.

```sql
-- In organigram_settings oder tenants:
deputy_has_lead_scope BOOLEAN NOT NULL DEFAULT false
```

**Default: `false`** — Deputies sind standardmäßig nur ein Titel ohne erweiterte Rechte. Tenants, die Deputies als vollwertige Leads nutzen wollen, aktivieren das Setting explizit.

### 2. UI: Checkbox auf der Positions-Seite

**Entscheidung:** Toggle auf `/settings/organigram/positions` im "Leitende Positionen" Bereich.

```
┌─────────────────────────────────────────────────────┐
│ Leitende Positionen (System)                         │
│                                                      │
│  🔒 Bereiche-Leiter                    [System]      │
│  🔒 Bereiche Stellvertreter            [System]      │
│  🔒 Abteilungen-Leiter                [System]      │
│  🔒 Abteilungen Stellvertreter         [System]      │
│  🔒 Teams-Leiter                       [System]      │
│  🔒 Teams Stellvertreter               [System]      │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ ☐ Stellvertreter haben gleiche Rechte        │    │
│  │   wie ihre Leiter (Scope & Sichtbarkeit)     │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Warum auf der Positions-Seite?**
- Logischer Ort: Deputies sind System-Positionen, das Setting betrifft ihre Berechtigung
- Root-only: Positions-Seite ist bereits `(root)` Route Group geschützt
- Kein neuer Endpoint nötig: Setting kann über bestehenden Organigram-Endpoint gespeichert werden

### 3. Konditionale SQL-Queries

**Entscheidung:** Die `DEPUTY_EQUALS_LEAD` Konstante wird durch eine Runtime-Prüfung ersetzt. Alle Queries, die `OR *_deputy_lead_id = $1` enthalten, werden konditional.

**Zwei Implementierungs-Optionen:**

#### Option A: Query-Builder mit Flag (empfohlen)

```typescript
// hierarchy-permission.service.ts
const deputyClause = deputyHasLeadScope
  ? 'OR area_deputy_lead_id = $1'
  : '';

const LEAD_AREAS_CTE = `
  SELECT id FROM areas
  WHERE (area_lead_id = $1 ${deputyClause})
    AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}
`;
```

**Vorteil:** Minimale Änderung, kein zweites Query-Set nötig.
**Nachteil:** String-Interpolation in SQL (aber keine User-Eingabe, nur Boolean-Flag).

#### Option B: Zwei CTE-Varianten

```typescript
const CTE_WITH_DEPUTIES = `...OR area_deputy_lead_id = $1...`;
const CTE_WITHOUT_DEPUTIES = `...area_lead_id = $1...`;

const cte = deputyHasLeadScope ? CTE_WITH_DEPUTIES : CTE_WITHOUT_DEPUTIES;
```

**Vorteil:** Keine String-Interpolation, sauberer SQL.
**Nachteil:** Code-Duplizierung (~30 Zeilen CTE × 2).

### 4. Verhalten bei `deputy_has_lead_scope = false`

| Feature              | Deputy mit Scope (ON)        | Deputy ohne Scope (OFF)        |
| -------------------- | ---------------------------- | ------------------------------ |
| Manage-Seiten        | Sieht alle Entities im Scope | Sieht nichts (kein Scope)      |
| KVP unshared         | Sieht Team-KVPs              | Sieht nur eigene               |
| Survey Visibility    | Sieht zugewiesene Surveys    | Sieht nur persönlich zugewiesene |
| Vacation Approval    | Kann genehmigen              | **Kann trotzdem genehmigen**   |
| TPM Approval         | Kann genehmigen              | **Kann trotzdem genehmigen**   |
| Approvals (generisch)| Ist Genehmiger               | **Ist trotzdem Genehmiger**    |
| Position Display     | "Bereiche Stellvertreter"    | "Bereiche Stellvertreter"      |

**Wichtig:** Vacation/Approval-Logik ist **immer aktiv** — unabhängig vom Scope-Toggle. Deputies können immer Urlaubsanfragen genehmigen. Das Toggle betrifft nur die **Sichtbarkeit** (welche Entities sie sehen), nicht die **Genehmigungskette**.

**Warum?** Die Genehmigungskette ist ein Fallback-Mechanismus (Lead → Deputy → Eskalation). Wenn der Deputy keine Genehmigungsrechte hätte, wäre die Position sinnlos — dann bräuchte man keinen Stellvertreter.

### 5. Setting-Speicherung

**Entscheidung:** Neues Feld in `organigram_trees` (bereits existierende JSONB-Struktur für `custom_labels`).

```sql
ALTER TABLE organigram_trees ADD COLUMN deputy_has_lead_scope BOOLEAN NOT NULL DEFAULT false;
```

**Warum `organigram_trees`?**
- Tabelle existiert bereits mit Tenant-Isolation (RLS)
- Wird bereits beim App-Layout-Load gefetcht (parallel mit `hierarchy-labels`)
- Kein neues API-Endpoint nötig — PATCH `/organigram/settings` existiert

---

## Alternatives Considered

### A. Global-Setting (Rejected)

**Pros:** Einfacher — eine Konstante für alle Tenants.
**Cons:** Jede Firma ist anders. Automotive-Zulieferer braucht strenge Hierarchie, Startup will flache Struktur. Per-Tenant ist die richtige Granularität.

### B. Per-Position-Toggle (Rejected)

**Pros:** Maximale Granularität — z.B. Area-Deputy hat Scope, Team-Deputy nicht.
**Cons:** Over-Engineering. 3 separate Toggles für 3 Deputy-Positionen ist zu komplex für die UI und die Query-Logik. Ein Boolean reicht.

### C. Per-Deputy-User-Toggle (Rejected)

**Pros:** Jeder einzelne Deputy kann konfiguriert werden.
**Cons:** Extremes Over-Engineering. Admin müsste für jeden Deputy einzeln entscheiden. Das ist kein sinnvolles UX-Pattern.

---

## Consequences

### Positive

- **Flexibilität:** Jeder Tenant kann selbst entscheiden ob Deputies Scope-Rechte haben
- **Rückwärtskompatibel:** Default `false` ändert nichts am aktuellen Verhalten für neue Tenants
- **Minimal-invasiv:** Nur String-Interpolation oder CTE-Switch, kein Architektur-Umbau
- **KISS:** Ein Boolean, eine Checkbox, fertig

### Negative

- **~15 SQL-Queries konditional machen:** Jede Stelle mit `OR *_deputy_lead_id` braucht das Flag
- **Setting muss beim App-Start geladen werden:** Zusätzliches Feld im Layout-Fetch (minimal, bereits existierender Call)
- **Test-Matrix verdoppelt sich:** Jeder Deputy-Test braucht ON/OFF Varianten

---

## Implementation Estimate

| Phase | Scope                                                     | Sessions |
| ----- | --------------------------------------------------------- | -------- |
| 1     | DB: Column + Migration                                    | 0.5      |
| 2     | Backend: Setting laden, an HierarchyPermissionService durchreichen | 0.5      |
| 3     | Backend: Alle 15+ Queries konditional machen              | 1        |
| 4     | Frontend: Checkbox + API-Call                             | 0.5      |
| 5     | Tests: ON/OFF Varianten                                   | 0.5      |

**Total:** ~3 Sessions

---

## References

- [ADR-036](./ADR-036-organizational-scope-access-control.md) — Organizational Scope Access Control (Known Limitation #10)
- [ADR-035](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — Organizational Hierarchy
- [FEAT_DEPUTY_LEADS_MASTERPLAN](../../FEAT_DEPUTY_LEADS_MASTERPLAN.md) — Deputy Leads Feature (Basis)
- `DEPUTY_EQUALS_LEAD` in `organizational-scope.types.ts` — Bestehende Konstante, wird durch Per-Tenant-Setting ersetzt
