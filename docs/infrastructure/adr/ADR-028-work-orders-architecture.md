# ADR-028: Work Orders (Arbeitsaufträge) Architecture

| Metadata                | Value                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                   |
| **Date**                | 2026-03-03                                                                                                                 |
| **Decision Makers**     | SCS-Technik Team                                                                                                           |
| **Affected Components** | PostgreSQL (3 Migrationen, 5 Tabellen), Backend (NestJS work-orders Modul, 20+ Dateien), Frontend (SvelteKit, 20+ Dateien) |
| **Supersedes**          | ---                                                                                                                        |
| **Related ADRs**        | ADR-003 (SSE), ADR-004 (Notifications), ADR-009 (Audit Logging), ADR-019 (RLS), ADR-020 (Permissions), ADR-026 (TPM)       |

---

## Context

Auf der TPM Mängelliste werden Mängel dokumentiert — aber niemand wird damit beauftragt, sie zu beheben. Mängel bleiben liegen, gehen unter, werden vergessen. Es fehlt ein geschlossener Kreislauf von **Mangel erkannt -> Auftrag erstellt -> Mitarbeiter bearbeitet -> Admin verifiziert**.

| Problem                    | Impact                                             |
| -------------------------- | -------------------------------------------------- |
| Kein Zuweisungsmechanismus | Mängel bleiben undokumentiert liegen               |
| Keine Statusverfolgung     | Niemand weiß ob Reparatur läuft oder abgeschlossen |
| Kein Verifikationsschritt  | Reparaturqualität wird nicht geprüft               |
| Keine Benachrichtigung     | Mitarbeiter erfahren nicht von neuen Aufträgen     |
| Kein Fälligkeitsmanagement | Dringende Aufträge werden nicht priorisiert        |

---

## Decision

### 1. Eigenständiges NestJS-Modul

**Problem:** Arbeitsaufträge könnten in das TPM-Modul integriert werden, aber zukünftige Quellen (KVP, manuell) erfordern Modularität.

**Lösung:** Eigenständiges `work-orders` Modul mit polymorphem `source_type` + `source_uuid`.

```
work-orders/
├── work-orders.module.ts              # NestJS Modul
├── work-orders.controller.ts          # 15 REST Endpoints
├── work-orders.service.ts             # Core CRUD
├── work-orders-assignees.service.ts   # N:M Zuweisung
├── work-orders-status.service.ts      # Validated Transitions
├── work-orders-comments.service.ts    # Kommentare
├── work-orders-photos.service.ts      # Foto-Upload
├── work-orders-notification.service.ts # SSE + DB Notifications
├── work-orders-due-cron.service.ts    # Fälligkeits-Cron
├── work-orders.helpers.ts             # Pure Mapper
├── work-orders.types.ts               # Interfaces
├── work-orders.permissions.ts         # ADR-020 Berechtigungen
├── work-orders-permission.registrar.ts # Auto-Registration
└── dto/                               # Zod DTOs
```

### 2. Status-Lebenszyklus (4 Stufen)

```
open -> in_progress -> completed -> verified
                    <- (Rückweisung)
```

| Transition               | Wer                 | Aktion                         |
| ------------------------ | ------------------- | ------------------------------ |
| open -> in_progress      | Employee (Assignee) | Beginnt Arbeit                 |
| in_progress -> completed | Employee (Assignee) | Markiert als fertig            |
| completed -> verified    | Admin               | Verifiziert Qualität           |
| completed -> in_progress | Admin               | Rückweisung (Nacharbeit nötig) |
| verified -> completed    | Admin               | Verifizierung widerrufen       |

Übergänge sind validiert (`isValidStatusTransition`) und erzeugen automatisch System-Kommentare.

### 3. Polymorphe Quellen

```sql
source_type ENUM: 'tpm_defect' | 'manual'
source_uuid CHAR(36) -- Referenz auf Quell-Entity (NULL bei manual)
```

**Warum kein Foreign Key?** `source_uuid` zeigt auf verschiedene Tabellen je nach `source_type`. Ein FK wäre nur auf eine Tabelle möglich. Kein JOIN auf Quelltabelle nötig — der Auftrag ist eigenständig.

### 4. N:M Assignees mit Race-Condition-Schutz

```sql
-- FOR UPDATE Lock auf work_orders Row vor Assignee-Mutation
SELECT id FROM work_orders WHERE uuid = $1 FOR UPDATE;
-- Dann INSERT/DELETE auf work_order_assignees
```

### 5. Notification-Architektur

| Event            | SSE (Real-time)           | DB (Persistent)    | Empfänger          |
| ---------------- | ------------------------- | ------------------ | ------------------ |
| Zuweisung        | WORK_ORDER_ASSIGNED       | work_orders (type) | Assignees          |
| Status-Änderung  | WORK_ORDER_STATUS_CHANGED | —                  | Assignees + Admins |
| Fälligkeit (24h) | WORK_ORDER_DUE_SOON       | —                  | Assignees          |
| Verifizierung    | WORK_ORDER_VERIFIED       | work_orders (type) | Assignees          |

**SSE-Targeting:** Employees sehen nur eigene Assignments. Admins/Root sehen alle im Tenant.

### 6. Fälligkeits-Cron

- Läuft täglich 07:00 Europe/Berlin
- Prüft `due_date <= NOW() + 24h AND due_date > NOW() AND due_soon_notified_at IS NULL`
- Setzt `due_soon_notified_at` als Flag gegen Doppelbenachrichtigung
- Pattern: identisch zu `TpmDueDateCronService`

### 7. Feature-Gating + Permissions (ADR-020)

```
Feature: work_orders (category: premium)
Module: work-orders-manage (Admin: CRUD, Zuweisung)
Module: work-orders-execute (Employee: Status, Kommentare, Fotos)
```

---

## Database Schema

### Neue Tabellen (Migration 064 + 065)

| Tabelle                | Spalten | RLS | Zweck                    |
| ---------------------- | ------- | --- | ------------------------ |
| `work_orders`          | 17      | Ja  | Kern-Entity              |
| `work_order_assignees` | 6       | Ja  | N:M Zuweisung            |
| `work_order_comments`  | 10      | Ja  | Text + Status-Kommentare |
| `work_order_photos`    | 8       | Ja  | Foto-Dokumentation       |

### Neue ENUMs

- `work_order_status`: open, in_progress, completed, verified
- `work_order_priority`: low, medium, high
- `work_order_source_type`: tpm_defect, manual

### Migration 068: `due_soon_notified_at`

Nullable TIMESTAMPTZ auf `work_orders` — Flag für Cron Fälligkeits-Benachrichtigung.

---

## Frontend Architecture

### Employee View (`/work-orders`)

- Liste eigener zugewiesener Aufträge
- Filter: Status, Priorität
- StatusBadge + StatusTransition Komponenten

### Detail View (`/work-orders/[uuid]`)

- WorkOrderInfo (Titel, Beschreibung, Priorität, Fälligkeit)
- StatusTransition (validierte Übergänge)
- AssigneeList
- CommentSection (Text + automatische Status-Kommentare)
- PhotoGallery (Upload + Anzeige)

### Admin View (`/work-orders/admin`)

- Tabelle aller Aufträge mit Filtern
- EditWorkOrderModal
- AssignUserModal

### TPM Integration

- "Zuweisen" Button auf Mängel-Detailseite (`CreateWorkOrderFromDefect.svelte`)
- Erstellt Arbeitsauftrag mit `source_type: 'tpm_defect'`

---

## Consequences

### Positive

- Geschlossener Kreislauf: Mangel -> Auftrag -> Bearbeitung -> Verifizierung
- Modulübergreifend erweiterbar (KVP, manuell, zukünftige Module)
- Vollständige Benachrichtigungskette (SSE + persistent)
- Permission-aware (ADR-020 konform)
- Audit-geloggt (ActivityLoggerService)

### Negative

- Neue Migration + 5 Tabellen erhöhen DB-Komplexität
- Kein Offline-Modus (V1) — nur online nutzbar
- Kein Kanban-Board (V1) — nur Listen-Ansicht

### Risiken (mitigiert)

| Risiko                       | Mitigation                                 |
| ---------------------------- | ------------------------------------------ |
| Polymorphe source_type JOINs | Kein JOIN nötig — Auftrag ist eigenständig |
| Race Condition bei Zuweisung | FOR UPDATE Lock auf work_orders Row        |
| SSE-Notification Flut        | Targeted Delivery (nur Assignees + Admins) |
| Addon-Flag vergessen         | @RequireAddon auf Controller               |

---

## Test Coverage

| Testtyp    | Anzahl  | Dateien |
| ---------- | ------- | ------- |
| Unit Tests | 123     | 6       |
| DTO Tests  | 124     | 1       |
| API Tests  | 19      | 1       |
| **Gesamt** | **266** | **8**   |
